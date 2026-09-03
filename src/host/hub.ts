/**
 * dsh-single-terminal —— 终端 Hub：PTY 会话管理 + WebSocket 帧协议。
 *
 * - PTY 经插件自身依赖 node-pty（原生模块，external）直连 ConPTY/POSIX pty，
 *   获得完整 resize/kill/数据流控制（宿主 ctx.subprocess 的 TerminalHandle
 *   接口不暴露 resize，无法满足抽屉尺寸跟随）；
 * - 会话与 WebSocket 连接解耦：页面刷新/抽屉关闭后会话保活，重连后 attach
 *   回放环形缓冲（容量 scrollbackLimit）；
 * - 多浏览器标签页可同时 attach 同一会话：输出广播、输入合并。
 */

import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { isAbsolute } from 'node:path'
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocket, WebSocketServer } from 'ws'
import type { IPty } from 'node-pty'
import type { ShellRegistry, ResolvedShell } from './shells.ts'
import type { ClientFrame, HostFrame, SessionInfo, TerminalPluginConfig } from './types.ts'

const require = createRequire(import.meta.url)
const nodePty = require('node-pty') as typeof import('node-pty')

interface Session {
  id: string
  shell: ResolvedShell
  cwd: string
  pty: IPty
  buffer: string
  alive: boolean
  closing: boolean
  exitCode: number | null
  signal: number | null
}

const MAX_SESSIONS = 20
const INPUT_LIMIT = 1 << 16
const COLS_MIN = 2
const COLS_MAX = 500
const ROWS_MIN = 2
const ROWS_MAX = 300

const clamp = (value: number, min: number, max: number): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : min

export class TerminalHub {
  private readonly wss = new WebSocketServer({ noServer: true })
  private readonly sockets = new Set<WebSocket>()
  private readonly sessions = new Map<string, Session>()
  private nextSocketId = 0

  constructor(
    private readonly config: TerminalPluginConfig,
    private readonly registry: ShellRegistry,
  ) {
    this.wss.on('connection', (socket: WebSocket) => { this.handleConnection(socket) })
  }

  /** webServer.registerUpgrade 的 handler 入口（鉴权由插件入口完成后调用）。 */
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.wss.emit('connection', ws, req)
    })
  }

  /** 插件卸载：终止全部会话并断开所有连接。 */
  dispose(): void {
    console.log(`[dsh-single-terminal] hub dispose (${this.sessions.size} sessions, ${this.sockets.size} sockets)`)
    for (const session of this.sessions.values()) {
      this.killSession(session)
    }
    this.sessions.clear()
    for (const socket of this.sockets) {
      try { socket.terminate() } catch { /* already gone */ }
    }
    this.sockets.clear()
  }

  /* ── 连接生命周期 ─────────────────────────────────────────────── */

  private handleConnection(socket: WebSocket): void {
    const sid = ++this.nextSocketId
    this.sockets.add(socket)
    console.log(`[dsh-single-terminal] ws#${sid} connected (total ${this.sockets.size})`)
    socket.on('message', (raw: unknown) => { this.dispatch(socket, raw, sid) })
    socket.on('close', () => { this.sockets.delete(socket); console.log(`[dsh-single-terminal] ws#${sid} closed (total ${this.sockets.size})`) })
    socket.on('error', () => { this.sockets.delete(socket) })
    this.send(socket, {
      type: 'hello',
      platform: process.platform,
      defaultShell: this.registry.defaultShellId(this.config.defaultShell),
      fontSize: this.config.fontSize,
      fontFamily: this.config.fontFamily,
    })
  }

  private dispatch(socket: WebSocket, raw: unknown, sid: number): void {
    let frame: ClientFrame
    try {
      frame = JSON.parse(String(raw)) as ClientFrame
    } catch {
      return
    }
    if (frame.type !== 'input' && frame.type !== 'resize') {
      const detail = 'id' in frame ? ` id=${String(frame.id).slice(0, 8)}` : ''
      console.log(`[dsh-single-terminal] ws#${sid} <- ${frame.type}${detail}`)
    }
    switch (frame.type) {
      case 'ping':
        this.send(socket, { type: 'pong' })
        break
      case 'list':
        this.send(socket, this.snapshotFrame())
        break
      case 'open':
        this.open(frame.shellId, frame.cols, frame.rows, frame.cwd)
        break
      case 'input': {
        const session = this.sessions.get(frame.id)
        if (session === undefined || !session.alive) break
        try {
          session.pty.write(frame.data.length > INPUT_LIMIT ? frame.data.slice(0, INPUT_LIMIT) : frame.data)
        } catch { /* dead pty: exit event follows */ }
        break
      }
      case 'resize': {
        const session = this.sessions.get(frame.id)
        if (session === undefined || !session.alive) break
        try {
          session.pty.resize(clamp(frame.cols, COLS_MIN, COLS_MAX), clamp(frame.rows, ROWS_MIN, ROWS_MAX))
        } catch { /* transient during teardown */ }
        break
      }
      case 'attach': {
        const session = this.sessions.get(frame.id)
        if (session === undefined) break
        this.send(socket, { type: 'replay', id: session.id, data: session.buffer })
        if (!session.alive) {
          this.send(socket, { type: 'exit', id: session.id, exitCode: session.exitCode, signal: session.signal })
        }
        break
      }
      case 'close':
        this.close(frame.id)
        break
    }
  }

  /* ── 会话管理 ────────────────────────────────────────────────── */

  private open(shellId: string, cols: number, rows: number, cwdOverride: string | undefined): void {
    if (this.sessions.size >= MAX_SESSIONS) {
      this.broadcast({ type: 'error', message: '终端数量已达上限 / terminal session limit reached' })
      return
    }
    const shell = this.registry.resolve(shellId)
    if (shell === null) {
      this.broadcast({ type: 'error', message: `未知或不可用的 shell：「${shellId}」/ unknown or unavailable shell` })
      return
    }
    const cwd = this.resolveCwd(cwdOverride)
    const env: NodeJS.ProcessEnv = { ...process.env }
    if (process.platform !== 'win32') env.TERM = 'xterm-256color'
    let pty: IPty
    try {
      pty = nodePty.spawn(shell.file, shell.args, {
        name: 'xterm-256color',
        cols: clamp(cols, COLS_MIN, COLS_MAX),
        rows: clamp(rows, ROWS_MIN, ROWS_MAX),
        cwd,
        env,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      this.broadcast({ type: 'error', message: `无法启动 ${shell.name} / failed to spawn ${shell.name}: ${message}` })
      return
    }
    const session: Session = {
      id: randomUUID(),
      shell,
      cwd,
      pty,
      buffer: '',
      alive: true,
      closing: false,
      exitCode: null,
      signal: null,
    }
    this.sessions.set(session.id, session)
    console.log(`[dsh-single-terminal] session ${session.id.slice(0, 8)} opened shell=${shell.id} pid=${pty.pid} cwd=${cwd} (${this.sessions.size} total)`)
    pty.onData((data: string) => {
      this.appendBuffer(session, data)
      this.broadcast({ type: 'data', id: session.id, data })
    })
    pty.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
      session.alive = false
      session.exitCode = exitCode
      session.signal = typeof signal === 'number' ? signal : null
      if (this.sessions.has(session.id)) {
        this.broadcast({ type: 'exit', id: session.id, exitCode: session.exitCode, signal: session.signal })
        // 已广播 exit，客户端本地标记「已退出」；从快照移除，避免页面刷新后
        // 被 adopt 成死标签。之后对该 id 的 close 帧静默忽略（客户端已删标签）。
        this.sessions.delete(session.id)
        console.log(`[dsh-single-terminal] session ${session.id.slice(0, 8)} (pid ${session.pty.pid}) exited code=${exitCode}`)
      }
    })
    this.broadcast({ type: 'opened', session: this.sessionInfo(session) })
  }

  private close(id: string): void {
    const session = this.sessions.get(id)
    if (session === undefined) return
    console.log(`[dsh-single-terminal] closing session ${id.slice(0, 8)} (pid ${session.pty.pid})`)
    this.sessions.delete(id)
    if (!session.alive) {
      this.broadcast({ type: 'exit', id, exitCode: session.exitCode, signal: session.signal, closed: true })
      return
    }
    session.closing = true
    this.killSession(session)
    this.broadcast({ type: 'exit', id, exitCode: null, signal: null, closed: true })
  }

  private killSession(session: Session): void {
    try {
      session.pty.kill()
    } catch { /* already dead */ }
    if (process.platform === 'win32') {
      // node-pty 关闭 ConPTY 在部分 shell（powershell + PSReadLine）下不会结束
      // 整棵进程树（实测 shell 存活、控制台子进程死亡），补 taskkill /T /F 兜底；
      // 进程已死时 taskkill 静默失败。
      try { spawn('taskkill', ['/T', '/F', '/PID', String(session.pty.pid)], { stdio: 'ignore' }) } catch { /* best effort */ }
    } else {
      // forkpty 使 shell 成为会话首进程（pid == pgid），负 pid 杀整个进程组。
      try { process.kill(-session.pty.pid, 'SIGKILL') } catch { /* group gone */ }
    }
  }

  private resolveCwd(override: string | undefined): string {
    const validDirectory = (path: string): boolean => {
      try { return statSync(path).isDirectory() } catch { return false }
    }
    if (override !== undefined) {
      const trimmed = override.trim()
      if (trimmed.length > 0 && isAbsolute(trimmed) && validDirectory(trimmed)) return trimmed
    }
    const configured = (this.config.defaultCwd ?? 'workspace').trim()
    if (configured.length > 0 && configured !== 'workspace' && configured !== 'home' && isAbsolute(configured) && validDirectory(configured)) {
      return configured
    }
    return homedir()
  }

  private appendBuffer(session: Session, data: string): void {
    session.buffer += data
    const limit = this.config.scrollbackLimit
    if (session.buffer.length > limit) {
      session.buffer = session.buffer.slice(session.buffer.length - limit)
    }
  }

  /* ── 帧与快照 ────────────────────────────────────────────────── */

  private snapshotFrame(): HostFrame {
    return {
      type: 'shells',
      defaultShell: this.registry.defaultShellId(this.config.defaultShell),
      shells: this.registry.list(),
      sessions: [...this.sessions.values()].map((session) => this.sessionInfo(session)),
    }
  }

  private sessionInfo(session: Session): SessionInfo {
    return {
      id: session.id,
      shellId: session.shell.id,
      label: session.shell.name,
      cwd: session.cwd,
      alive: session.alive,
      pid: session.pty.pid,
      exitCode: session.exitCode,
      signal: session.signal,
    }
  }

  private send(socket: WebSocket, frame: HostFrame): void {
    if (socket.readyState !== WebSocket.OPEN) return
    try {
      socket.send(JSON.stringify(frame))
    } catch { /* connection raced closed */ }
  }

  private broadcast(frame: HostFrame): void {
    for (const socket of this.sockets) {
      this.send(socket, frame)
    }
  }
}
