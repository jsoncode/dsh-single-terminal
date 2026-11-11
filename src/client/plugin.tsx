/**
 * dsh-single-terminal —— 浏览器半边插件主体（slots 注册）。
 *
 * - settings.section（id 同包名，order 120，label 用 i18n thunk）：设置弹框
 *   左侧菜单的全局入口页（主按钮打开抽屉 + 入口/设置类内容），配
 *   settings.section.icon（同 id 的导航图标）——按产品要求入口只放这里，
 *   不再注册页面角落/左下角的全局入口；
 * - shell.overlay：底部终端抽屉本体（把手/最小化等抽屉自身 chrome 保留，
 *   随抽屉吸附其右上角外沿）；
 * - conversation.session.header.utilities：不可见的会话作用域桥（渲染 null，
 *   只同步当前会话的工作区 cwd，头部无可见 UI）；
 * - Alt+C 快捷键开关抽屉（ctx.effect 挂窗级监听，卸载自动清理；焦点在终端
 *   输入区时放行，让 shell 收到 ESC c 而不误触）；
 * - 语言跟随宿主 locale 服务（软依赖，缺失时回退 en）。
 */

import { terminal } from './controller.ts'
import { TerminalDrawer } from './drawer.tsx'
import { setLang, t } from './i18n.ts'
import { SessionWorkspaceBridge } from './scope.tsx'
import { SettingsSectionIcon, TerminalSettingsSection } from './settings.tsx'
import { injectStyles } from './styles.ts'

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

      // 全局入口 = 设置弹框左侧菜单分区（settings.section 由宿主 sidebar.settings
      // 项挂载后才存在，故必须包在 inject 里；label 传 thunk，宿主每次投影
      // 重读，语言切换无需重注册）。
      slots.inject('settings.section', () => slots.register(
        { name: 'settings.section', id: 'dsh-single-terminal', order: 120, label: () => t('settings.nav') },
        TerminalSettingsSection,
      ))
      slots.inject('settings.section.icon', () => slots.register(
        { name: 'settings.section.icon', id: 'dsh-single-terminal', order: 120, label: () => t('settings.nav') },
        SettingsSectionIcon,
      ))

      // 底部终端抽屉（frame 级浮层，additive list 插槽）：抽屉本体 + 把手等
      // 自身 chrome；不是全局入口注册。
      slots.inject('shell.overlay', () => slots.register(
        { name: 'shell.overlay', id: 'dsh-single-terminal', order: 50 },
        TerminalDrawer,
      ))

      // 会话作用域桥：入口按钮已移入抽屉把手，头部只留这个渲染 null 的锚点，
      // 用于把当前会话的工作区根目录同步给 controller（新建终端的 cwd）。
      slots.inject('conversation.session.header.utilities', () => slots.register(
        { name: 'conversation.session.header.utilities', id: 'dsh-single-terminal-scope', order: 100 },
        SessionWorkspaceBridge,
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
