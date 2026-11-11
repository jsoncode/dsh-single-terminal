/**
 * dsh-single-terminal —— 浏览器半边插件主体（slots 注册）。
 *
 * - settings.section（id 同包名，order 120，label 用 i18n thunk）：设置弹框
 *   左侧菜单的全局入口页（主按钮打开抽屉 + 入口/设置类内容），配
 *   settings.section.icon（同 id 的导航图标）——按产品要求入口只放这里，
 *   不再注册页面角落/左下角的全局入口；
 * - shell.overlay：底部终端抽屉本体（把手/最小化等抽屉自身 chrome 保留，
 *   随抽屉吸附其右上角外沿）；
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