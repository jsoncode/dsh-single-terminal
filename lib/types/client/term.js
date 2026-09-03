import { jsx as _jsx } from "react/jsx-runtime";
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
import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { terminal } from "./controller.js";
import { useDark, xtermTheme } from "./theme.js";
export function TerminalView(props) {
    const dark = useDark();
    const containerRef = useRef(null);
    const instanceRef = useRef(null);
    const webglRef = useRef(null);
    useEffect(() => {
        const container = containerRef.current;
        if (container === null)
            return;
        const id = props.tab.id;
        const instance = new Terminal({
            fontSize: props.fontSize,
            fontFamily: props.fontFamily,
            cursorBlink: true,
            scrollback: 2000,
            allowTransparency: true,
            theme: xtermTheme(dark, props.overlay),
        });
        instanceRef.current = instance;
        const fit = new FitAddon();
        instance.loadAddon(fit);
        instance.open(container);
        instance.onData((data) => { terminal.sendInput(id, data); });
        instance.onResize(({ cols, rows }) => { terminal.sendResize(id, cols, rows); });
        const unregister = terminal.registerSink(id, { write: (data) => { instance.write(data); } });
        const observer = new ResizeObserver(() => {
            if (container.clientWidth < 10 || container.clientHeight < 10)
                return;
            try {
                fit.fit();
            }
            catch { /* not visible */ }
        });
        observer.observe(container);
        requestAnimationFrame(() => {
            if (container.clientWidth < 10 || container.clientHeight < 10)
                return;
            try {
                fit.fit();
            }
            catch { /* not ready */ }
        });
        return () => {
            observer.disconnect();
            unregister();
            instance.dispose();
            instanceRef.current = null;
            webglRef.current = null;
        };
        // fontSize/fontFamily 变化不重建（配置改动后刷新页面生效）
    }, [props.tab.id]);
    // 渲染器与调色板跟随模式 / 主题（终端实例不重建，滚动缓冲不丢）。
    useEffect(() => {
        const instance = instanceRef.current;
        if (instance === null)
            return;
        if (props.overlay) {
            webglRef.current?.dispose();
            webglRef.current = null;
        }
        else if (webglRef.current === null) {
            try {
                const webgl = new WebglAddon();
                instance.loadAddon(webgl);
                webglRef.current = webgl;
            }
            catch { /* no webgl: default canvas renderer */ }
        }
        instance.options.theme = xtermTheme(dark, props.overlay);
    }, [props.overlay, dark]);
    return (_jsx("div", { ref: containerRef, className: "dst-term", style: { display: props.active ? 'block' : 'none' } }));
}
