/**
 * dsh-single-terminal —— 浏览器半边插件主体（slots 注册）。
 *
 * - shell.overlay：底部终端抽屉；
 * - conversation.session.header.utilities：会话头部开关按钮（宿主 Tooltip 气泡）；
 * - Alt+C 快捷键开关抽屉（ctx.effect 挂窗级监听，卸载自动清理；焦点在终端
 *   输入区时放行，让 shell 收到 ESC c 而不误触）；
 * - 语言跟随宿主 locale 服务（软依赖，缺失时回退 en）。
 */

import { terminal } from './controller.ts'
import { TerminalDrawer } from './drawer.tsx'
import { setLang } from './i18n.ts'
import { injectStyles } from './styles.ts'
import { TerminalToggle } from './toggle.tsx'

/** 宿主 slots 服务最小视图。 */
interface SlotsService {
  inject(name: string, fn: () => unknown): unknown
  register(def: Record<string, unknown>, component: unknown): () => void
}

interface LocaleFace {
  getSnapshot(): { active: string }
  subscribe(fn: () => void): () => void
}

/** 浏览器侧插件上下文（宿主注入）。 */
export interface ClientCtx {
  get<T = unknown>(name: string): T | undefined
  /** 注册随插件卸载自动清理的副作用（回调返回 disposer）。 */
  effect(fn: () => (() => void) | void): unknown
  on?(event: string, listener: (payload: unknown) => void): unknown
}

export interface ClientPluginModule {
  name: string
  inject: string[]
  apply(ctx: ClientCtx): void
}

export function createPlugin(): ClientPluginModule {
  return {
    name: 'dsh-single-terminal',
    inject: ['slots', 'locale'],

    apply(ctx: ClientCtx): void {
      const toLang = (active: string): 'zh' | 'en' => (/^zh/i.test(active) ? 'zh' : 'en')
      const locale = ctx.get<LocaleFace>('locale')
      if (locale !== undefined) {
        const syncLang = (): void => { setLang(toLang(locale.getSnapshot().active)) }
        syncLang()
        locale.subscribe(syncLang)
      } else if (typeof ctx.on === 'function') {
        ctx.on('locale/change', (snapshot: unknown) => {
          const active = (snapshot as { active?: string } | undefined)?.active
          if (typeof active === 'string') setLang(toLang(active))
        })
      }

      const slots = ctx.get<SlotsService>('slots')
      if (slots === undefined) return
      injectStyles()

      // 底部终端抽屉（frame 级浮层，additive list 插槽）。
      slots.inject('shell.overlay', () => slots.register(
        { name: 'shell.overlay', id: 'dsh-single-terminal', order: 50 },
        TerminalDrawer,
      ))

      // 会话头部开关按钮（utilities 区，会话标题行右侧）。
      slots.inject('conversation.session.header.utilities', () => slots.register(
        { name: 'conversation.session.header.utilities', id: 'dsh-single-terminal-toggle', order: 100 },
        TerminalToggle,
      ))

      // Alt+C 开关抽屉；焦点在抽屉内（终端输入）时放行，Alt+C 作为 ESC c 发给 shell。
      ctx.effect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
          if (!event.altKey || event.ctrlKey || event.metaKey || event.code !== 'KeyC') return
          if (event.repeat) return
          const target = event.target
          if (target instanceof Element && target.closest('.dst-drawer') !== null) return
          event.preventDefault()
          terminal.toggle()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => { window.removeEventListener('keydown', onKeyDown) }
      })
    },
  }
}
