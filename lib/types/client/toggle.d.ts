/**
 * dsh-single-terminal —— 会话头部开关按钮（conversation.session.header.utilities 插槽）。
 *
 * 图标为 panel-bottom（面板底部条填充）样式，几何取自宿主 IconPanelLeftOutline16
 * 旋转 -90°，风格与宿主图标一致；hover 气泡用宿主 Tooltip（label 传 thunk，
 * 气泡显示时求值，语言切换即生效）。
 *
 * 会话作用域标准 props 带 sessionId 与全局 useWorkspaces：据此解析当前会话
 * 归属的工作区根目录并同步给 controller，让新建终端自动落在工作区路径。
 */
/** 宿主 WorkspaceView 的结构子集（只取会话归属与磁盘路径）。 */
interface WorkspaceRowLike {
    readonly sessionIds: readonly string[];
    readonly path: string;
}
type UseWorkspaces = (selector: (snapshot: {
    readonly items: readonly WorkspaceRowLike[];
}) => string | null) => string | null;
export declare function TerminalToggle(props: {
    sessionId?: string;
    useWorkspaces?: UseWorkspaces;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=toggle.d.ts.map