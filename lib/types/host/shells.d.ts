/**
 * dsh-single-terminal —— shell 注册表与探测。
 *
 * 探测范式对齐宿主 packages/shell/pwsh-local/src/resolve.ts：
 * 已知路径 + PATH 逐项探测 + lstatSync(isFile||isSymbolicLink)，
 * 不用注册表 / where.exe。检测不到的 shell available=false（客户端隐藏）。
 */
import type { CustomShellConfig } from './types.ts';
export interface ResolvedShell {
    id: string;
    name: string;
    file: string;
    args: string[];
}
export declare class ShellRegistry {
    private readonly customShells;
    constructor(customShells: readonly CustomShellConfig[]);
    /** 枚举当前平台可配置的 shell（检测不到的 available=false，由客户端隐藏）。 */
    list(env?: NodeJS.ProcessEnv, platform?: NodeJS.Platform): Array<{
        id: string;
        name: string;
        available: boolean;
    }>;
    /** 解析为可执行规格；内置 id 优先，其次自定义 shell。 */
    resolve(id: string, env?: NodeJS.ProcessEnv, platform?: NodeJS.Platform): ResolvedShell | null;
    /** 默认 shell id：配置值可用则用之；否则 win32 用 powershell，POSIX 用 $SHELL 名或 bash。 */
    defaultShellId(preferred: string | undefined, env?: NodeJS.ProcessEnv, platform?: NodeJS.Platform): string;
    private resolveCustom;
}
//# sourceMappingURL=shells.d.ts.map