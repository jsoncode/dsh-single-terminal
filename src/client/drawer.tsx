/**
 * dsh-single-terminal —— 底部抽屉（shell.overlay 插槽）。
 *
 * - 两种模式：docked（占高度：对 AppFrame 根元素设 inline padding-bottom，把
 *   主内容顶起；找不到 [data-shell-overlay] 锚点时静默降级为浮层）/ overlay（浮层）。
 *   模式只决定停靠行为，样式两种模式统一（磨砂半透明，见 styles.ts）；
 * - 顶部拖拽条调高度（pointer capture + 帧节流），localStorage 持久化 mode/height；
 * - 组件常挂载（关闭时 transform 滑出 + visibility 隐藏，布局不变），保证
 *   xterm 缓冲与会话不因抽屉开合丢失；开合动画见 styles.ts；
 * - 终端入口按钮 = 抽屉把手（.dst-entry，见 styles.ts）：挂在抽屉内、贴在抽屉
 *   右上角外沿，随抽屉一同滑动——展开时吸附在终端右上角，收起后停在页面
 *   右下角（把手覆写 visibility，收起后仍可见可点）。
 */

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { terminal, useDrawerState } from './controller.ts'
import { t } from './i18n.ts'
import { TerminalView } from './term.tsx'

const HEIGHT_MIN = 140

/** 终端提示符图标（>_）：填充路径，与宿主图标同风格（currentColor、直角）。 */
const TERMINAL_PROMPT_PATH =
  'M2.2 3 L8.2 8 L2.2 13 L2.2 10.9 L5.7 8 L2.2 5.1 Z M9 11.6 H13.8 V13.4 H9 Z'

function TerminalIcon(props: { size?: number }) {
  return (
    <svg width={props.size ?? 16} height={props.size ?? 16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d={TERMINAL_PROMPT_PATH} fill="currentColor" />
    </svg>
  )
}

function findFrameElement(): HTMLElement | null {
  const overlay = document.querySelector('[data-shell-overlay]')
  const frame = overlay?.parentElement
  return frame instanceof HTMLElement ? frame : null
}

export function TerminalDrawer() {
  const state = useDrawerState()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // 首次挂载即建立 WS 连接（空闲连接开销极小；页面刷新后由 list 帧恢复标签）。
  useEffect(() => { terminal.ensureStarted() }, [])

  // 占高度模式：把 AppFrame 根元素顶起（border-box + padding-bottom）。
  useEffect(() => {
    if (!state.open || state.mode !== 'docked') return
    const frame = findFrameElement()
    if (frame === null) return
    frame.style.boxSizing = 'border-box'
    frame.style.paddingBottom = `${state.height}px`
    return () => {
      frame.style.paddingBottom = ''
      frame.style.boxSizing = ''
    }
  }, [state.open, state.mode, state.height])

  // 菜单外点 / Esc 关闭。
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current !== null && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const availableShells = state.shells.filter((shell) => shell.available)
  // 默认 shell 置顶（稳定排序，其余保持注册表顺序），菜单里加「默认」标记。
  const menuShells = [...availableShells].sort((a, b) =>
    (a.id === state.defaultShell ? -1 : 0) - (b.id === state.defaultShell ? -1 : 0))

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    const handle = event.currentTarget
    const startY = event.clientY
    const startHeight = state.height
    try {
      handle.setPointerCapture(event.pointerId)
    } catch { /* 指针已失效（如合成事件）：仅失去拖出把手的跟随能力 */ }
    let lastAt = 0
    const onMove = (move: PointerEvent) => {
      if (move.timeStamp - lastAt < 16) return
      lastAt = move.timeStamp
      const next = Math.min(window.innerHeight - 100, Math.max(HEIGHT_MIN, startHeight + (startY - move.clientY)))
      terminal.setHeight(next)
    }
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp, { once: true })
    handle.addEventListener('pointercancel', onUp, { once: true })
  }

  return (
    <div
      className={`dst-drawer${state.open ? ' open' : ''}`}
      style={{ '--dst-height': `${state.height}px` } as CSSProperties}
    >
      {/* 终端入口按钮 = 抽屉把手：贴在抽屉右上角外沿，随抽屉开合一同滑动；
          收起后落在页面右下角（样式见 styles.ts .dst-entry）。 */}
      <button
        type="button"
        className="dst-entry"
        aria-label={state.open ? t('terminal.minimize') : t('terminal.toggleTip')}
        title={state.open ? t('terminal.minimize') : t('terminal.toggleTip')}
        onClick={() => { terminal.toggle() }}
      >
        <TerminalIcon size={16} />
      </button>
      <div className="dst-drag" onPointerDown={startDrag} title={t('terminal.mode.toggle')} />
      <div className="dst-head">
        <div className="dst-tabs">
          {state.tabs.map((tab) => (
            <button
              key={tab.id}
              className={`dst-tab${tab.id === state.activeId ? ' active' : ''}`}
              onClick={() => { terminal.setActive(tab.id) }}
              title={tab.cwd}
            >
              <span className={`dst-dot${tab.alive ? '' : ' dead'}`} />
              <span>{tab.label}</span>
              {!tab.alive && <span>{t('terminal.exited')}</span>}
              <span
                className="dst-tabclose"
                role="button"
                title={t('terminal.closeTab')}
                onClick={(event) => {
                  event.stopPropagation()
                  terminal.closeTab(tab.id)
                }}
              >
                ✕
              </span>
            </button>
          ))}
        </div>
        <span className={`dst-conn ${state.conn}`} title={t(`terminal.status.${state.conn}`)} />
        <div className="dst-actions">
          <button
            className="dst-modebtn"
            onClick={() => { terminal.setMode(state.mode === 'docked' ? 'overlay' : 'docked') }}
            title={t('terminal.mode.toggle')}
          >
            {state.mode === 'docked' ? `⬓ ${t('terminal.mode.dock')}` : `◫ ${t('terminal.mode.overlay')}`}
          </button>
          {/* 新建终端（单一入口）：＋ 图标 + 下拉菜单选 shell；默认 shell 置顶。 */}
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button
              className="dst-iconbtn"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => { setMenuOpen((open) => !open) }}
              title={t('terminal.new')}
            >
              ＋
            </button>
            {menuOpen && (
              <div className="dst-menu" role="menu">
                {menuShells.length === 0 && (
                  <div className="dst-menuitem" style={{ cursor: 'default', opacity: 0.6 }}>—</div>
                )}
                {menuShells.map((shell) => (
                  <button
                    key={shell.id}
                    type="button"
                    role="menuitem"
                    className="dst-menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      terminal.newTerminal(shell.id)
                    }}
                  >
                    {shell.name}
                    {shell.id === state.defaultShell && (
                      <span className="dst-menudfl">{t('terminal.defaultShell')}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className="dst-iconbtn"
            onClick={() => { terminal.setOpen(false) }}
            title={t('terminal.minimize')}
            aria-label={t('terminal.minimize')}
          >
            −
          </button>
        </div>
      </div>
      <div className="dst-body">
        {state.tabs.map((tab) => (
          <TerminalView
            key={tab.id}
            tab={tab}
            active={tab.id === state.activeId}
            fontSize={state.fontSize}
            fontFamily={state.fontFamily}
          />
        ))}
        {state.tabs.length === 0 && <div className="dst-empty">{t('terminal.empty')}</div>}
        {state.notice !== null && <div className="dst-notice">{state.notice}</div>}
      </div>
    </div>
  )
}
