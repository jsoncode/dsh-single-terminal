import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * dsh-single-terminal —— 底部抽屉（shell.overlay 插槽）。
 *
 * - 两种模式：docked（置低：对 AppFrame 根元素设 inline padding-bottom，把
 *   主内容顶起；找不到 [data-shell-overlay] 锚点时静默降级为浮层）/ overlay（浮层）。
 *   模式只决定停靠行为，样式两种模式统一（磨砂半透明，见 styles.ts）；
 * - 顶部拖拽条调高度（pointer capture + 帧节流），localStorage 持久化 mode/height；
 * - 组件常挂载（关闭时 transform 滑出 + visibility 隐藏，布局不变），保证
 *   xterm 缓冲与会话不因抽屉开合丢失；开合动画见 styles.ts；
 * - 终端入口按钮 = 抽屉把手（.dst-entry，见 styles.ts）：挂在抽屉内、贴在抽屉
 *   右上角外沿，随抽屉一同滑动——展开时吸附在终端右上角，收起后停在页面
 *   右下角（把手覆写 visibility，收起后仍可见可点）。
 */
import { useEffect } from 'react';
import { terminal, useDrawerState } from "./controller.js";
import { TerminalIcon } from "./icons.js";
import { t } from "./i18n.js";
import { TerminalView } from "./term.js";
const HEIGHT_MIN = 140;
function findFrameElement() {
    const overlay = document.querySelector('[data-shell-overlay]');
    const frame = overlay?.parentElement;
    return frame instanceof HTMLElement ? frame : null;
}
export function TerminalDrawer() {
    const state = useDrawerState();
    // 首次挂载即建立 WS 连接（空闲连接开销极小；页面刷新后由 list 帧恢复标签）。
    useEffect(() => { terminal.ensureStarted(); }, []);
    // 置低模式：把 AppFrame 根元素顶起（border-box + padding-bottom）。
    useEffect(() => {
        if (!state.open || state.mode !== 'docked')
            return;
        const frame = findFrameElement();
        if (frame === null)
            return;
        frame.style.boxSizing = 'border-box';
        frame.style.paddingBottom = `${state.height}px`;
        return () => {
            frame.style.paddingBottom = '';
            frame.style.boxSizing = '';
        };
    }, [state.open, state.mode, state.height]);
    // 新建终端只用第一个可用 shell（Windows 注册表首位是 powershell）；清单未就绪时
    // 回退宿主默认 shell，点击 ＋ 立即创建，不做类型选择。
    const firstShellId = state.shells.find((shell) => shell.available)?.id ?? state.defaultShell;
    const startDrag = (event) => {
        event.preventDefault();
        const handle = event.currentTarget;
        const startY = event.clientY;
        const startHeight = state.height;
        try {
            handle.setPointerCapture(event.pointerId);
        }
        catch { /* 指针已失效（如合成事件）：仅失去拖出把手的跟随能力 */ }
        let lastAt = 0;
        const onMove = (move) => {
            if (move.timeStamp - lastAt < 16)
                return;
            lastAt = move.timeStamp;
            const next = Math.min(window.innerHeight - 100, Math.max(HEIGHT_MIN, startHeight + (startY - move.clientY)));
            terminal.setHeight(next);
        };
        const onUp = () => {
            handle.removeEventListener('pointermove', onMove);
        };
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp, { once: true });
        handle.addEventListener('pointercancel', onUp, { once: true });
    };
    return (_jsxs("div", { className: `dst-drawer${state.open ? ' open' : ''}`, style: { '--dst-height': `${state.height}px` }, children: [_jsx("button", { type: "button", className: "dst-entry", "aria-label": state.open ? t('terminal.minimize') : t('terminal.toggleTip'), title: state.open ? t('terminal.minimize') : t('terminal.toggleTip'), onClick: () => { terminal.toggle(); }, children: _jsx(TerminalIcon, { size: 16 }) }), _jsx("div", { className: "dst-drag", onPointerDown: startDrag, title: t('terminal.mode.toggle') }), _jsxs("div", { className: "dst-head", children: [_jsx("div", { className: "dst-tabs", children: state.tabs.map((tab) => (_jsxs("button", { className: `dst-tab${tab.id === state.activeId ? ' active' : ''}`, onClick: () => { terminal.setActive(tab.id); }, title: tab.cwd, children: [_jsx("span", { className: `dst-dot${tab.alive ? '' : ' dead'}` }), _jsx("span", { children: tab.label }), !tab.alive && _jsx("span", { children: t('terminal.exited') }), _jsx("span", { className: "dst-tabclose", role: "button", title: t('terminal.closeTab'), onClick: (event) => {
                                        event.stopPropagation();
                                        terminal.closeTab(tab.id);
                                    }, children: "\u2715" })] }, tab.id))) }), _jsxs("div", { className: "dst-actions", children: [_jsx("button", { className: "dst-modebtn", onClick: () => { terminal.setMode(state.mode === 'docked' ? 'overlay' : 'docked'); }, title: t('terminal.mode.toggle'), children: state.mode === 'docked' ? `⬓ ${t('terminal.mode.dock')}` : `◫ ${t('terminal.mode.overlay')}` }), _jsx("button", { className: "dst-iconbtn", onClick: () => { terminal.newTerminal(firstShellId); }, title: t('terminal.new'), "aria-label": t('terminal.new'), children: "\uFF0B" })] })] }), _jsxs("div", { className: "dst-body", children: [state.tabs.map((tab) => (_jsx(TerminalView, { tab: tab, active: tab.id === state.activeId, fontSize: state.fontSize, fontFamily: state.fontFamily }, tab.id))), state.tabs.length === 0 && _jsx("div", { className: "dst-empty", children: t('terminal.empty') }), state.notice !== null && _jsx("div", { className: "dst-notice", children: state.notice })] })] }));
}
