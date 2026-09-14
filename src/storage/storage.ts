/**
 * localStorage 读写统一封装。
 * 解析失败/不可用时返回 fallback，写入失败静默（隐私模式/配额满不崩页面）。
 * 版本迁移口子：te:meta.version 升级时在此按版本逐步迁移。
 */

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 静默降级：本次会话内存态仍可用
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
