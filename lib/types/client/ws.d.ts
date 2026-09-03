/**
 * dsh-single-terminal —— 同源 WebSocket 客户端（自动重连，指数退避）。
 *
 * URL 由 location.origin 推导（http→ws / https→wss），浏览器自动携带
 * dsh-auth cookie（与宿主 /api/remote.mux 相同的鉴权路径）。
 */
import type { ClientFrame, HostFrame } from './protocol.ts';
export type ConnectionState = 'connecting' | 'connected' | 'reconnecting';
export interface TerminalSocketHandlers {
    onFrame(frame: HostFrame): void;
    onState(state: ConnectionState): void;
}
export declare class TerminalSocket {
    private readonly handlers;
    private socket;
    private retry;
    private timer;
    private disposed;
    constructor(handlers: TerminalSocketHandlers);
    connect(): void;
    send(frame: ClientFrame): void;
    dispose(): void;
    private scheduleReconnect;
}
//# sourceMappingURL=ws.d.ts.map