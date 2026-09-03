/**
 * dsh-single-terminal —— 单标签终端视图（xterm.js）。
 *
 * - 始终用默认 DOM 渲染器 + allowTransparency（磨砂半透明背景在两种抽屉模式
 *   下统一生效；WebGL canvas 无 alpha，已随样式统一移除）；
 * - 调色板由 theme.ts 从宿主 alias token 现算，暗色属性翻转时热更新；
 * - ResizeObserver → FitAddon.fit() → onResize 帧上报宿主 resize PTY；
 * - 输出经 controller sink 通道写入（挂载前的字节积压在 controller.pending）。
 */
import { type TabState } from './controller.ts';
export declare function TerminalView(props: {
    tab: TabState;
    active: boolean;
    fontSize: number;
    fontFamily: string;
}): import("react").JSX.Element;
//# sourceMappingURL=term.d.ts.map