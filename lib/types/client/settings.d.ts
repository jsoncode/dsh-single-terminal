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
/** settings.section 的 owner props（外壳只提供 close，见 SettingsSectionOwnerProps）。 */
export interface SettingsSectionProps {
    /** 关闭设置面板（外壳持有开合状态）。 */
    close: () => void;
}
export declare function TerminalSettingsSection(props: SettingsSectionProps): import("react").JSX.Element;
/** settings.section.icon 组件：与 section 同 id 注册，外壳负责按钮与标签。 */
export declare function SettingsSectionIcon(props: {
    size: number;
    active: boolean;
}): import("react").JSX.Element;
//# sourceMappingURL=settings.d.ts.map