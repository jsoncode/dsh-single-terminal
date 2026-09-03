/**
 * dsh-single-terminal —— 宿主主题跟随。
 *
 * 宿主把解析后的主题投影到 document：`body[data-ds-dark-theme]` 选择暗色
 * token 调色板，alias 变量（--dsw-alias-*）以 CSS 变量形式定义在 body 上
 * （自定义主题也会覆盖）。CSS 侧直接消费变量自动跟随；xterm 调色板无法用
 * CSS，这里观察 body 属性变化，并从 computed alias 值现算 bg/fg/光标色，
 * 保证与宿主表面同色。
 */
import type { ITheme } from '@xterm/xterm';
export declare function useDark(): boolean;
export declare function xtermTheme(dark: boolean, overlay: boolean): ITheme;
//# sourceMappingURL=theme.d.ts.map