/**
 * dsh-single-terminal —— 双语字典（zh/en），语言由宿主 locale 服务驱动。
 */

export type Lang = 'zh' | 'en'

let lang: Lang = 'en'

export function setLang(next: Lang): void {
  lang = next
}

export function getLang(): Lang {
  return lang
}

const DICT: Record<Lang, Record<string, string>> = {
  zh: {
    'terminal.title': '终端',
    'terminal.toggleTip': '打开终端面板 Alt+C',
    'terminal.new': '新建终端',
    'terminal.defaultShell': '默认',
    'terminal.closeTab': '关闭终端',
    'terminal.minimize': '最小化',
    'terminal.mode.dock': '占高度',
    'terminal.mode.overlay': '浮层',
    'terminal.mode.toggle': '切换抽屉模式',
    'terminal.status.connected': '已连接',
    'terminal.status.connecting': '连接中…',
    'terminal.status.reconnecting': '重连中…',
    'terminal.status.disconnected': '已断开',
    'terminal.exited': '已退出',
    'terminal.empty': '暂无终端会话，点击 ＋ 新建',
    'terminal.error.limit': '终端数量已达上限',
    'terminal.error.spawn': '终端启动失败',
  },
  en: {
    'terminal.title': 'Terminal',
    'terminal.toggleTip': 'Open terminal panel Alt+C',
    'terminal.new': 'New terminal',
    'terminal.defaultShell': 'Default',
    'terminal.closeTab': 'Close terminal',
    'terminal.minimize': 'Minimize',
    'terminal.mode.dock': 'Docked',
    'terminal.mode.overlay': 'Overlay',
    'terminal.mode.toggle': 'Toggle drawer mode',
    'terminal.status.connected': 'Connected',
    'terminal.status.connecting': 'Connecting…',
    'terminal.status.reconnecting': 'Reconnecting…',
    'terminal.status.disconnected': 'Disconnected',
    'terminal.exited': 'Exited',
    'terminal.empty': 'No terminal sessions yet — click + to create one',
    'terminal.error.limit': 'Terminal session limit reached',
    'terminal.error.spawn': 'Failed to spawn terminal',
  },
}

export function t(key: string): string {
  return DICT[lang][key] ?? DICT.en[key] ?? key
}
