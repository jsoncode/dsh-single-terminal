/**
 * dsh-single-terminal —— 单标签终端视图（xterm.js）。
 *
 * - 渲染器按抽屉模式切换：浮层用默认 canvas 渲染器（其上下文带 alpha，配合
 *   allowTransparency 让磨砂背景透出）；占高度加载 WebGL（其 canvas 无 alpha，
 *   用不透明背景换渲染性能）。WebglAddon 的 activate/dispose 即 setRenderer
 *   换入换出，运行时切换安全；
 * - 调色板由 theme.ts 从宿主 alias token 现算，暗色属性翻转时热更新；
 * - ResizeObserver → FitAddon.fit() → onResize 帧上报宿主 resize PTY；
 * - 输出经 controller sink 通道写入（挂载前的字节积压在 controller.pending）。
 */
import { type TabState } from './controller.ts';
export declare function TerminalView(props: {
    tab: TabState;
    active: boolean;
    overlay: boolean;
    fontSize: number;
    fontFamily: string;
}): import("react").JSX.Element;
//# sourceMappingURL=term.d.ts.map