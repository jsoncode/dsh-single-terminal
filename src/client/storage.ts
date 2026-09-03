/**
 * dsh-single-terminal —— 浏览器侧 UI 状态持久化（localStorage，JSON 容错）。
 */

const PREFIX = 'dsh-single-terminal.'

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch { /* storage unavailable */ }
}
