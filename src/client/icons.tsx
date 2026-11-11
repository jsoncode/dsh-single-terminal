/**
 * dsh-single-terminal —— 共享图标（抽屉把手按钮与设置分区导航图标共用）。
 *
 * 终端提示符图标（>_）：填充路径，与宿主图标同风格（currentColor、直角）。
 */

const TERMINAL_PROMPT_PATH =
  'M2.2 3 L8.2 8 L2.2 13 L2.2 10.9 L5.7 8 L2.2 5.1 Z M9 11.6 H13.8 V13.4 H9 Z'

export function TerminalIcon(props: { size?: number }) {
  return (
    <svg width={props.size ?? 16} height={props.size ?? 16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d={TERMINAL_PROMPT_PATH} fill="currentColor" />
    </svg>
  )
}
