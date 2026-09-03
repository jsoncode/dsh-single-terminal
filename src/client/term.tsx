/**
 * dsh-single-terminal —— 单标签终端视图（xterm.js）。
 *
 * - 始终用默认 DOM 渲染器 + allowTransparency（磨砂半透明背景在两种抽屉模式
 *   下统一生效；WebGL canvas 无 alpha，已随样式统一移除）；
 * - 调色板由 theme.ts 从宿主 alias token 现算，暗色属性翻转时热更新；
 * - ResizeObserver → FitAddon.fit() → onResize 帧上报宿主 resize PTY；
 * - 输出经 controller sink 通道写入（挂载前的字节积压在 controller.pending）。
 */

import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { terminal, type TabState } from './controller.ts'
import { useDark, xtermTheme } from './theme.ts'

export function TerminalView(props: {
  tab: TabState
  active: boolean
  fontSize: number
  fontFamily: string
}) {
  const dark = useDark()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const instanceRef = useRef<Terminal | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (container === null) return
    const id = props.tab.id

    const instance = new Terminal({
      fontSize: props.fontSize,
      fontFamily: props.fontFamily,
      cursorBlink: true,
      scrollback: 2000,
      allowTransparency: true,
      theme: xtermTheme(dark),
    })
    instanceRef.current = instance
    const fit = new FitAddon()
    instance.loadAddon(fit)
    instance.open(container)
    instance.onData((data) => { terminal.sendInput(id, data) })
    instance.onResize(({ cols, rows }) => { terminal.sendResize(id, cols, rows) })

    const unregister = terminal.registerSink(id, { write: (data) => { instance.write(data) } })

    const observer = new ResizeObserver(() => {
      if (container.clientWidth < 10 || container.clientHeight < 10) return
      try { fit.fit() } catch { /* not visible */ }
    })
    observer.observe(container)
    requestAnimationFrame(() => {
      if (container.clientWidth < 10 || container.clientHeight < 10) return
      try { fit.fit() } catch { /* not ready */ }
    })

    return () => {
      observer.disconnect()
      unregister()
      instance.dispose()
      instanceRef.current = null
    }
    // fontSize/fontFamily 变化不重建（配置改动后刷新页面生效）
  }, [props.tab.id])

  // 调色板跟随宿主主题（终端实例不重建，滚动缓冲不丢）。
  useEffect(() => {
    const instance = instanceRef.current
    if (instance === null) return
    instance.options.theme = xtermTheme(dark)
  }, [dark])

  return (
    <div
      ref={containerRef}
      className="dst-term"
      style={{ display: props.active ? 'block' : 'none' }}
    />
  )
}
