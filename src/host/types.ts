/**
 * dsh-single-terminal —— 共享类型：插件配置、WS 帧协议、宿主服务最小视图。
 */

/* ── 插件配置（cordis.yml config / Plugins 设置页）────────────────── */

export interface CustomShellConfig {
  id: string
  name: string
  command: string
  args: string[]
}

export interface TerminalPluginConfig {
  defaultShell: string
  defaultCwd: string
  scrollbackLimit: number
  fontSize: number
  fontFamily: string
  customShells: CustomShellConfig[]
}

/* ── WS 帧协议（JSON 文本帧，/api/dsh-single-terminal.ws）─────────── */

export interface ShellInfo {
  id: string
  name: string
  available: boolean
}

export interface SessionInfo {
  id: string
  shellId: string
  label: string
  cwd: string
  alive: boolean
  pid: number
  exitCode: number | null
  signal: number | null
}

/** client → host */
export type ClientFrame =
  | { type: 'ping' }
  | { type: 'list' }
  | { type: 'open'; shellId: string; cols: number; rows: number; cwd?: string }
  | { type: 'input'; id: string; data: string }
  | { type: 'resize'; id: string; cols: number; rows: number }
  | { type: 'attach'; id: string }
  | { type: 'close'; id: string }

/** host → client */
export type HostFrame =
  | { type: 'pong' }
  | { type: 'hello'; platform: string; defaultShell: string; fontSize: number; fontFamily: string }
  | { type: 'shells'; defaultShell: string; shells: ShellInfo[]; sessions: SessionInfo[] }
  | { type: 'opened'; session: SessionInfo }
  | { type: 'data'; id: string; data: string }
  | { type: 'replay'; id: string; data: string }
  | { type: 'exit'; id: string; exitCode: number | null; signal: number | null; closed?: boolean }
  | { type: 'error'; message: string; id?: string }

/* ── 宿主服务最小视图（避免对 @deepseek-ai/* 的值依赖）────────────── */

import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'

/** 宿主 connection 服务最小视图（@deepseek-ai/dsh-client-connection）。 */
export interface ConnectionService {
  requestRejection(request: IncomingMessage): number | undefined
}

/** 宿主 webServer 服务最小视图（@deepseek-ai/dsh-host-webserver）。 */
export interface WebServerService {
  registerUpgrade(route: {
    path: string
    handler: (req: IncomingMessage, socket: Duplex, head: Buffer) => void | Promise<void>
  }): () => void
}
