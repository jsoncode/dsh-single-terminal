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

import { XTERM_CSS } from './xterm-css.ts'

const DRAWER_CSS = `
.dst-drawer {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: var(--dst-height, 360px);
  min-height: 140px;
  display: flex;
  flex-direction: column;
  background: var(--dsw-alias-bg-layer-1);
  border-top: 1px solid var(--dsw-alias-border-l2);
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.2);
  z-index: 5;
  /* 收起态：滑出到 frame 裁剪区外（AppFrame 根 overflow:hidden，不会出滚动条）；
     visibility 延迟到滑出结束后再切，保证收起动画全程可见。 */
  transform: translateY(100%);
  visibility: hidden;
  transition:
    transform var(--ds-transition-duration-slow, 0.3s) var(--ds-ease-in-out, cubic-bezier(0.4, 0, 0.2, 1)),
    visibility 0s linear var(--ds-transition-duration-slow, 0.3s);
}
.dst-drawer.open {
  transform: translateY(0);
  visibility: visible;
  transition:
    transform var(--ds-transition-duration-slow, 0.3s) var(--ds-ease-in-out, cubic-bezier(0.4, 0, 0.2, 1));
}
@media (prefers-reduced-motion: reduce) {
  .dst-drawer { transition: none; }
}
.dst-drawer.overlay {
  background: rgba(127, 127, 127, 0.5);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 50%, transparent);
  -webkit-backdrop-filter: blur(22px) saturate(1.4);
  backdrop-filter: blur(22px) saturate(1.4);
}
.dst-drag { height: 5px; flex: none; cursor: row-resize; touch-action: none; }
.dst-drag:hover { background: var(--dsw-alias-border-l3); }
.dst-head {
  display: flex; align-items: center; gap: 4px;
  height: 36px; flex: none; padding: 0 8px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-secondary);
}
.dst-tabs { display: flex; align-items: center; gap: 2px; flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.dst-tabs::-webkit-scrollbar { display: none; }
.dst-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 8px; border: none; border-radius: 6px;
  background: transparent; color: var(--dsw-alias-label-tertiary); font-size: 12px;
  cursor: pointer; white-space: nowrap;
}
.dst-tab:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dst-tab.active { background: var(--dsw-alias-interactive-bg-active); color: var(--dsw-alias-label-primary); }
.dst-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-success-primary); flex: none; }
.dst-dot.dead { background: var(--dsw-alias-label-tertiary); }
.dst-tabclose {
  display: inline-flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; border: none; border-radius: 4px;
  background: transparent; color: inherit; font-size: 12px; line-height: 1;
  cursor: pointer; padding: 0;
}
.dst-tabclose:hover { background: var(--dsw-alias-interactive-bg-hover-accent); }
.dst-actions { display: flex; align-items: center; gap: 2px; flex: none; }
.dst-conn { width: 8px; height: 8px; border-radius: 50%; flex: none; margin: 0 4px; }
.dst-conn.connected { background: var(--dsw-alias-state-success-primary); }
.dst-conn.connecting, .dst-conn.reconnecting { background: var(--dsw-alias-state-warn-primary); }
.dst-iconbtn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border: none; border-radius: 6px;
  background: transparent; color: inherit; cursor: pointer; padding: 0;
}
.dst-iconbtn:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dst-modebtn {
  display: inline-flex; align-items: center; gap: 4px;
  height: 26px; padding: 0 8px; border: none; border-radius: 6px;
  background: transparent; color: var(--dsw-alias-label-tertiary); font-size: 12px; cursor: pointer;
}
.dst-modebtn:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.dst-menu {
  position: absolute; right: 8px; bottom: 44px; min-width: 170px;
  background: var(--dsw-specific-menu); border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px;
  padding: 4px; z-index: 10; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}
.dst-menuitem {
  display: flex; width: 100%; align-items: center; gap: 8px;
  padding: 6px 10px; border: none; border-radius: 6px;
  background: transparent; color: var(--dsw-alias-label-primary); font-size: 13px;
  cursor: pointer; text-align: left;
}
.dst-menuitem:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dst-body { flex: 1; min-height: 0; position: relative; padding: 2px 6px 6px; background: var(--dsw-alias-bg-base); }
.dst-drawer.overlay .dst-body { background: transparent; }
/* 浮层模式下 backdrop-filter（+ 半透明底）使文字落入合成层，浏览器放弃亚像素
   抗锯齿、字形显细；用 currentColor 细描边补偿视觉字重。描边不占字宽，
   xterm 列对齐不变。 */
.dst-drawer.overlay .xterm { -webkit-text-stroke: 0.3px currentColor; }
.dst-term { width: 100%; height: 100%; }
.dst-empty {
  position: absolute; inset: 0; display: flex;
  align-items: center; justify-content: center;
  color: var(--dsw-alias-label-tertiary); font-size: 13px;
}
.dst-notice {
  position: absolute; left: 50%; transform: translateX(-50%); bottom: 12px;
  max-width: 70%; padding: 6px 12px; border-radius: 8px; z-index: 8;
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 15%, var(--dsw-alias-bg-layer-1));
  color: var(--dsw-alias-state-error-primary); font-size: 12px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dst-headbtn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; padding: 0;
  border: none; border-radius: 6px; background: transparent;
  color: inherit; cursor: pointer;
}
.dst-headbtn:hover, .dst-headbtn.active { background: var(--dsw-alias-interactive-bg-active); }
`

let injected = false

export function injectStyles(): void {
  if (injected) return
  injected = true
  const style = document.createElement('style')
  style.setAttribute('data-plugin', 'dsh-single-terminal')
  style.textContent = XTERM_CSS + DRAWER_CSS
  document.head.appendChild(style)
}
