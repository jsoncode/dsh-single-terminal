/**
 * dsh-single-terminal —— 同源 WebSocket 客户端（自动重连，指数退避）。
 *
 * URL 由 location.origin 推导（http→ws / https→wss），浏览器自动携带
 * dsh-auth cookie（与宿主 /api/remote.mux 相同的鉴权路径）。
 */

import type { ClientFrame, HostFrame } from './protocol.ts'

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting'

export interface TerminalSocketHandlers {
  onFrame(frame: HostFrame): void
  onState(state: ConnectionState): void
}

export class TerminalSocket {
  private socket: WebSocket | null = null
  private retry = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private disposed = false

  constructor(private readonly handlers: TerminalSocketHandlers) {}

  connect(): void {
    if (this.disposed || this.socket !== null) return
    this.handlers.onState(this.retry === 0 ? 'connecting' : 'reconnecting')
    const origin = globalThis.location?.origin
    const base = origin !== undefined && origin !== 'null' ? origin : 'http://localhost:3000'
    const url = base.replace(/^http/, 'ws') + '/api/dsh-single-terminal.ws'
    const socket = new WebSocket(url)
    this.socket = socket
    socket.onopen = () => {
      this.retry = 0
      this.handlers.onState('connected')
    }
    socket.onmessage = (event: MessageEvent) => {
      let frame: HostFrame
      try {
        frame = JSON.parse(String(event.data)) as HostFrame
      } catch {
        return
      }
      this.handlers.onFrame(frame)
    }
    socket.onclose = () => {
      this.socket = null
      if (this.disposed) return
      this.scheduleReconnect()
    }
    socket.onerror = () => {
      try { socket.close() } catch { /* closing */ }
    }
  }

  send(frame: ClientFrame): void {
    if (this.socket !== null && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(frame))
    }
  }

  dispose(): void {
    this.disposed = true
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    if (this.socket !== null) {
      try { this.socket.close() } catch { /* closing */ }
      this.socket = null
    }
  }

  private scheduleReconnect(): void {
    this.retry += 1
    const delay = Math.min(1000 * 2 ** Math.min(this.retry - 1, 4), 15_000)
    this.handlers.onState('reconnecting')
    this.timer = setTimeout(() => {
      this.timer = null
      this.connect()
    }, delay)
  }
}
