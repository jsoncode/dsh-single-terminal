/**
 * dsh-single-terminal —— 底部抽屉（shell.overlay 插槽）。
 *
 * - 两种模式：docked（占高度：对 AppFrame 根元素设 inline padding-bottom，把
 *   主内容顶起；找不到 [data-shell-overlay] 锚点时静默降级为浮层）/ overlay（浮层）；
 * - 顶部拖拽条调高度（pointer capture + 帧节流），localStorage 持久化 mode/height；
 * - 组件常挂载（关闭时 transform 滑出 + visibility 隐藏，布局不变），保证
 *   xterm 缓冲与会话不因抽屉开合丢失；开合动画见 styles.ts。
 */

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { terminal, useDrawerState } from './controller.ts'
import { t } from './i18n.ts'
import { TerminalView } from './term.tsx'

const HEIGHT_MIN = 140

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

  // 菜单外点关闭。
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current !== null && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => { document.removeEventListener('pointerdown', onPointerDown) }
  }, [menuOpen])

  const availableShells = state.shells.filter((shell) => shell.available)

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
      className={`dst-drawer${state.mode === 'overlay' ? ' overlay' : ''}${state.open ? ' open' : ''}`}
      style={{ '--dst-height': `${state.height}px` } as CSSProperties}
    >
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
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button
              className="dst-iconbtn"
              onClick={() => { terminal.newTerminal(state.defaultShell) }}
              title={`${t('terminal.new')}（${availableShells.find((shell) => shell.id === state.defaultShell)?.name ?? state.defaultShell}）`}
            >
              ＋
            </button>
            <button
              className="dst-iconbtn"
              style={{ width: 18 }}
              onClick={() => { setMenuOpen((open) => !open) }}
              title={t('terminal.new')}
            >
              ▸
            </button>
            {menuOpen && (
              <div className="dst-menu">
                {availableShells.length === 0 && (
                  <div className="dst-menuitem" style={{ cursor: 'default', opacity: 0.6 }}>—</div>
                )}
                {availableShells.map((shell) => (
                  <button
                    key={shell.id}
                    className="dst-menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      terminal.newTerminal(shell.id)
                    }}
                  >
                    {shell.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className="dst-iconbtn"
            onClick={() => { terminal.setOpen(false) }}
            title={t('terminal.closeDrawer')}
          >
            ▾
          </button>
        </div>
      </div>
      <div className="dst-body">
        {state.tabs.map((tab) => (
          <TerminalView
            key={tab.id}
            tab={tab}
            active={tab.id === state.activeId}
            overlay={state.mode === 'overlay'}
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
