/**
 * dsh-single-terminal —— 抽屉全局样式 + 内嵌 xterm.css（构建期生成注入）。
 *
 * 颜色全部消费宿主 alias token（body 上的 --dsw-alias-*，随
 * body[data-ds-dark-theme] 与自定义主题翻转），不自带调色板；浮层模式整条
 * 抽屉半透明 + backdrop-filter 高斯模糊（终端区依赖默认渲染器的 alpha canvas，
 * 占高度模式不透明、保留 WebGL 渲染器）。开合动画走 transform 滑出 +
 * visibility（布局常驻，xterm 不因开合重排），曲线用宿主
 * --ds-ease-in-out / --ds-transition-duration-slow，并尊重系统减动效设置。
 */
export declare function injectStyles(): void;
//# sourceMappingURL=styles.d.ts.map