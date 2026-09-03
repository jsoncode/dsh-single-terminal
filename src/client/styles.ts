/**
 * dsh-single-terminal —— 抽屉全局样式 + 内嵌 xterm.css（构建期生成注入）。
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
  background: #1f2126;
  border-top: 1px solid #3a3d44;
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.25);
  z-index: 5;
}
.dst-drag { height: 5px; flex: none; cursor: row-resize; touch-action: none; }
.dst-drag:hover { background: #4a4d55; }
.dst-head {
  display: flex; align-items: center; gap: 4px;
  height: 36px; flex: none; padding: 0 8px;
  border-bottom: 1px solid #3a3d44;
  color: #c9cdd4;
}
.dst-tabs { display: flex; align-items: center; gap: 2px; flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.dst-tabs::-webkit-scrollbar { display: none; }
.dst-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 8px; border: none; border-radius: 6px;
  background: transparent; color: #9aa0aa; font-size: 12px;
  cursor: pointer; white-space: nowrap;
}
.dst-tab:hover { background: rgba(255, 255, 255, 0.06); }
.dst-tab.active { background: rgba(255, 255, 255, 0.1); color: #eceef1; }
.dst-dot { width: 6px; height: 6px; border-radius: 50%; background: #3fb950; flex: none; }
.dst-dot.dead { background: #6e7278; }
.dst-tabclose {
  display: inline-flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; border: none; border-radius: 4px;
  background: transparent; color: inherit; font-size: 12px; line-height: 1;
  cursor: pointer; padding: 0;
}
.dst-tabclose:hover { background: rgba(255, 255, 255, 0.14); }
.dst-actions { display: flex; align-items: center; gap: 2px; flex: none; }
.dst-conn { width: 8px; height: 8px; border-radius: 50%; flex: none; margin: 0 4px; }
.dst-conn.connected { background: #3fb950; }
.dst-conn.connecting, .dst-conn.reconnecting { background: #d29922; }
.dst-iconbtn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border: none; border-radius: 6px;
  background: transparent; color: inherit; cursor: pointer; padding: 0;
}
.dst-iconbtn:hover { background: rgba(255, 255, 255, 0.1); }
.dst-modebtn {
  display: inline-flex; align-items: center; gap: 4px;
  height: 26px; padding: 0 8px; border: none; border-radius: 6px;
  background: transparent; color: #9aa0aa; font-size: 12px; cursor: pointer;
}
.dst-modebtn:hover { background: rgba(255, 255, 255, 0.1); color: #eceef1; }
.dst-menu {
  position: absolute; right: 8px; bottom: 44px; min-width: 170px;
  background: #26282e; border: 1px solid #3a3d44; border-radius: 8px;
  padding: 4px; z-index: 10; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}
.dst-menuitem {
  display: flex; width: 100%; align-items: center; gap: 8px;
  padding: 6px 10px; border: none; border-radius: 6px;
  background: transparent; color: #d5d8dd; font-size: 13px;
  cursor: pointer; text-align: left;
}
.dst-menuitem:hover { background: rgba(255, 255, 255, 0.08); }
.dst-body { flex: 1; min-height: 0; position: relative; padding: 2px 6px 6px; background: #1a1c20; }
.dst-term { width: 100%; height: 100%; }
.dst-empty {
  position: absolute; inset: 0; display: flex;
  align-items: center; justify-content: center;
  color: #6e7278; font-size: 13px;
}
.dst-notice {
  position: absolute; left: 50%; transform: translateX(-50%); bottom: 12px;
  max-width: 70%; padding: 6px 12px; border-radius: 8px; z-index: 8;
  background: #4a2226; color: #ffb4b4; font-size: 12px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dst-headbtn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; padding: 0;
  border: none; border-radius: 6px; background: transparent;
  color: inherit; cursor: pointer;
}
.dst-headbtn:hover, .dst-headbtn.active { background: rgba(128, 128, 128, 0.18); }
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
