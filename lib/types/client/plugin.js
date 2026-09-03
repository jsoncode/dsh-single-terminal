/**
 * dsh-single-terminal —— 浏览器半边插件主体（slots 注册）。
 *
 * - shell.overlay：底部终端抽屉（抽屉右上角外沿吸附终端入口把手，收起后
 *   把手落在页面右下角）；
 * - conversation.session.header.utilities：不可见的会话作用域桥（渲染 null，
 *   只同步当前会话的工作区 cwd，头部无可见 UI）；
 * - Alt+C 快捷键开关抽屉（ctx.effect 挂窗级监听，卸载自动清理；焦点在终端
 *   输入区时放行，让 shell 收到 ESC c 而不误触）；
 * - 语言跟随宿主 locale 服务（软依赖，缺失时回退 en）。
 */
import { terminal } from "./controller.js";
import { TerminalDrawer } from "./drawer.js";
import { setLang } from "./i18n.js";
import { SessionWorkspaceBridge } from "./scope.js";
import { injectStyles } from "./styles.js";
export function createPlugin() {
    return {
        name: 'dsh-single-terminal',
        inject: ['slots', 'locale'],
        apply(ctx) {
            const toLang = (active) => (/^zh/i.test(active) ? 'zh' : 'en');
            const locale = ctx.get('locale');
            if (locale !== undefined) {
                const syncLang = () => { setLang(toLang(locale.getSnapshot().active)); };
                syncLang();
                locale.subscribe(syncLang);
            }
            else if (typeof ctx.on === 'function') {
                ctx.on('locale/change', (snapshot) => {
                    const active = snapshot?.active;
                    if (typeof active === 'string')
                        setLang(toLang(active));
                });
            }
            const slots = ctx.get('slots');
            if (slots === undefined)
                return;
            injectStyles();
            // 底部终端抽屉（frame 级浮层，additive list 插槽）。
            slots.inject('shell.overlay', () => slots.register({ name: 'shell.overlay', id: 'dsh-single-terminal', order: 50 }, TerminalDrawer));
            // 会话作用域桥：入口按钮已移入抽屉把手，头部只留这个渲染 null 的锚点，
            // 用于把当前会话的工作区根目录同步给 controller（新建终端的 cwd）。
            slots.inject('conversation.session.header.utilities', () => slots.register({ name: 'conversation.session.header.utilities', id: 'dsh-single-terminal-scope', order: 100 }, SessionWorkspaceBridge));
            // Alt+C 开关抽屉；焦点在抽屉内（终端输入）时放行，Alt+C 作为 ESC c 发给 shell。
            ctx.effect(() => {
                const onKeyDown = (event) => {
                    if (!event.altKey || event.ctrlKey || event.metaKey || event.code !== 'KeyC')
                        return;
                    if (event.repeat)
                        return;
                    const target = event.target;
                    if (target instanceof Element && target.closest('.dst-drawer') !== null)
                        return;
                    event.preventDefault();
                    terminal.toggle();
                };
                window.addEventListener('keydown', onKeyDown);
                return () => { window.removeEventListener('keydown', onKeyDown); };
            });
        },
    };
}
