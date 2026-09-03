# dsh-single-terminal

**dsh-single-terminal** is a real-terminal drawer plugin for the DeepSeek
Harness (DSH) host. It docks an interactive PTY terminal (xterm.js) to the
bottom of the web app — type into it, Ctrl-C it, resize it, open as many tabs
as you need.

- **Real PTY, not an emulator** — each tab is a true pseudo-terminal
  (ConPTY on Windows, forkpty on POSIX) driven by `node-pty`; interactive REPLs,
  full-screen programs and Ctrl-C all behave like a native terminal
- **Shell picker** — Windows: PowerShell (default) / pwsh 7 / CMD / Git Bash /
  WSL (shells that are not installed are hidden automatically) + custom shells
  from config; POSIX: `$SHELL` / bash / zsh / fish
- **Two drawer modes** — *Docked* pushes the page content up (no occlusion),
  *Overlay* floats above it; drag the top edge to resize, the drawer remembers
  mode and height. Overlay is a frosted-glass layer (translucent background +
  `backdrop-filter` blur); Docked is opaque. Open/close slides with the host's
  easing curve and honors `prefers-reduced-motion`.
- **Theme following** — the drawer and the terminal palette follow the host's
  theme (light / dark / custom themes) live; no separate theme config.
- **Keep-alive sessions** — terminals survive page refreshes and drawer
  close/reopen; on reconnect the recent output is replayed from a ring buffer.
  Opening the drawer with no terminal yet auto-creates one with the default
  shell.
- **Workspace-aware cwd** — when the current session belongs to a workspace,
  new terminals (including the auto-created one) start in that workspace root
  directory, no manual `cd` needed; with no session / no workspace the
  `defaultCwd` rules apply.
- **Bilingual UI** — follows the host interface language (中文 / English);
  `Alt+C` toggles the drawer

[中文文档](README.zh.md)

## Features

- **Header entry** (`conversation.session.header.utilities`): a panel-bottom
  icon button in the session header's utilities row toggles
  the drawer. Hovering shows a bubble tooltip (the host `Tooltip` component)
  with the shortcut; `Alt+C` toggles from anywhere except while typing inside
  the terminal (there `Alt+C` is passed to the shell as `ESC c`).
- **Drawer** (`shell.overlay`): a frame-level bottom drawer with
  - a tab strip — one PTY session per tab, independent shells, close button
    per tab (terminates the whole process tree; the pid is verified gone),
  - a `＋` button (new tab with the default shell) and a `▸` menu
    (all shells found on this machine; unavailable ones are not listed),
  - a mode switch (*Docked* / *Overlay*), a connection status dot and a
    collapse button,
  - a drag handle on the top edge (pointer-capture drag, min 140px).
- **Docked mode** pushes the app frame up with `padding-bottom` on the frame
  root element (no host hook exists for bottom docks); when the anchor cannot
  be found it silently falls back to overlay.
- **Model tools**: none — this plugin is UI-only by design.

## Configuration

Schemastery `Config` (renders on the host Plugins settings page), and / or the
profile `cordis.patch.yml`:

```yaml
- insert:
    - id: dsh-single-terminal
      name: dsh-single-terminal
      config:
        defaultShell: powershell   # powershell | pwsh | cmd | gitbash | wsl | <custom id>
        defaultCwd: home           # home | workspace | absolute path
        scrollbackLimit: 200000    # replay ring buffer, bytes per session
        fontSize: 13
        fontFamily: Consolas, "Cascadia Mono", "Courier New", monospace
        customShells:
          - id: nu
            name: Nushell
            command: nu            # resolved through PATH
            args: []
```

- `defaultShell` — shell used by the `＋` button; when unavailable it falls
  back (`powershell` on Windows, `$SHELL`/`bash` on POSIX).
- `defaultCwd` — start directory when there is no workspace context: `home`
  (default) starts in the user home; `workspace` is reserved (currently
  resolves to home); an absolute path must exist. When the current session
  belongs to a workspace the workspace root takes precedence (see above).
- `customShells` — extra launchers; `command` may be an absolute path or a
  name resolved through `PATH` (with `PATHEXT` on Windows).

## Installation

```sh
# Local development
dsh plugin --profile web add ./dsh-single-terminal

# Published: npm / tarball / GitHub
dsh plugin --profile web add dsh-single-terminal
dsh plugin --profile web add ./dsh-single-terminal-0.1.0.tgz
dsh plugin --profile web add github:you/dsh-single-terminal#<sha>

dsh --profile web                 # start (restart required for the host half to load)
```

> **node-pty** is a native dependency of the *host half* (`dependencies`, kept
> external and loaded via `createRequire`). It ships prebuilds for common
> platforms; on unusual platforms a C/C++ toolchain is needed for
> `pnpm install` to compile it. The browser half inlines xterm.js entirely —
> no runtime dependency there.

## Development

Requirements: **Node ≥ 22.19 (or ≥ 24) + pnpm 10** (the `packageManager` field
pins the pnpm version).

```sh
pnpm install           # includes node-pty + ws (runtime) and @xterm/* (bundled into the client)
pnpm run check         # whole-tree TypeScript type check (tsc -b)
pnpm run build         # clean lib → tsc -b (declarations) → tsdown (both halves)
pnpm run watch         # tsdown watch mode
pnpm run verify        # simulate the host seed table to check lib/client.js loads
```

```
├── src/host/           # Host half: index.ts (entry, ws route + config), hub.ts (session hub + frame protocol), shells.ts (registry + probing), types.ts
├── src/client/         # Browser half: plugin.tsx (slots), drawer.tsx, term.tsx, controller.ts, ws.ts, styles.ts, i18n.ts ...
├── lib/index.js        # Host half build artifact (tsdown, ESM)
├── lib/client.js       # Browser half build artifact (tsdown → __ModuleLoader__ factory, xterm inlined)
├── scripts/verify-client.mjs    # host-seed simulation check
├── scripts/gen-xterm-css.mjs    # regenerates src/client/xterm-css.ts from the @xterm/xterm package
├── cordis.patch.yml    # Bundle patch: plugin row referenced by package name (no paths)
└── package.json        # dsh.bundle + dsh.client(web) manifests + peerDependencies
```

## Implementation notes

- **Why the plugin ships its own node-pty**: the host `subprocess` terminal
  primitive (`SubprocessTerminalHandle`) intentionally exposes no `resize`,
  which a resize-following terminal needs; a plugin-owned `node-pty` gets the
  full `write / resize / kill` control surface with the same ConPTY/forkpty
  substrate the host uses.
- **Transport**: a dedicated WebSocket route (`/api/dsh-single-terminal.ws`)
  registered through `ctx.webServer.registerUpgrade`, gated by
  `ctx.connection.requestRejection` (same trusted-host fence as the host API
  gateway). The client connects same-origin and rides the `dsh-auth` cookie.
- **Session model**: sessions live in a hub `Map` independent of sockets —
  page refresh / reconnect re-`list`s, adopts live sessions and `attach`es
  with a `replay` of the ring buffer. Exited sessions are pruned so dead tabs
  never resurrect. Multiple browser tabs may attach to one session (output is
  broadcast, input is merged).
- **Frame protocol**: JSON text frames; client → host `open / input / resize /
  close / list / attach / ping`, host → client `hello / shells / opened / data
  / replay / exit / error / pong`. `input`/`resize` are size-capped and
  clamped server-side.
- **Windows process tree**: closing a tab runs `pty.kill()` and additionally
  `taskkill /T /F` on the session pid — ConPTY closure alone can leave
  PowerShell (+PSReadLine) alive; POSIX kills the foreground process group
  (`kill(-pid)`).
- **Theme following**: all plugin CSS consumes the host's semantic alias
  tokens (`--dsw-alias-*`, defined on `body` and flipped by
  `body[data-ds-dark-theme]`), so light / dark / custom themes apply without
  plugin-side logic. The xterm palette is computed at runtime: alias token
  values are read via a hidden probe element (`getComputedStyle`), the
  background is re-composed with the overlay alpha, and a `MutationObserver`
  on the body attribute re-applies the palette — theme switches (including
  custom themes projected by the host's ThemePresenter) update live.
- **Renderer strategy**: xterm 5 ships DOM renderer only by default
  (`allowTransparency` works there, and WebGL canvases are opaque), so Overlay
  mode stays on the DOM renderer with a translucent terminal background under
  the frosted blur, while Docked mode loads the WebGL addon for GPU rendering;
  switching modes swaps the renderer at runtime.
- **The official `deepseek-harness` project is not modified**; all UI sits in
  existing slots (`shell.overlay`, `conversation.session.header.utilities`).
