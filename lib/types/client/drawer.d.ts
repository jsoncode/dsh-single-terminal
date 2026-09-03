/**
 * dsh-single-terminal —— 底部抽屉（shell.overlay 插槽）。
 *
 * - 两种模式：docked（占高度：对 AppFrame 根元素设 inline padding-bottom，把
 *   主内容顶起；找不到 [data-shell-overlay] 锚点时静默降级为浮层）/ overlay（浮层）；
 * - 顶部拖拽条调高度（pointer capture + 帧节流），localStorage 持久化 mode/height；
 * - 组件常挂载（关闭时 display:none），保证 xterm 缓冲与会话不因抽屉开合丢失。
 */
export declare function TerminalDrawer(): import("react").JSX.Element;
//# sourceMappingURL=drawer.d.ts.map