/**
 * dsh-single-terminal —— 宿主主题跟随。
 *
 * 宿主把解析后的主题投影到 document：`body[data-ds-dark-theme]` 选择暗色
 * token 调色板，alias 变量（--dsw-alias-*）以 CSS 变量形式定义在 body 上
 * （自定义主题也会覆盖）。CSS 侧直接消费变量自动跟随；xterm 调色板无法用
 * CSS，这里观察 body 属性变化，并从 computed alias 值现算 bg/fg/光标色，
 * 保证与宿主表面同色。
 */

import { useSyncExternalStore } from 'react'
import type { ITheme } from '@xterm/xterm'

const listeners = new Set<() => void>()
let cachedDark: boolean | null = null

function resolveDark(): boolean {
  return document.body.hasAttribute('data-ds-dark-theme')
}

function handleMutations(): void {
  const next = resolveDark()
  if (next === cachedDark) return
  cachedDark = next
  for (const listener of listeners) listener()
}

let observed = false

function subscribe(listener: () => void): () => void {
  if (!observed) {
    observed = true
    cachedDark = resolveDark()
    new MutationObserver(handleMutations).observe(document.body, {
      attributes: true,
      attributeFilter: ['data-ds-dark-theme'],
    })
  }
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useDark(): boolean {
  return useSyncExternalStore(subscribe, () => {
    if (cachedDark === null) cachedDark = resolveDark()
    return cachedDark
  })
}

let probe: HTMLSpanElement | null = null

/** 读取 body 上 alias 变量并序列化成 rgb()/rgba()（经探针元素走 computed color）。 */
function readRgb(varName: string): string | null {
  if (probe === null) {
    probe = document.createElement('span')
    probe.style.display = 'none'
    document.body.append(probe)
  }
  probe.style.color = `var(${varName})`
  const color = getComputedStyle(probe).color
  return /^rgba?\(/.test(color) ? color : null
}

function withAlpha(color: string | null, alpha: number, fallback: string): string {
  const match = color?.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  const r = match?.[1]
  const g = match?.[2]
  const b = match?.[3]
  return r !== undefined && g !== undefined && b !== undefined
    ? `rgba(${r}, ${g}, ${b}, ${alpha})`
    : fallback
}

/** VS Code Dark+ / Light+ 的 ANSI 区；界面色（bg/fg/光标/选区）取宿主 token。 */
const ANSI_DARK = {
  black: '#000000', red: '#cd3131', green: '#0dbc79', yellow: '#e5e510',
  blue: '#2472c8', magenta: '#bc3fbc', cyan: '#11a8cd', white: '#e5e5e5',
  brightBlack: '#666666', brightRed: '#f14c4c', brightGreen: '#23d18b',
  brightYellow: '#f5f543', brightBlue: '#3b8eea', brightMagenta: '#d670d6',
  brightCyan: '#29b8db', brightWhite: '#ffffff',
}
const ANSI_LIGHT = {
  black: '#000000', red: '#cd3131', green: '#00bc00', yellow: '#949800',
  blue: '#0451a5', magenta: '#bc05bc', cyan: '#0598bc', white: '#555555',
  brightBlack: '#666666', brightRed: '#cd3131', brightGreen: '#14ce14',
  brightYellow: '#b5ba00', brightBlue: '#0451a5', brightMagenta: '#bc05bc',
  brightCyan: '#0598bc', brightWhite: '#a5a5a5',
}

/** 浮层模式终端背景带 alpha，让磨砂层透出；占高度模式不透明（配 WebGL）。 */
const OVERLAY_BG_ALPHA = 0.4

export function xtermTheme(dark: boolean, overlay: boolean): ITheme {
  const alpha = overlay ? OVERLAY_BG_ALPHA : 1
  return {
    background: withAlpha(readRgb('--dsw-alias-bg-layer-1'), alpha,
      dark ? 'rgba(30, 32, 36, 0.4)' : 'rgba(255, 255, 255, 0.4)'),
    foreground: readRgb('--dsw-alias-label-primary') ?? (dark ? '#e6e6e6' : '#383a42'),
    cursor: readRgb('--dsw-alias-state-business-primary') ?? (dark ? '#86a5fe' : '#4176e6'),
    cursorAccent: withAlpha(readRgb('--dsw-alias-bg-layer-1'), 1, dark ? '#232529' : '#ffffff'),
    selectionBackground: readRgb('--dsw-alias-interactive-bg-active')
      ?? (dark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(38, 49, 72, 0.1)'),
    ...(dark ? ANSI_DARK : ANSI_LIGHT),
  }
}
