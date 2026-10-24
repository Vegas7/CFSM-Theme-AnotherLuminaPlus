import { getApiBases, getJwtToken } from "@/services/cfsm/config";
import type { PublicConfig } from "@/types/cfsm";

/**
 * 首屏缓存：把上一次的 `/api/config` 和 `/api/servers` 结果存在本机，再次打开时先用它把页面画出来，
 * 同时照常向后端要最新数据、回来后替换。冷的 Worker / D1 要等好几秒，没有缓存时这几秒只能看骨架屏。
 *
 * - 缓存按「后端地址 + 是否登录」分开：登录、退出、换后端都不会拿到另一种身份的数据（价格等）。
 * - 站点开了人机验证（Turnstile）时既不读也不写：验证状态必须以后端实时结果为准。
 * - 超过 24 小时的缓存不用；节点列表最多每分钟写一次（几十台节点的响应有几百 KB）。
 */

const STORAGE_KEY = "cfsm-anotherluminaplus:boot-cache";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SERVERS_WRITE_INTERVAL_MS = 60 * 1000;

export interface CachedServersResult<T> {
  base: string;
  data: T;
}

interface BootCacheEntry {
  v: 1;
  scope: string;
  config?: { savedAt: number; data: PublicConfig };
  servers?: { savedAt: number; results: CachedServersResult<unknown>[] };
}

function currentScope(): string {
  return JSON.stringify([getApiBases(), getJwtToken() ? "user" : "guest"]);
}

function readEntry(): BootCacheEntry | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BootCacheEntry;
    return parsed?.v === 1 && parsed.scope === currentScope() ? parsed : null;
  } catch {
    return null;
  }
}

function writeEntry(update: (entry: BootCacheEntry) => BootCacheEntry) {
  try {
    const base: BootCacheEntry = readEntry() ?? { v: 1, scope: currentScope() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(update(base)));
  } catch {
    // 隐私模式或配额用尽：没有缓存只是回到原来的加载方式。
  }
}

const fresh = (savedAt: number | undefined) =>
  typeof savedAt === "number" && Date.now() - savedAt < MAX_AGE_MS;

// 页面打开时读一次就够：缓存只服务于首屏，之后一律以后端为准。
let bootEntry: BootCacheEntry | null | undefined;
function bootSnapshot(): BootCacheEntry | null {
  if (bootEntry === undefined) bootEntry = typeof window === "undefined" ? null : readEntry();
  return bootEntry;
}

/** 首屏可用的站点配置缓存；开了人机验证的站点返回 null。 */
export function readBootConfig(): { savedAt: number; data: PublicConfig } | null {
  const config = bootSnapshot()?.config;
  if (!config || !fresh(config.savedAt) || config.data.turnstile_enabled) return null;
  return config;
}

/** 首屏可用的节点列表缓存（原样的各后端响应）；配置缓存不可用时它也不用。 */
export function readBootServers<T>(): { savedAt: number; results: CachedServersResult<T>[] } | null {
  const servers = bootSnapshot()?.servers;
  if (!readBootConfig() || !servers || !fresh(servers.savedAt)) return null;
  return { savedAt: servers.savedAt, results: servers.results as CachedServersResult<T>[] };
}

export function saveBootConfig(data: PublicConfig): void {
  if (typeof window === "undefined") return;
  if (data.turnstile_enabled) {
    clearBootCache();
    return;
  }
  writeEntry((entry) => ({ ...entry, config: { savedAt: Date.now(), data } }));
}

let lastServersWrite = 0;

export function saveBootServers(results: CachedServersResult<unknown>[]): void {
  if (typeof window === "undefined" || results.length === 0) return;
  const now = Date.now();
  if (now - lastServersWrite < SERVERS_WRITE_INTERVAL_MS) return;
  lastServersWrite = now;
  writeEntry((entry) => ({ ...entry, servers: { savedAt: now, results } }));
}

export function clearBootCache(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略
  }
}
