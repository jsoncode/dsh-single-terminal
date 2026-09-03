/**
 * 宿主 Context 的服务类型增强（声明合并）。
 *
 * 说明：本插件只用 `ctx.get` 读取宿主服务（配合 src/host/types.ts 里的最小
 * 服务视图），不引入对 @deepseek-ai/* 实现包的值依赖。@deepseek-ai/cordis
 * 自带的 Context 增强经 `export *` 间接导出后在 TS 5.9 下不生效（同
 * dsh-jenkins 的实测），这里在插件侧显式增强。
 */
declare module '@deepseek-ai/cordis' {
  interface Context {
    /** 反射层提供的服务读取（context proxy 运行时委托给 reflect）。 */
    get<T = unknown>(name: string): T | undefined
    /**
     * 注册随插件卸载/热重载自动清理的副作用（回调返回 disposer）。
     * 运行时 Context 代理委托给 fiber.effect；npm cordis 4.x 仅在 Fiber
     * 类型上声明，这里补充 Context 视图（同 vendored cordis 的形态）。
     */
    effect(execute: () => () => unknown, label?: string): () => unknown
  }
}

export {}
