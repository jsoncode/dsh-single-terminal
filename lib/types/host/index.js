/**
 * dsh-single-terminal —— 插件宿主半边入口。
 *
 * - WebSocket 路由 /api/dsh-single-terminal.ws（webServer.registerUpgrade，exact path）：
 *   鉴权复用宿主 connection.requestRejection（Host/Origin 围栏 + dsh-auth cookie），
 *   升级后交给 TerminalHub 处理 JSON 帧协议；
 * - Config（schemastery）由宿主 Plugins 设置页渲染，热更新经 plugin 重载生效；
 * - 卸载清理：注销路由 + 终止全部 PTY 会话（ctx.effect disposer）。
 */
import Schema from '@deepseek-ai/schemastery';
import { TerminalHub } from "./hub.js";
import { ShellRegistry } from "./shells.js";
export const name = 'dsh-single-terminal';
export const inject = ['webServer', 'connection'];
/* ── 配置（docs/develop/basic/config）────────────────────────────── */
const CustomShellSchema = Schema.object({
    id: Schema.string().required().description('唯一 id，如 my-shell'),
    name: Schema.string().required().description('菜单显示名，如 My Shell'),
    command: Schema.string().required().description('可执行文件路径或 PATH 上的命令名，如 nu'),
    args: Schema.array(Schema.string()).default([]).description('启动参数'),
});
export const Config = Schema.object({
    defaultShell: Schema.string().default('powershell')
        .description('默认 shell id：powershell | pwsh | cmd | gitbash | wsl（或自定义 shell 的 id）。非 Windows 下自动回退到 $SHELL/bash'),
    defaultCwd: Schema.string().default('workspace')
        .description('终端初始目录：workspace（当前工作区根，未知时回退用户主目录）| home | 绝对路径'),
    scrollbackLimit: Schema.number().default(200_000)
        .description('重连回放缓冲的字符上限（每会话）'),
    fontSize: Schema.number().default(13).description('终端字号'),
    fontFamily: Schema.string().default('Consolas, "Cascadia Mono", "Courier New", monospace').description('终端字体'),
    customShells: Schema.array(CustomShellSchema).default([]).description('自定义 shell 列表'),
});
/* ── apply ───────────────────────────────────────────────────────── */
const WS_PATH = '/api/dsh-single-terminal.ws';
export function apply(ctx, config) {
    const webServer = ctx.get('webServer');
    const connection = ctx.get('connection');
    if (webServer === undefined || connection === undefined)
        return;
    const registry = new ShellRegistry(config.customShells ?? []);
    const hub = new TerminalHub(config, registry);
    let unregister;
    try {
        unregister = webServer.registerUpgrade({
            path: WS_PATH,
            handler: (req, socket, head) => {
                const rejection = connection.requestRejection(req);
                if (rejection !== undefined) {
                    socket.destroy();
                    return;
                }
                hub.handleUpgrade(req, socket, head);
            },
        });
    }
    catch (e) {
        console.warn('[dsh-single-terminal] register upgrade route failed:', e instanceof Error ? e.message : String(e));
    }
    ctx.effect(() => () => {
        try {
            unregister?.();
        }
        catch { /* already unregistered */ }
        hub.dispose();
    });
}
