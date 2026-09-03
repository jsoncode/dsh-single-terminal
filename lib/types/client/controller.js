/**
 * dsh-single-terminal —— 客户端控制器（模块级单例）：
 * WebSocket 生命周期、帧路由、sink 注册（xterm 实例）、UI 状态 store。
 *
 * 会话输出在 sink 注册前先积压到 pending（React 挂载/重连时序下不丢字节）；
 * 抽屉关闭不卸载组件（display:none），xterm 缓冲与会话保持。
 */
import { useSyncExternalStore } from 'react';
import { loadJson, saveJson } from "./storage.js";
import { TerminalSocket } from "./ws.js";
class DrawerStore {
    state = {
        open: false,
        mode: loadJson('mode', 'overlay'),
        height: loadJson('height', 360),
        conn: 'connecting',
        tabs: [],
        activeId: null,
        shells: [],
        defaultShell: 'powershell',
        fontSize: 13,
        fontFamily: 'Consolas, "Cascadia Mono", "Courier New", monospace',
        notice: null,
    };
    listeners = new Set();
    subscribe = (listener) => {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    };
    getSnapshot = () => this.state;
    set(patch) {
        this.state = { ...this.state, ...patch };
        for (const listener of this.listeners)
            listener();
    }
    setOpen(open) {
        this.set({ open });
    }
    setMode(mode) {
        saveJson('mode', mode);
        this.set({ mode });
    }
    setHeight(height) {
        saveJson('height', height);
        this.set({ height });
    }
    setConn(conn) {
        this.set({ conn });
    }
    setNotice(notice) {
        this.set({ notice });
    }
    applyHello(frame) {
        this.set({ defaultShell: frame.defaultShell, fontSize: frame.fontSize, fontFamily: frame.fontFamily });
    }
    applyInventory(shells, sessions) {
        const known = new Set(this.state.tabs.map((tab) => tab.id));
        const adopted = sessions.filter((session) => !known.has(session.id));
        if (adopted.length > 0) {
            const tabs = [...this.state.tabs, ...adopted.map(toTab)];
            const activeId = this.state.activeId ?? tabs[tabs.length - 1]?.id ?? null;
            this.set({ shells, tabs, activeId });
        }
        else {
            this.set({ shells });
        }
        return { adopted };
    }
    addSession(session) {
        if (this.state.tabs.some((tab) => tab.id === session.id))
            return;
        this.set({ tabs: [...this.state.tabs, toTab(session)], activeId: session.id });
    }
    setActive(id) {
        this.set({ activeId: id });
    }
    markDead(id, exitCode) {
        this.set({
            tabs: this.state.tabs.map((tab) => (tab.id === id ? { ...tab, alive: false, exitCode } : tab)),
        });
    }
    removeTab(id) {
        const tabs = this.state.tabs.filter((tab) => tab.id !== id);
        const activeId = this.state.activeId === id ? tabs[tabs.length - 1]?.id ?? null : this.state.activeId;
        this.set({ tabs, activeId });
    }
}
function toTab(session) {
    return { id: session.id, shellId: session.shellId, label: session.label, cwd: session.cwd, alive: session.alive, exitCode: session.exitCode };
}
class TerminalController {
    store = new DrawerStore();
    socket = null;
    sinks = new Map();
    pending = new Map();
    noticeTimer = null;
    toggle() {
        this.setOpen(!this.store.getSnapshot().open);
    }
    setOpen(open) {
        this.store.setOpen(open);
        if (open) {
            this.ensureStarted();
            this.maybeAutoOpen();
        }
        else {
            this.autoOpening = false;
        }
    }
    ensureStarted() {
        if (this.socket !== null)
            return;
        this.socket = new TerminalSocket({
            onFrame: (frame) => { this.onFrame(frame); },
            onState: (state) => {
                this.store.setConn(state);
                // 每次连上（含重连）都拉取会话清单：adopt 存活会话 + attach 回放，
                // 完成页面刷新后的标签恢复。
                if (state === 'connected')
                    this.socket?.send({ type: 'list' });
            },
        });
        this.socket.connect();
    }
    // 打开抽屉且没有任何终端时自动新建默认 shell；清单未就绪时由 shells 帧兜底。
    autoOpening = false;
    maybeAutoOpen() {
        const state = this.store.getSnapshot();
        if (!state.open || state.conn !== 'connected' || state.shells.length === 0)
            return;
        if (state.tabs.length > 0 || this.autoOpening)
            return;
        this.autoOpening = true;
        this.newTerminal(state.defaultShell);
    }
    newTerminal(shellId) {
        this.ensureStarted();
        this.socket?.send({ type: 'open', shellId, cols: 80, rows: 24 });
    }
    closeTab(id) {
        this.sinks.delete(id);
        this.pending.delete(id);
        this.store.removeTab(id);
        this.socket?.send({ type: 'close', id });
    }
    setActive(id) {
        this.store.setActive(id);
    }
    setMode(mode) {
        this.store.setMode(mode);
    }
    setHeight(height) {
        this.store.setHeight(height);
    }
    showNotice(message) {
        this.store.setNotice(message);
        if (this.noticeTimer !== null)
            clearTimeout(this.noticeTimer);
        this.noticeTimer = setTimeout(() => {
            this.noticeTimer = null;
            this.store.setNotice(null);
        }, 6000);
    }
    sendInput(id, data) {
        this.socket?.send({ type: 'input', id, data });
    }
    sendResize(id, cols, rows) {
        this.socket?.send({ type: 'resize', id, cols, rows });
    }
    registerSink(id, sink) {
        this.sinks.set(id, sink);
        const buffered = this.pending.get(id);
        if (buffered !== undefined) {
            this.pending.delete(id);
            sink.write(buffered);
        }
        return () => {
            if (this.sinks.get(id) === sink)
                this.sinks.delete(id);
        };
    }
    dispose() {
        this.socket?.dispose();
        this.socket = null;
    }
    writeData(id, data) {
        const sink = this.sinks.get(id);
        if (sink !== undefined) {
            sink.write(data);
            return;
        }
        this.pending.set(id, (this.pending.get(id) ?? '') + data);
    }
    onFrame(frame) {
        switch (frame.type) {
            case 'hello':
                this.store.applyHello(frame);
                break;
            case 'shells': {
                const { adopted } = this.store.applyInventory(frame.shells, frame.sessions);
                for (const session of adopted) {
                    this.socket?.send({ type: 'attach', id: session.id });
                }
                this.maybeAutoOpen();
                break;
            }
            case 'opened':
                this.autoOpening = false;
                this.store.addSession(frame.session);
                break;
            case 'data':
            case 'replay':
                this.writeData(frame.id, frame.data);
                break;
            case 'exit':
                if (frame.closed === true) {
                    this.sinks.delete(frame.id);
                    this.pending.delete(frame.id);
                    this.store.removeTab(frame.id);
                }
                else {
                    this.store.markDead(frame.id, frame.exitCode);
                }
                break;
            case 'error':
                this.autoOpening = false;
                this.showNotice(frame.message);
                break;
        }
    }
}
export const terminal = new TerminalController();
export function useDrawerState() {
    return useSyncExternalStore(terminal.store.subscribe, terminal.store.getSnapshot);
}
