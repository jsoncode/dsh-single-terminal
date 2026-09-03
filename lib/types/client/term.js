import { jsx as _jsx } from "react/jsx-runtime";
/**
 * dsh-single-terminal —— 单标签终端视图（xterm.js）。
 *
 * - Webgl 渲染器加载失败时自动回退到默认渲染；
 * - ResizeObserver → FitAddon.fit() → onResize 帧上报宿主 resize PTY；
 * - 输出经 controller sink 通道写入（挂载前的字节积压在 controller.pending）。
 */
import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { terminal } from "./controller.js";
const THEME = {
    background: '#1a1c20',
    foreground: '#d4d4d4',
    cursor: '#aeafad',
    cursorAccent: '#1a1c20',
    selectionBackground: '#264f78',
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#ffffff',
};
export function TerminalView(props) {
    const containerRef = useRef(null);
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
            theme: THEME,
        });
        const fit = new FitAddon();
        instance.loadAddon(fit);
        try {
            instance.loadAddon(new WebglAddon());
        }
        catch { /* no webgl: default canvas renderer */ }
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
        };
        // fontSize/fontFamily 变化不重建（配置改动后刷新页面生效）
    }, [props.tab.id]);
    return (_jsx("div", { ref: containerRef, className: "dst-term", style: { display: props.active ? 'block' : 'none' } }));
}
