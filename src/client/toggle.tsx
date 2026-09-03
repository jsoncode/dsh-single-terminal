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

import { useEffect } from 'react'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import { terminal, useDrawerState } from './controller.ts'
import { t } from './i18n.ts'

/** 宿主 WorkspaceView 的结构子集（只取会话归属与磁盘路径）。 */
interface WorkspaceRowLike {
  readonly sessionIds: readonly string[]
  readonly path: string
}

type UseWorkspaces = (
  selector: (snapshot: { readonly items: readonly WorkspaceRowLike[] }) => string | null,
) => string | null

const noWorkspaces: UseWorkspaces = () => null

/** 外框 16×12（y 2→14）+ 上部镂空窗（壁 1.4），底部条 4.2 填充；全部直角。 */
const PANEL_BOTTOM_PATH =
  'M0 2 H16 V14 H0 Z M1.4 3.4 H14.6 V9.8 H1.4 Z'

function PanelBottomIcon(props: { size?: number }) {
  return (
    <svg width={props.size ?? 16} height={props.size ?? 16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d={PANEL_BOTTOM_PATH}
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
      />
    </svg>
  )
}

export function TerminalToggle(props: { sessionId?: string; useWorkspaces?: UseWorkspaces }) {
  const state = useDrawerState()
  const { sessionId, useWorkspaces = noWorkspaces } = props
  const workspacePath = useWorkspaces((snapshot) => {
    if (sessionId === undefined) return null
    return snapshot.items.find((row) => row.sessionIds.includes(sessionId))?.path ?? null
  })
  useEffect(() => {
    terminal.setWorkspaceCwd(workspacePath)
    return () => { terminal.setWorkspaceCwd(null) }
  }, [workspacePath])
  return (
    <Tooltip label={() => t('terminal.toggleTip')} side="bottom">
      <button
        type="button"
        className={`dst-headbtn${state.open ? ' active' : ''}`}
        aria-label={t('terminal.toggleTip')}
        onClick={() => { terminal.toggle() }}
      >
        <PanelBottomIcon size={16} />
      </button>
    </Tooltip>
  )
}
