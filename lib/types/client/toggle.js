import { jsx as _jsx } from "react/jsx-runtime";
/**
 * dsh-single-terminal —— 会话头部开关按钮（conversation.session.header.utilities 插槽）。
 *
 * 图标为 panel-bottom（面板底部条填充）样式：横长矩形（16×12，高 < 宽）、
 * 直角无圆角，与宿主图标同风格（currentColor 填充）；hover 气泡用宿主
 * Tooltip（label 传 thunk，气泡显示时求值，语言切换即生效）。
 *
 * 会话作用域标准 props 带 sessionId 与全局 useWorkspaces：据此解析当前会话
 * 归属的工作区根目录并同步给 controller，让新建终端自动落在工作区路径。
 */
import { useEffect } from 'react';
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives';
import { terminal, useDrawerState } from "./controller.js";
import { t } from "./i18n.js";
const noWorkspaces = () => null;
/** 外框 16×12（y 2→14）+ 上部镂空窗（壁 1.4），底部条 4.2 填充；全部直角。 */
const PANEL_BOTTOM_PATH = 'M0 2 H16 V14 H0 Z M1.4 3.4 H14.6 V9.8 H1.4 Z';
function PanelBottomIcon(props) {
    return (_jsx("svg", { width: props.size ?? 16, height: props.size ?? 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: _jsx("path", { d: PANEL_BOTTOM_PATH, fillRule: "evenodd", clipRule: "evenodd", fill: "currentColor" }) }));
}
export function TerminalToggle(props) {
    const state = useDrawerState();
    const { sessionId, useWorkspaces = noWorkspaces } = props;
    const workspacePath = useWorkspaces((snapshot) => {
        if (sessionId === undefined)
            return null;
        return snapshot.items.find((row) => row.sessionIds.includes(sessionId))?.path ?? null;
    });
    useEffect(() => {
        terminal.setWorkspaceCwd(workspacePath);
        return () => { terminal.setWorkspaceCwd(null); };
    }, [workspacePath]);
    return (_jsx(Tooltip, { label: () => t('terminal.toggleTip'), side: "bottom", children: _jsx("button", { type: "button", className: `dst-headbtn${state.open ? ' active' : ''}`, "aria-label": t('terminal.toggleTip'), onClick: () => { terminal.toggle(); }, children: _jsx(PanelBottomIcon, { size: 16 }) }) }));
}
