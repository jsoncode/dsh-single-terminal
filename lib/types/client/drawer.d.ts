/**
 * dsh-single-terminal —— 底部抽屉（shell.overlay 插槽）。
 *
 * - 两种模式：docked（占高度：对 AppFrame 根元素设 inline padding-bottom，把
 *   主内容顶起；找不到 [data-shell-overlay] 锚点时静默降级为浮层）/ overlay（浮层）。
 *   模式只决定停靠行为，样式两种模式统一（磨砂半透明，见 styles.ts）；
 * - 顶部拖拽条调高度（pointer capture + 帧节流），localStorage 持久化 mode/height；
 * - 组件常挂载（关闭时 transform 滑出 + visibility 隐藏，布局不变），保证
 *   xterm 缓冲与会话不因抽屉开合丢失；开合动画见 styles.ts；
 * - 终端入口按钮 = 抽屉把手（.dst-entry，见 styles.ts）：挂在抽屉内、贴在抽屉
 *   右上角外沿，随抽屉一同滑动——展开时吸附在终端右上角，收起后停在页面
 *   右下角（把手覆写 visibility，收起后仍可见可点）。
 */
export declare function TerminalDrawer(): import("react").JSX.Element;
//# sourceMappingURL=drawer.d.ts.map