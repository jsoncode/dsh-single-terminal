// 一次性脚本：从 node_modules 生成 src/client/xterm-css.ts（构建期内嵌 xterm.css）。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const css = readFileSync('node_modules/@xterm/xterm/css/xterm.css', 'utf8')
const escaped = css.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${')
mkdirSync('src/client', { recursive: true })
writeFileSync(
  'src/client/xterm-css.ts',
  `/**
 * xterm.css（@xterm/xterm 5.x 自带样式）· 生成期内嵌。
 * 来源：node_modules/@xterm/xterm/css/xterm.css（MIT，xterm.js authors）。
 * 升级 @xterm/xterm 后重跑 scripts/gen-xterm-css.mjs 再生成本文件。
 */
export const XTERM_CSS = \`${escaped}\`
`,
)
console.log('xterm-css.ts generated:', css.length, 'chars of css')
