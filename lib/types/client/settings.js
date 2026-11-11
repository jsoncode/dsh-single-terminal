import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * dsh-single-terminal —— 设置弹框左侧菜单分区页（settings.section 插槽）。
 *
 * 全局入口按产品要求从页面角落移入设置弹框：本页承载原入口职责（主按钮打开
 * 终端抽屉，随后关闭设置面板让位给抽屉）与入口/设置类内容（抽屉模式切换、
 * Alt+C 快捷键说明）。状态全部读模块级 store（controller.ts），与抽屉本体
 * 共享同一份，无需额外同步。
 *
 * settings.section.icon 的图标组件也在这里导出：宿主按注册 id 匹配 section，
 * 组件收到 { size, active }（外壳负责按钮与标签）。
 */
import { terminal, useDrawerState } from "./controller.js";
import { TerminalIcon } from "./icons.js";
import { t } from "./i18n.js";
const MODES = ['overlay', 'docked'];
export function TerminalSettingsSection(props) {
    const state = useDrawerState();
    const openDrawer = () => {
        terminal.setOpen(true);
        // 设置面板是模态弹框，抽屉在其后不可见：打开抽屉即离开设置。
        props.close();
    };
    return (_jsxs("div", { className: "dsts-page", children: [_jsxs("div", { className: "dsts-title", children: [_jsx(TerminalIcon, { size: 18 }), _jsx("span", { children: t('settings.title') })] }), _jsx("p", { className: "dsts-desc", children: t('settings.desc') }), _jsxs("div", { className: "dsts-actions", children: [_jsx("button", { type: "button", className: "dsts-primary", onClick: openDrawer, children: t('settings.open') }), _jsx("span", { className: "dsts-hint", children: t('settings.openHint') })] }), _jsxs("div", { className: "dsts-row", children: [_jsx("span", { className: "dsts-label", children: t('settings.mode') }), _jsx("div", { className: "dsts-seg", children: MODES.map((mode) => (_jsx("button", { type: "button", className: `dsts-segbtn${state.mode === mode ? ' active' : ''}`, "aria-pressed": state.mode === mode, onClick: () => { terminal.setMode(mode); }, children: t(mode === 'docked' ? 'terminal.mode.dock' : 'terminal.mode.overlay') }, mode))) })] })] }));
}
/** settings.section.icon 组件：与 section 同 id 注册，外壳负责按钮与标签。 */
export function SettingsSectionIcon(props) {
    return _jsx(TerminalIcon, { size: props.size });
}
