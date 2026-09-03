/**
 * dsh-single-terminal —— shell 注册表与探测。
 *
 * 探测范式对齐宿主 packages/shell/pwsh-local/src/resolve.ts：
 * 已知路径 + PATH 逐项探测 + lstatSync(isFile||isSymbolicLink)，
 * 不用注册表 / where.exe。检测不到的 shell available=false（客户端隐藏）。
 */

import { lstatSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import type { CustomShellConfig } from './types.ts'

export interface ResolvedShell {
  id: string
  name: string
  file: string
  args: string[]
}

function isFileLike(path: string): boolean {
  try {
    const stat = lstatSync(path)
    return stat.isFile() || stat.isSymbolicLink()
  } catch {
    return false
  }
}

function firstExisting(paths: readonly string[]): string | null {
  for (const path of paths) {
    if (path.length > 0 && isFileLike(path)) return path
  }
  return null
}

function pathEntries(env: NodeJS.ProcessEnv): string[] {
  return (env.PATH ?? '')
    .split(delimiter)
    .map((entry) => entry.trim().replace(/^"|"$/g, ''))
    .filter((entry) => entry.length > 0)
}

/** PATH 逐项探测一个裸可执行名（Windows 附加 PATHEXT 扩展名）。 */
function probeOnPath(name: string, env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string | null {
  const extensions = platform === 'win32'
    ? (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter((ext) => ext.length > 0)
    : ['']
  const candidates: string[] = []
  for (const entry of pathEntries(env)) {
    for (const ext of extensions) candidates.push(join(entry, name + ext))
  }
  return firstExisting(candidates)
}

interface ShellDef {
  id: string
  name: string
  platforms: readonly NodeJS.Platform[]
  resolve(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): { file: string; args: string[] } | null
}

const WINDOWS_BUILTINS: ShellDef[] = [
  {
    id: 'powershell',
    name: 'PowerShell',
    platforms: ['win32'],
    resolve: (env) => {
      const systemRoot = env.SystemRoot ?? 'C:\\Windows'
      const file = firstExisting([join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')])
      return file === null ? null : { file, args: [] }
    },
  },
  {
    id: 'pwsh',
    name: 'PowerShell 7',
    platforms: ['win32', 'darwin', 'linux'],
    resolve: (env, platform) => {
      const candidates: string[] = []
      if (platform === 'win32') {
        const programFiles = env.ProgramFiles ?? 'C:\\Program Files'
        candidates.push(join(programFiles, 'PowerShell', '7', 'pwsh.exe'))
        for (const entry of pathEntries(env)) candidates.push(join(entry, 'pwsh.exe'))
      } else {
        candidates.push(...pathEntries(env).map((entry) => join(entry, 'pwsh')))
      }
      const file = firstExisting(candidates)
      return file === null ? null : { file, args: [] }
    },
  },
  {
    id: 'cmd',
    name: 'CMD',
    platforms: ['win32'],
    resolve: (env) => {
      const systemRoot = env.SystemRoot ?? 'C:\\Windows'
      const file = firstExisting([join(systemRoot, 'System32', 'cmd.exe')])
      return file === null ? null : { file, args: [] }
    },
  },
  {
    id: 'gitbash',
    name: 'Git Bash',
    platforms: ['win32'],
    resolve: (env) => {
      const programFiles = env.ProgramFiles ?? 'C:\\Program Files'
      const programFilesX86 = env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
      const localAppData = env.LocalAppData ?? ''
      const file = firstExisting([
        join(programFiles, 'Git', 'bin', 'bash.exe'),
        join(programFiles, 'Git', 'usr', 'bin', 'bash.exe'),
        join(programFilesX86, 'Git', 'bin', 'bash.exe'),
        localAppData.length > 0 ? join(localAppData, 'Programs', 'Git', 'bin', 'bash.exe') : '',
      ])
      return file === null ? null : { file, args: ['-i'] }
    },
  },
  {
    id: 'wsl',
    name: 'WSL',
    platforms: ['win32'],
    resolve: (env) => {
      const systemRoot = env.SystemRoot ?? 'C:\\Windows'
      const file = firstExisting([join(systemRoot, 'System32', 'wsl.exe')])
      return file === null ? null : { file, args: [] }
    },
  },
]

const POSIX_BUILTINS: ShellDef[] = [
  {
    id: 'bash',
    name: 'Bash',
    platforms: ['darwin', 'linux'],
    resolve: (env) => {
      const file = firstExisting([...pathEntries(env).map((entry) => join(entry, 'bash')), '/bin/bash', '/usr/bin/bash'])
      return file === null ? null : { file, args: [] }
    },
  },
  {
    id: 'zsh',
    name: 'Zsh',
    platforms: ['darwin', 'linux'],
    resolve: (env) => {
      const file = firstExisting(['/bin/zsh', '/usr/bin/zsh', ...pathEntries(env).map((entry) => join(entry, 'zsh'))])
      return file === null ? null : { file, args: [] }
    },
  },
  {
    id: 'fish',
    name: 'Fish',
    platforms: ['darwin', 'linux'],
    resolve: (env) => {
      const file = firstExisting([
        '/usr/local/bin/fish',
        '/opt/homebrew/bin/fish',
        ...pathEntries(env).map((entry) => join(entry, 'fish')),
      ])
      return file === null ? null : { file, args: [] }
    },
  },
]

const BUILTINS: readonly ShellDef[] = [...WINDOWS_BUILTINS, ...POSIX_BUILTINS]

export class ShellRegistry {
  constructor(private readonly customShells: readonly CustomShellConfig[]) {}

  /** 枚举当前平台可配置的 shell（检测不到的 available=false，由客户端隐藏）。 */
  list(env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform): Array<{ id: string; name: string; available: boolean }> {
    const result: Array<{ id: string; name: string; available: boolean }> = []
    for (const def of BUILTINS) {
      if (!def.platforms.includes(platform)) continue
      result.push({ id: def.id, name: def.name, available: def.resolve(env, platform) !== null })
    }
    for (const custom of this.customShells) {
      if (platform !== 'win32' && !/[\\/]/.test(custom.command) && custom.command.toLowerCase().endsWith('.exe')) continue
      result.push({ id: custom.id, name: custom.name, available: this.resolveCustom(custom, env, platform) !== null })
    }
    return result
  }

  /** 解析为可执行规格；内置 id 优先，其次自定义 shell。 */
  resolve(id: string, env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform): ResolvedShell | null {
    const builtin = BUILTINS.find((def) => def.id === id && def.platforms.includes(platform))
    if (builtin !== undefined) {
      const resolved = builtin.resolve(env, platform)
      return resolved === null ? null : { id: builtin.id, name: builtin.name, ...resolved }
    }
    const custom = this.customShells.find((entry) => entry.id === id)
    if (custom !== undefined) {
      const resolved = this.resolveCustom(custom, env, platform)
      return resolved === null ? null : { id: custom.id, name: custom.name, ...resolved }
    }
    return null
  }

  /** 默认 shell id：配置值可用则用之；否则 win32 用 powershell，POSIX 用 $SHELL 名或 bash。 */
  defaultShellId(preferred: string | undefined, env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform): string {
    if (preferred !== undefined && preferred.length > 0 && this.resolve(preferred, env, platform) !== null) return preferred
    if (platform === 'win32') return 'powershell'
    const shellName = (env.SHELL ?? '').split('/').pop() ?? ''
    if (shellName.length > 0 && this.resolve(shellName, env, platform) !== null) return shellName
    return 'bash'
  }

  private resolveCustom(custom: CustomShellConfig, env: NodeJS.ProcessEnv, platform: NodeJS.Platform): { file: string; args: string[] } | null {
    const raw = custom.command.trim()
    if (raw.length === 0) return null
    const args = Array.isArray(custom.args) ? [...custom.args] : []
    if (/[\\/]/.test(raw) || isFileLike(raw)) {
      return isFileLike(raw) ? { file: raw, args } : null
    }
    const file = probeOnPath(raw, env, platform)
    return file === null ? null : { file, args }
  }
}
