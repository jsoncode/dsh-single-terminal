/**
 * dsh-single-terminal —— 浏览器半边插件主体（slots 注册）。
 *
 * - shell.overlay：底部终端抽屉（抽屉右上角外沿吸附终端入口把手，收起后
 *   把手落在页面右下角）；
 * - conversation.session.header.utilities：不可见的会话作用域桥（渲染 null，
 *   只同步当前会话的工作区 cwd，头部无可见 UI）；
 * - Alt+C 快捷键开关抽屉（ctx.effect 挂窗级监听，卸载自动清理；焦点在终端
 *   输入区时放行，让 shell 收到 ESC c 而不误触）；
 * - 语言跟随宿主 locale 服务（软依赖，缺失时回退 en）。
 */
/** 浏览器侧插件上下文（宿主注入）。 */
export interface ClientCtx {
    get<T = unknown>(name: string): T | undefined;
    /** 注册随插件卸载自动清理的副作用（回调返回 disposer）。 */
    effect(fn: () => (() => void) | void): unknown;
    on?(event: string, listener: (payload: unknown) => void): unknown;
}
export interface ClientPluginModule {
    name: string;
    inject: string[];
    apply(ctx: ClientCtx): void;
}
export declare function createPlugin(): ClientPluginModule;
//# sourceMappingURL=plugin.d.ts.map