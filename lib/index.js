import { createRequire } from "node:module";
import Schema from "@deepseek-ai/schemastery";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstatSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, isAbsolute, join } from "node:path";
import { WebSocket, WebSocketServer } from "ws";
//#region src/host/hub.ts
/**
* dsh-single-terminal —— 终端 Hub：PTY 会话管理 + WebSocket 帧协议。
*
* - PTY 经插件自身依赖 node-pty（原生模块，external）直连 ConPTY/POSIX pty，
*   获得完整 resize/kill/数据流控制（宿主 ctx.subprocess 的 TerminalHandle
*   接口不暴露 resize，无法满足抽屉尺寸跟随）；
* - 会话与 WebSocket 连接解耦：页面刷新/抽屉关闭后会话保活，重连后 attach
*   回放环形缓冲（容量 scrollbackLimit）；
* - 多浏览器标签页可同时 attach 同一会话：输出广播、输入合并。
*/
const nodePty = createRequire(import.meta.url)("node-pty");
const MAX_SESSIONS = 20;
const INPUT_LIMIT = 65536;
const COLS_MIN = 2;
const COLS_MAX = 500;
const ROWS_MIN = 2;
const ROWS_MAX = 300;
const clamp = (value, min, max) => Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : min;
var TerminalHub = class {
	config;
	registry;
	wss = new WebSocketServer({ noServer: true });
	sockets = /* @__PURE__ */ new Set();
	sessions = /* @__PURE__ */ new Map();
	nextSocketId = 0;
	constructor(config, registry) {
		this.config = config;
		this.registry = registry;
		this.wss.on("connection", (socket) => {
			this.handleConnection(socket);
		});
	}
	/** webServer.registerUpgrade 的 handler 入口（鉴权由插件入口完成后调用）。 */
	handleUpgrade(req, socket, head) {
		this.wss.handleUpgrade(req, socket, head, (ws) => {
			this.wss.emit("connection", ws, req);
		});
	}
	/** 插件卸载：终止全部会话并断开所有连接。 */
	dispose() {
		console.log(`[dsh-single-terminal] hub dispose (${this.sessions.size} sessions, ${this.sockets.size} sockets)`);
		for (const session of this.sessions.values()) this.killSession(session);
		this.sessions.clear();
		for (const socket of this.sockets) try {
			socket.terminate();
		} catch {}
		this.sockets.clear();
	}
	handleConnection(socket) {
		const sid = ++this.nextSocketId;
		this.sockets.add(socket);
		console.log(`[dsh-single-terminal] ws#${sid} connected (total ${this.sockets.size})`);
		socket.on("message", (raw) => {
			this.dispatch(socket, raw, sid);
		});
		socket.on("close", () => {
			this.sockets.delete(socket);
			console.log(`[dsh-single-terminal] ws#${sid} closed (total ${this.sockets.size})`);
		});
		socket.on("error", () => {
			this.sockets.delete(socket);
		});
		this.send(socket, {
			type: "hello",
			platform: process.platform,
			defaultShell: this.registry.defaultShellId(this.config.defaultShell),
			fontSize: this.config.fontSize,
			fontFamily: this.config.fontFamily
		});
	}
	dispatch(socket, raw, sid) {
		let frame;
		try {
			frame = JSON.parse(String(raw));
		} catch {
			return;
		}
		if (frame.type !== "input" && frame.type !== "resize") {
			const detail = "id" in frame ? ` id=${String(frame.id).slice(0, 8)}` : "";
			console.log(`[dsh-single-terminal] ws#${sid} <- ${frame.type}${detail}`);
		}
		switch (frame.type) {
			case "ping":
				this.send(socket, { type: "pong" });
				break;
			case "list":
				this.send(socket, this.snapshotFrame());
				break;
			case "open":
				this.open(frame.shellId, frame.cols, frame.rows, frame.cwd);
				break;
			case "input": {
				const session = this.sessions.get(frame.id);
				if (session === void 0 || !session.alive) break;
				try {
					session.pty.write(frame.data.length > INPUT_LIMIT ? frame.data.slice(0, INPUT_LIMIT) : frame.data);
				} catch {}
				break;
			}
			case "resize": {
				const session = this.sessions.get(frame.id);
				if (session === void 0 || !session.alive) break;
				try {
					session.pty.resize(clamp(frame.cols, COLS_MIN, COLS_MAX), clamp(frame.rows, ROWS_MIN, ROWS_MAX));
				} catch {}
				break;
			}
			case "attach": {
				const session = this.sessions.get(frame.id);
				if (session === void 0) break;
				this.send(socket, {
					type: "replay",
					id: session.id,
					data: session.buffer
				});
				if (!session.alive) this.send(socket, {
					type: "exit",
					id: session.id,
					exitCode: session.exitCode,
					signal: session.signal
				});
				break;
			}
			case "close": this.close(frame.id);
		}
	}
	open(shellId, cols, rows, cwdOverride) {
		if (this.sessions.size >= MAX_SESSIONS) {
			this.broadcast({
				type: "error",
				message: "终端数量已达上限 / terminal session limit reached"
			});
			return;
		}
		const shell = this.registry.resolve(shellId);
		if (shell === null) {
			this.broadcast({
				type: "error",
				message: `未知或不可用的 shell：「${shellId}」/ unknown or unavailable shell`
			});
			return;
		}
		const cwd = this.resolveCwd(cwdOverride);
		const env = { ...process.env };
		if (process.platform !== "win32") env.TERM = "xterm-256color";
		let pty;
		try {
			pty = nodePty.spawn(shell.file, shell.args, {
				name: "xterm-256color",
				cols: clamp(cols, COLS_MIN, COLS_MAX),
				rows: clamp(rows, ROWS_MIN, ROWS_MAX),
				cwd,
				env
			});
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			this.broadcast({
				type: "error",
				message: `无法启动 ${shell.name} / failed to spawn ${shell.name}: ${message}`
			});
			return;
		}
		const session = {
			id: randomUUID(),
			shell,
			cwd,
			pty,
			buffer: "",
			alive: true,
			closing: false,
			exitCode: null,
			signal: null
		};
		this.sessions.set(session.id, session);
		console.log(`[dsh-single-terminal] session ${session.id.slice(0, 8)} opened shell=${shell.id} pid=${pty.pid} cwd=${cwd} (${this.sessions.size} total)`);
		pty.onData((data) => {
			this.appendBuffer(session, data);
			this.broadcast({
				type: "data",
				id: session.id,
				data
			});
		});
		pty.onExit(({ exitCode, signal }) => {
			session.alive = false;
			session.exitCode = exitCode;
			session.signal = typeof signal === "number" ? signal : null;
			if (this.sessions.has(session.id)) {
				this.broadcast({
					type: "exit",
					id: session.id,
					exitCode: session.exitCode,
					signal: session.signal
				});
				this.sessions.delete(session.id);
				console.log(`[dsh-single-terminal] session ${session.id.slice(0, 8)} (pid ${session.pty.pid}) exited code=${exitCode}`);
			}
		});
		this.broadcast({
			type: "opened",
			session: this.sessionInfo(session)
		});
	}
	close(id) {
		const session = this.sessions.get(id);
		if (session === void 0) return;
		console.log(`[dsh-single-terminal] closing session ${id.slice(0, 8)} (pid ${session.pty.pid})`);
		this.sessions.delete(id);
		if (!session.alive) {
			this.broadcast({
				type: "exit",
				id,
				exitCode: session.exitCode,
				signal: session.signal,
				closed: true
			});
			return;
		}
		session.closing = true;
		this.killSession(session);
		this.broadcast({
			type: "exit",
			id,
			exitCode: null,
			signal: null,
			closed: true
		});
	}
	killSession(session) {
		try {
			session.pty.kill();
		} catch {}
		if (process.platform === "win32") try {
			spawn("taskkill", [
				"/T",
				"/F",
				"/PID",
				String(session.pty.pid)
			], { stdio: "ignore" });
		} catch {}
		else try {
			process.kill(-session.pty.pid, "SIGKILL");
		} catch {}
	}
	resolveCwd(override) {
		const validDirectory = (path) => {
			try {
				return statSync(path).isDirectory();
			} catch {
				return false;
			}
		};
		if (override !== void 0) {
			const trimmed = override.trim();
			if (trimmed.length > 0 && isAbsolute(trimmed) && validDirectory(trimmed)) return trimmed;
		}
		const configured = (this.config.defaultCwd ?? "workspace").trim();
		if (configured.length > 0 && configured !== "workspace" && configured !== "home" && isAbsolute(configured) && validDirectory(configured)) return configured;
		return homedir();
	}
	appendBuffer(session, data) {
		session.buffer += data;
		const limit = this.config.scrollbackLimit;
		if (session.buffer.length > limit) session.buffer = session.buffer.slice(session.buffer.length - limit);
	}
	snapshotFrame() {
		return {
			type: "shells",
			defaultShell: this.registry.defaultShellId(this.config.defaultShell),
			shells: this.registry.list(),
			sessions: [...this.sessions.values()].map((session) => this.sessionInfo(session))
		};
	}
	sessionInfo(session) {
		return {
			id: session.id,
			shellId: session.shell.id,
			label: session.shell.name,
			cwd: session.cwd,
			alive: session.alive,
			pid: session.pty.pid,
			exitCode: session.exitCode,
			signal: session.signal
		};
	}
	send(socket, frame) {
		if (socket.readyState !== WebSocket.OPEN) return;
		try {
			socket.send(JSON.stringify(frame));
		} catch {}
	}
	broadcast(frame) {
		for (const socket of this.sockets) this.send(socket, frame);
	}
};
//#endregion
//#region src/host/shells.ts
/**
* dsh-single-terminal —— shell 注册表与探测。
*
* 探测范式对齐宿主 packages/shell/pwsh-local/src/resolve.ts：
* 已知路径 + PATH 逐项探测 + lstatSync(isFile||isSymbolicLink)，
* 不用注册表 / where.exe。检测不到的 shell available=false（客户端隐藏）。
*/
function isFileLike(path) {
	try {
		const stat = lstatSync(path);
		return stat.isFile() || stat.isSymbolicLink();
	} catch {
		return false;
	}
}
function firstExisting(paths) {
	for (const path of paths) if (path.length > 0 && isFileLike(path)) return path;
	return null;
}
function pathEntries(env) {
	return (env.PATH ?? "").split(delimiter).map((entry) => entry.trim().replace(/^"|"$/g, "")).filter((entry) => entry.length > 0);
}
/** PATH 逐项探测一个裸可执行名（Windows 附加 PATHEXT 扩展名）。 */
function probeOnPath(name, env, platform) {
	const extensions = platform === "win32" ? (env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter((ext) => ext.length > 0) : [""];
	const candidates = [];
	for (const entry of pathEntries(env)) for (const ext of extensions) candidates.push(join(entry, name + ext));
	return firstExisting(candidates);
}
const WINDOWS_BUILTINS = [
	{
		id: "powershell",
		name: "PowerShell",
		platforms: ["win32"],
		resolve: (env) => {
			const systemRoot = env.SystemRoot ?? "C:\\Windows";
			const file = firstExisting([join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")]);
			return file === null ? null : {
				file,
				args: []
			};
		}
	},
	{
		id: "pwsh",
		name: "PowerShell 7",
		platforms: [
			"win32",
			"darwin",
			"linux"
		],
		resolve: (env, platform) => {
			const candidates = [];
			if (platform === "win32") {
				const programFiles = env.ProgramFiles ?? "C:\\Program Files";
				candidates.push(join(programFiles, "PowerShell", "7", "pwsh.exe"));
				for (const entry of pathEntries(env)) candidates.push(join(entry, "pwsh.exe"));
			} else candidates.push(...pathEntries(env).map((entry) => join(entry, "pwsh")));
			const file = firstExisting(candidates);
			return file === null ? null : {
				file,
				args: []
			};
		}
	},
	{
		id: "cmd",
		name: "CMD",
		platforms: ["win32"],
		resolve: (env) => {
			const systemRoot = env.SystemRoot ?? "C:\\Windows";
			const file = firstExisting([join(systemRoot, "System32", "cmd.exe")]);
			return file === null ? null : {
				file,
				args: []
			};
		}
	},
	{
		id: "gitbash",
		name: "Git Bash",
		platforms: ["win32"],
		resolve: (env) => {
			const programFiles = env.ProgramFiles ?? "C:\\Program Files";
			const programFilesX86 = env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
			const localAppData = env.LocalAppData ?? "";
			const file = firstExisting([
				join(programFiles, "Git", "bin", "bash.exe"),
				join(programFiles, "Git", "usr", "bin", "bash.exe"),
				join(programFilesX86, "Git", "bin", "bash.exe"),
				localAppData.length > 0 ? join(localAppData, "Programs", "Git", "bin", "bash.exe") : ""
			]);
			return file === null ? null : {
				file,
				args: ["-i"]
			};
		}
	},
	{
		id: "wsl",
		name: "WSL",
		platforms: ["win32"],
		resolve: (env) => {
			const systemRoot = env.SystemRoot ?? "C:\\Windows";
			const file = firstExisting([join(systemRoot, "System32", "wsl.exe")]);
			return file === null ? null : {
				file,
				args: []
			};
		}
	}
];
const POSIX_BUILTINS = [
	{
		id: "bash",
		name: "Bash",
		platforms: ["darwin", "linux"],
		resolve: (env) => {
			const file = firstExisting([
				...pathEntries(env).map((entry) => join(entry, "bash")),
				"/bin/bash",
				"/usr/bin/bash"
			]);
			return file === null ? null : {
				file,
				args: []
			};
		}
	},
	{
		id: "zsh",
		name: "Zsh",
		platforms: ["darwin", "linux"],
		resolve: (env) => {
			const file = firstExisting([
				"/bin/zsh",
				"/usr/bin/zsh",
				...pathEntries(env).map((entry) => join(entry, "zsh"))
			]);
			return file === null ? null : {
				file,
				args: []
			};
		}
	},
	{
		id: "fish",
		name: "Fish",
		platforms: ["darwin", "linux"],
		resolve: (env) => {
			const file = firstExisting([
				"/usr/local/bin/fish",
				"/opt/homebrew/bin/fish",
				...pathEntries(env).map((entry) => join(entry, "fish"))
			]);
			return file === null ? null : {
				file,
				args: []
			};
		}
	}
];
const BUILTINS = [...WINDOWS_BUILTINS, ...POSIX_BUILTINS];
var ShellRegistry = class {
	customShells;
	constructor(customShells) {
		this.customShells = customShells;
	}
	/** 枚举当前平台可配置的 shell（检测不到的 available=false，由客户端隐藏）。 */
	list(env = process.env, platform = process.platform) {
		const result = [];
		for (const def of BUILTINS) {
			if (!def.platforms.includes(platform)) continue;
			result.push({
				id: def.id,
				name: def.name,
				available: def.resolve(env, platform) !== null
			});
		}
		for (const custom of this.customShells) {
			if (platform !== "win32" && !/[\\/]/.test(custom.command) && custom.command.toLowerCase().endsWith(".exe")) continue;
			result.push({
				id: custom.id,
				name: custom.name,
				available: this.resolveCustom(custom, env, platform) !== null
			});
		}
		return result;
	}
	/** 解析为可执行规格；内置 id 优先，其次自定义 shell。 */
	resolve(id, env = process.env, platform = process.platform) {
		const builtin = BUILTINS.find((def) => def.id === id && def.platforms.includes(platform));
		if (builtin !== void 0) {
			const resolved = builtin.resolve(env, platform);
			return resolved === null ? null : {
				id: builtin.id,
				name: builtin.name,
				...resolved
			};
		}
		const custom = this.customShells.find((entry) => entry.id === id);
		if (custom !== void 0) {
			const resolved = this.resolveCustom(custom, env, platform);
			return resolved === null ? null : {
				id: custom.id,
				name: custom.name,
				...resolved
			};
		}
		return null;
	}
	/** 默认 shell id：配置值可用则用之；否则 win32 用 powershell，POSIX 用 $SHELL 名或 bash。 */
	defaultShellId(preferred, env = process.env, platform = process.platform) {
		if (preferred !== void 0 && preferred.length > 0 && this.resolve(preferred, env, platform) !== null) return preferred;
		if (platform === "win32") return "powershell";
		const shellName = (env.SHELL ?? "").split("/").pop() ?? "";
		if (shellName.length > 0 && this.resolve(shellName, env, platform) !== null) return shellName;
		return "bash";
	}
	resolveCustom(custom, env, platform) {
		const raw = custom.command.trim();
		if (raw.length === 0) return null;
		const args = Array.isArray(custom.args) ? [...custom.args] : [];
		if (/[\\/]/.test(raw) || isFileLike(raw)) return isFileLike(raw) ? {
			file: raw,
			args
		} : null;
		const file = probeOnPath(raw, env, platform);
		return file === null ? null : {
			file,
			args
		};
	}
};
//#endregion
//#region src/host/index.ts
const name = "dsh-single-terminal";
const inject = ["webServer", "connection"];
const CustomShellSchema = Schema.object({
	id: Schema.string().required().description("唯一 id，如 my-shell"),
	name: Schema.string().required().description("菜单显示名，如 My Shell"),
	command: Schema.string().required().description("可执行文件路径或 PATH 上的命令名，如 nu"),
	args: Schema.array(Schema.string()).default([]).description("启动参数")
});
const Config = Schema.object({
	defaultShell: Schema.string().default("powershell").description("默认 shell id：powershell | pwsh | cmd | gitbash | wsl（或自定义 shell 的 id）。非 Windows 下自动回退到 $SHELL/bash"),
	defaultCwd: Schema.string().default("workspace").description("终端初始目录：workspace（当前工作区根，未知时回退用户主目录）| home | 绝对路径"),
	scrollbackLimit: Schema.number().default(2e5).description("重连回放缓冲的字符上限（每会话）"),
	fontSize: Schema.number().default(13).description("终端字号"),
	fontFamily: Schema.string().default("Consolas, \"Cascadia Mono\", \"Courier New\", monospace").description("终端字体"),
	customShells: Schema.array(CustomShellSchema).default([]).description("自定义 shell 列表")
});
const WS_PATH = "/api/dsh-single-terminal.ws";
function apply(ctx, config) {
	const webServer = ctx.get("webServer");
	const connection = ctx.get("connection");
	if (webServer === void 0 || connection === void 0) return;
	const hub = new TerminalHub(config, new ShellRegistry(config.customShells ?? []));
	let unregister;
	try {
		unregister = webServer.registerUpgrade({
			path: WS_PATH,
			handler: (req, socket, head) => {
				if (connection.requestRejection(req) !== void 0) {
					socket.destroy();
					return;
				}
				hub.handleUpgrade(req, socket, head);
			}
		});
	} catch (e) {
		console.warn("[dsh-single-terminal] register upgrade route failed:", e instanceof Error ? e.message : String(e));
	}
	ctx.effect(() => () => {
		try {
			unregister?.();
		} catch {}
		hub.dispose();
	});
}
//#endregion
export { Config, apply, inject, name };
