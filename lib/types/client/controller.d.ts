/**
 * dsh-single-terminal —— 客户端控制器（模块级单例）：
 * WebSocket 生命周期、帧路由、sink 注册（xterm 实例）、UI 状态 store。
 *
 * 会话输出在 sink 注册前先积压到 pending（React 挂载/重连时序下不丢字节）；
 * 抽屉关闭不卸载组件（display:none），xterm 缓冲与会话保持。
 */
import type { ShellInfo, SessionInfo } from './protocol.ts';
import { type ConnectionState } from './ws.ts';
export interface TabState {
    id: string;
    shellId: string;
    label: string;
    cwd: string;
    alive: boolean;
    exitCode: number | null;
}
export type DrawerMode = 'docked' | 'overlay';
export interface TerminalSink {
    write(data: string): void;
}
interface DrawerState {
    open: boolean;
    mode: DrawerMode;
    height: number;
    conn: ConnectionState;
    tabs: TabState[];
    activeId: string | null;
    shells: ShellInfo[];
    defaultShell: string;
    fontSize: number;
    fontFamily: string;
    notice: string | null;
}
declare class DrawerStore {
    private state;
    private readonly listeners;
    subscribe: (listener: () => void) => (() => void);
    getSnapshot: () => DrawerState;
    private set;
    setOpen(open: boolean): void;
    setMode(mode: DrawerMode): void;
    setHeight(height: number): void;
    setConn(conn: ConnectionState): void;
    setNotice(notice: string | null): void;
    applyHello(frame: {
        defaultShell: string;
        fontSize: number;
        fontFamily: string;
    }): void;
    applyInventory(shells: ShellInfo[], sessions: SessionInfo[]): {
        adopted: SessionInfo[];
    };
    addSession(session: SessionInfo): void;
    setActive(id: string): void;
    markDead(id: string, exitCode: number | null): void;
    removeTab(id: string): void;
}
declare class TerminalController {
    readonly store: DrawerStore;
    private socket;
    private readonly sinks;
    private readonly pending;
    private noticeTimer;
    toggle(): void;
    setOpen(open: boolean): void;
    ensureStarted(): void;
    private autoOpening;
    private maybeAutoOpen;
    newTerminal(shellId: string): void;
    closeTab(id: string): void;
    setActive(id: string): void;
    setMode(mode: DrawerMode): void;
    setHeight(height: number): void;
    showNotice(message: string): void;
    sendInput(id: string, data: string): void;
    sendResize(id: string, cols: number, rows: number): void;
    registerSink(id: string, sink: TerminalSink): () => void;
    dispose(): void;
    private writeData;
    private onFrame;
}
export declare const terminal: TerminalController;
export declare function useDrawerState(): DrawerState;
export {};
//# sourceMappingURL=controller.d.ts.map