/**
 * dsh-single-terminal —— 客户端侧 WS 帧协议视图（与 src/host/types.ts 保持一致；
 * 双面插件不共享运行时代码，这里独立声明）。
 */
export interface ShellInfo {
    id: string;
    name: string;
    available: boolean;
}
export interface SessionInfo {
    id: string;
    shellId: string;
    label: string;
    cwd: string;
    alive: boolean;
    pid: number;
    exitCode: number | null;
    signal: number | null;
}
export type ClientFrame = {
    type: 'ping';
} | {
    type: 'list';
} | {
    type: 'open';
    shellId: string;
    cols: number;
    rows: number;
    cwd?: string;
} | {
    type: 'input';
    id: string;
    data: string;
} | {
    type: 'resize';
    id: string;
    cols: number;
    rows: number;
} | {
    type: 'attach';
    id: string;
} | {
    type: 'close';
    id: string;
};
export type HostFrame = {
    type: 'pong';
} | {
    type: 'hello';
    platform: string;
    defaultShell: string;
    fontSize: number;
    fontFamily: string;
} | {
    type: 'shells';
    defaultShell: string;
    shells: ShellInfo[];
    sessions: SessionInfo[];
} | {
    type: 'opened';
    session: SessionInfo;
} | {
    type: 'data';
    id: string;
    data: string;
} | {
    type: 'replay';
    id: string;
    data: string;
} | {
    type: 'exit';
    id: string;
    exitCode: number | null;
    signal: number | null;
    closed?: boolean;
} | {
    type: 'error';
    message: string;
    id?: string;
};
//# sourceMappingURL=protocol.d.ts.map