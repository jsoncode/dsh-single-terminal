/**
 * dsh-single-terminal —— 客户端控制器（模块级单例）：
 * WebSocket 生命周期、帧路由、sink 注册（xterm 实例）、UI 状态 store。
 *
 * 会话输出在 sink 注册前先积压到 pending（React 挂载/重连时序下不丢字节）；
 * 抽屉关闭不卸载组件（display:none），xterm 缓冲与会话保持。
 */

import { useSyncExternalStore } from 'react'
import type { HostFrame, ShellInfo, SessionInfo } from './protocol.ts'
import { loadJson, saveJson } from './storage.ts'
import { TerminalSocket, type ConnectionState } from './ws.ts'

export interface TabState {
  id: string
  shellId: string
  label: string
  cwd: string
  alive: boolean
  exitCode: number | null
}

export type DrawerMode = 'docked' | 'overlay'

export interface TerminalSink {
  write(data: string): void
}

interface DrawerState {
  open: boolean
  mode: DrawerMode
  height: number
  conn: ConnectionState
  tabs: TabState[]
  activeId: string | null
  shells: ShellInfo[]
  defaultShell: string
  fontSize: number
  fontFamily: string
  notice: string | null
}

class DrawerStore {
  private state: DrawerState = {
    open: false,
    mode: loadJson<DrawerMode>('mode', 'overlay'),
    height: loadJson<number>('height', 360),
    conn: 'connecting',
    tabs: [],
    activeId: null,
    shells: [],
    defaultShell: 'powershell',
    fontSize: 13,
    fontFamily: 'Consolas, "Cascadia Mono", "Courier New", monospace',
    notice: null,
  }

  private readonly listeners = new Set<() => void>()

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  getSnapshot = (): DrawerState => this.state

  private set(patch: Partial<DrawerState>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }

  setOpen(open: boolean): void {
    this.set({ open })
  }

  setMode(mode: DrawerMode): void {
    saveJson('mode', mode)
    this.set({ mode })
  }

  setHeight(height: number): void {
    saveJson('height', height)
    this.set({ height })
  }

  setConn(conn: ConnectionState): void {
    this.set({ conn })
  }

  setNotice(notice: string | null): void {
    this.set({ notice })
  }

  applyHello(frame: { defaultShell: string; fontSize: number; fontFamily: string }): void {
    this.set({ defaultShell: frame.defaultShell, fontSize: frame.fontSize, fontFamily: frame.fontFamily })
  }

  applyInventory(shells: ShellInfo[], sessions: SessionInfo[]): { adopted: SessionInfo[] } {
    const known = new Set(this.state.tabs.map((tab) => tab.id))
    const adopted = sessions.filter((session) => !known.has(session.id))
    if (adopted.length > 0) {
      const tabs = [...this.state.tabs, ...adopted.map(toTab)]
      const activeId = this.state.activeId ?? tabs[tabs.length - 1]?.id ?? null
      this.set({ shells, tabs, activeId })
    } else {
      this.set({ shells })
    }
    return { adopted }
  }

  addSession(session: SessionInfo): void {
    if (this.state.tabs.some((tab) => tab.id === session.id)) return
    this.set({ tabs: [...this.state.tabs, toTab(session)], activeId: session.id })
  }

  setActive(id: string): void {
    this.set({ activeId: id })
  }

  markDead(id: string, exitCode: number | null): void {
    this.set({
      tabs: this.state.tabs.map((tab) => (tab.id === id ? { ...tab, alive: false, exitCode } : tab)),
    })
  }

  removeTab(id: string): void {
    const tabs = this.state.tabs.filter((tab) => tab.id !== id)
    const activeId = this.state.activeId === id ? tabs[tabs.length - 1]?.id ?? null : this.state.activeId
    this.set({ tabs, activeId })
  }
}

function toTab(session: SessionInfo): TabState {
  return { id: session.id, shellId: session.shellId, label: session.label, cwd: session.cwd, alive: session.alive, exitCode: session.exitCode }
}

class TerminalController {
  readonly store = new DrawerStore()

  private socket: TerminalSocket | null = null
  private readonly sinks = new Map<string, TerminalSink>()
  private readonly pending = new Map<string, string>()
  private noticeTimer: ReturnType<typeof setTimeout> | null = null
  /** 当前会话归属工作区的根目录（toggle 组件同步；null = 无工作区，用宿主默认）。 */
  private workspaceCwd: string | null = null

  setWorkspaceCwd(cwd: string | null): void {
    this.workspaceCwd = cwd
  }

  toggle(): void {
    this.setOpen(!this.store.getSnapshot().open)
  }

  setOpen(open: boolean): void {
    this.store.setOpen(open)
    if (open) {
      this.ensureStarted()
      this.maybeAutoOpen()
    } else {
      this.autoOpening = false
    }
  }

  ensureStarted(): void {
    if (this.socket !== null) return
    this.socket = new TerminalSocket({
      onFrame: (frame) => { this.onFrame(frame) },
      onState: (state) => {
        this.store.setConn(state)
        // 每次连上（含重连）都拉取会话清单：adopt 存活会话 + attach 回放，
        // 完成页面刷新后的标签恢复。
        if (state === 'connected') this.socket?.send({ type: 'list' })
      },
    })
    this.socket.connect()
  }

  // 打开抽屉且没有任何终端时自动新建默认 shell；清单未就绪时由 shells 帧兜底。
  private autoOpening = false

  private maybeAutoOpen(): void {
    const state = this.store.getSnapshot()
    if (!state.open || state.conn !== 'connected' || state.shells.length === 0) return
    if (state.tabs.length > 0 || this.autoOpening) return
    this.autoOpening = true
    this.newTerminal(state.defaultShell)
  }

  newTerminal(shellId: string): void {
    this.ensureStarted()
    const cwd = this.workspaceCwd
    this.socket?.send(cwd !== null
      ? { type: 'open', shellId, cols: 80, rows: 24, cwd }
      : { type: 'open', shellId, cols: 80, rows: 24 })
  }

  closeTab(id: string): void {
    this.sinks.delete(id)
    this.pending.delete(id)
    this.store.removeTab(id)
    this.socket?.send({ type: 'close', id })
  }

  setActive(id: string): void {
    this.store.setActive(id)
  }

  setMode(mode: DrawerMode): void {
    this.store.setMode(mode)
  }

  setHeight(height: number): void {
    this.store.setHeight(height)
  }

  showNotice(message: string): void {
    this.store.setNotice(message)
    if (this.noticeTimer !== null) clearTimeout(this.noticeTimer)
    this.noticeTimer = setTimeout(() => {
      this.noticeTimer = null
      this.store.setNotice(null)
    }, 6000)
  }

  sendInput(id: string, data: string): void {
    this.socket?.send({ type: 'input', id, data })
  }

  sendResize(id: string, cols: number, rows: number): void {
    this.socket?.send({ type: 'resize', id, cols, rows })
  }

  registerSink(id: string, sink: TerminalSink): () => void {
    this.sinks.set(id, sink)
    const buffered = this.pending.get(id)
    if (buffered !== undefined) {
      this.pending.delete(id)
      sink.write(buffered)
    }
    return () => {
      if (this.sinks.get(id) === sink) this.sinks.delete(id)
    }
  }

  dispose(): void {
    this.socket?.dispose()
    this.socket = null
  }

  private writeData(id: string, data: string): void {
    const sink = this.sinks.get(id)
    if (sink !== undefined) {
      sink.write(data)
      return
    }
    this.pending.set(id, (this.pending.get(id) ?? '') + data)
  }

  private onFrame(frame: HostFrame): void {
    switch (frame.type) {
      case 'hello':
        this.store.applyHello(frame)
        break
      case 'shells': {
        const { adopted } = this.store.applyInventory(frame.shells, frame.sessions)
        for (const session of adopted) {
          this.socket?.send({ type: 'attach', id: session.id })
        }
        this.maybeAutoOpen()
        break
      }
      case 'opened':
        this.autoOpening = false
        this.store.addSession(frame.session)
        break
      case 'data':
      case 'replay':
        this.writeData(frame.id, frame.data)
        break
      case 'exit':
        if (frame.closed === true) {
          this.sinks.delete(frame.id)
          this.pending.delete(frame.id)
          this.store.removeTab(frame.id)
        } else {
          this.store.markDead(frame.id, frame.exitCode)
        }
        break
      case 'error':
        this.autoOpening = false
        this.showNotice(frame.message)
        break
    }
  }
}

export const terminal = new TerminalController()

export function useDrawerState(): DrawerState {
  return useSyncExternalStore(terminal.store.subscribe, terminal.store.getSnapshot)
}
