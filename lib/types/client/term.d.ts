/**
 * dsh-single-terminal —— 单标签终端视图（xterm.js）。
 *
 * - Webgl 渲染器加载失败时自动回退到默认渲染；
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