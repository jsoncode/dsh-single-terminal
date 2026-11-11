/**
 * dsh-single-terminal —— 双语字典（zh/en），语言由宿主 locale 服务驱动。
 */
let lang = 'en';
export function setLang(next) {
    lang = next;
}
export function getLang() {
    return lang;
}
const DICT = {
    zh: {
        'terminal.title': '终端',
        'terminal.toggleTip': '打开终端面板 Alt+C',
        'terminal.new': '新建终端',
        'terminal.closeTab': '关闭终端',
        'terminal.minimize': '最小化',
        'terminal.mode.dock': '置低',
        'terminal.mode.overlay': '浮层',
        'terminal.mode.toggle': '切换抽屉模式',
        'terminal.exited': '已退出',
        'terminal.empty': '暂无终端会话，点击 ＋ 新建',
        'terminal.error.limit': '终端数量已达上限',
        'terminal.error.spawn': '终端启动失败',
        'settings.nav': '终端',
        'settings.title': '终端抽屉',
        'settings.desc': '在页面底部唤起真实 PTY 终端（xterm.js）：多标签、停靠或浮层两种模式。快捷键 Alt+C，或点击抽屉右上角的把手开合。',
        'settings.open': '打开终端抽屉',
        'settings.openHint': '快捷键 Alt+C',
        'settings.mode': '抽屉模式',
    },
    en: {
        'terminal.title': 'Terminal',
        'terminal.toggleTip': 'Open terminal panel Alt+C',
        'terminal.new': 'New terminal',
        'terminal.closeTab': 'Close terminal',
        'terminal.minimize': 'Minimize',
        'terminal.mode.dock': 'Docked',
        'terminal.mode.overlay': 'Overlay',
        'terminal.mode.toggle': 'Toggle drawer mode',
        'terminal.exited': 'Exited',
        'terminal.empty': 'No terminal sessions yet — click + to create one',
        'terminal.error.limit': 'Terminal session limit reached',
        'terminal.error.spawn': 'Failed to spawn terminal',
        'settings.nav': 'Terminal',
        'settings.title': 'Terminal Drawer',
        'settings.desc': 'A bottom drawer with real PTY terminals (xterm.js): multi-tab, docked or overlay mode. Toggle with Alt+C or the drawer handle at its top-right corner.',
        'settings.open': 'Open terminal drawer',
        'settings.openHint': 'Shortcut: Alt+C',
        'settings.mode': 'Drawer mode',
    },
};
export function t(key) {
    return DICT[lang][key] ?? DICT.en[key] ?? key;
}
