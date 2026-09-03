/**
 * dsh-single-terminal —— 抽屉全局样式 + 内嵌 xterm.css（构建期生成注入）。
 *
 * 颜色全部消费宿主 alias token（body 上的 --dsw-alias-*，随
 * body[data-ds-dark-theme] 与自定义主题翻转），不自带调色板；两种抽屉模式
 * 统一磨砂半透明样式（backdrop-filter 高斯模糊 + 终端区走默认 DOM 渲染器的
 * alpha canvas，WebGL 已移除）。开合动画走 transform 滑出 +
 * visibility（布局常驻，xterm 不因开合重排），曲线用宿主
 * --ds-ease-in-out / --ds-transition-duration-slow，并尊重系统减动效设置。
 * 终端入口按钮为吸附抽屉右上角的把手（.dst-entry），随抽屉滑动。
 */
import { XTERM_CSS } from "./xterm-css.js";
const DRAWER_CSS = `
.dst-drawer {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: var(--dst-height, 360px);
  min-height: 140px;
  display: flex;
  flex-direction: column;
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
/* 磨砂底色独立在 ::before：backdrop-filter 若直接挂在含文字的容器上，Chromium
   会把容器内容（含终端文字）纳入离屏 render surface 再合成，文字被重采样发虚、
   叠加描边后形同阴影。::before 只滤背景，文字在正常层渲染保持锐利。
   两种抽屉模式统一磨砂半透明；占高度模式下模糊发生在被顶起的内容区之上。 */
.dst-drawer::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: rgba(127, 127, 127, 0.35);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 35%, transparent);
  -webkit-backdrop-filter: blur(22px) saturate(1.4);
  backdrop-filter: blur(22px) saturate(1.4);
}
.dst-drawer.open {
  /* 展开态用 none 而非 translateY(0)：稳态下不带 transform，利于合成器整层平铺。 */
  transform: none;
  visibility: visible;
  transition:
    transform var(--ds-transition-duration-slow, 0.3s) var(--ds-ease-in-out, cubic-bezier(0.4, 0, 0.2, 1));
}
@media (prefers-reduced-motion: reduce) {
  .dst-drawer { transition: none; }
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
  position: absolute; right: 0; bottom: calc(100% + 6px); min-width: 170px;
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
/* 默认 shell 标记：菜单项右端的浅色小字。 */
.dst-menudfl { margin-left: auto; padding-left: 16px; opacity: 0.55; font-size: 11px; }
/* 终端区不带背景：直接透出抽屉容器的磨砂底色，与头部一致。 */
.dst-body { flex: 1; min-height: 0; position: relative; padding: 2px 6px 6px; }
/* 半透明底（合成层）使浏览器放弃亚像素抗锯齿、字形偏细；用 currentColor 细描边
   补偿视觉字重。描边不占字宽，xterm 列对齐不变；0.2px 足够，过粗会晕开出毛边。 */
.dst-drawer .xterm { -webkit-text-stroke: 0.2px currentColor; }
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
/* 终端入口按钮 = 抽屉把手：贴在抽屉右上角外沿（bottom: 100%），随抽屉的
   transform 一同滑动——展开时吸附在终端右上角，收起后停在 frame 右下角。
   抽屉收起态整树 visibility: hidden，这里显式覆写 visible，保证收起后把手
   仍可见可点（visibility 的子树覆写语义）。背景与抽屉同为磨砂半透明，
   收起时浮在页面内容之上；底部无边框，与抽屉顶边框线自然闭合。 */
.dst-entry {
  position: absolute;
  right: 12px;
  bottom: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--dsw-alias-border-l2);
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 75%, transparent);
  -webkit-backdrop-filter: blur(22px) saturate(1.4);
  backdrop-filter: blur(22px) saturate(1.4);
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  visibility: visible;
  z-index: 2;
}
.dst-entry:hover {
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 92%, transparent);
  color: var(--dsw-alias-label-primary);
}
`;
let injected = false;
export function injectStyles() {
    if (injected)
        return;
    injected = true;
    const style = document.createElement('style');
    style.setAttribute('data-plugin', 'dsh-single-terminal');
    style.textContent = XTERM_CSS + DRAWER_CSS;
    document.head.appendChild(style);
}
