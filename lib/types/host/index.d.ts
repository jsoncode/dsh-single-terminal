/**
 * dsh-single-terminal —— 插件宿主半边入口。
 *
 * - WebSocket 路由 /api/dsh-single-terminal.ws（webServer.registerUpgrade，exact path）：
 *   鉴权复用宿主 connection.requestRejection（Host/Origin 围栏 + dsh-auth cookie），
 *   升级后交给 TerminalHub 处理 JSON 帧协议；
 * - Config（schemastery）由宿主 Plugins 设置页渲染，热更新经 plugin 重载生效；
 * - 卸载清理：注销路由 + 终止全部 PTY 会话（ctx.effect disposer）。
 */
import type { Context } from '@deepseek-ai/cordis';
import type { CustomShellConfig, TerminalPluginConfig } from './types.ts';
export declare const name = "dsh-single-terminal";
export declare const inject: string[];
export declare const Config: import('@deepseek-ai/schemastery').default<TerminalPluginConfig>;
export declare function apply(ctx: Context, config: TerminalPluginConfig): void;
export type { CustomShellConfig, TerminalPluginConfig };
//# sourceMappingURL=index.d.ts.map