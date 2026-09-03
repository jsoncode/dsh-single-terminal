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
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { ShellRegistry } from './shells.ts';
import type { TerminalPluginConfig } from './types.ts';
export declare class TerminalHub {
    private readonly config;
    private readonly registry;
    private readonly wss;
    private readonly sockets;
    private readonly sessions;
    private nextSocketId;
    constructor(config: TerminalPluginConfig, registry: ShellRegistry);
    /** webServer.registerUpgrade 的 handler 入口（鉴权由插件入口完成后调用）。 */
    handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void;
    /** 插件卸载：终止全部会话并断开所有连接。 */
    dispose(): void;
    private handleConnection;
    private dispatch;
    private open;
    private close;
    private killSession;
    private resolveCwd;
    private appendBuffer;
    private snapshotFrame;
    private sessionInfo;
    private send;
    private broadcast;
}
//# sourceMappingURL=hub.d.ts.map