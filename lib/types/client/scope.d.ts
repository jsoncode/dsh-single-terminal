/**
 * dsh-single-terminal —— 会话作用域桥（conversation.session.header.utilities 插槽）。
 *
 * 终端入口按钮已移入抽屉（drawer.tsx 的 .dst-entry 把手：吸附抽屉右上角，
 * 收起后落在页面右下角），会话头部不再渲染可见 UI。这里保留一个渲染 null
 * 的不可见锚点组件：借助会话作用域标准 props（sessionId + 全局
 * useWorkspaces）解析当前会话归属的工作区根目录并同步给 controller，让新建
 * 终端（含自动新建）落在工作区路径。渲染 null 后 utilities 容器命中宿主
 * `.headerUtilities:empty { display: none }` 规则，头部不留空位。
 */
/** 宿主 WorkspaceView 的结构子集（只取会话归属与磁盘路径）。 */
interface WorkspaceRowLike {
    readonly sessionIds: readonly string[];
    readonly path: string;
}
type UseWorkspaces = (selector: (snapshot: {
    readonly items: readonly WorkspaceRowLike[];
}) => string | null) => string | null;
export declare function SessionWorkspaceBridge(props: {
    sessionId?: string;
    useWorkspaces?: UseWorkspaces;
}): null;
export {};
//# sourceMappingURL=scope.d.ts.map