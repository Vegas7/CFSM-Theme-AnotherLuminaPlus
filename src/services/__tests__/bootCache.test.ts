// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicConfig } from "@/types/cfsm";

const config = (extra: Partial<PublicConfig> = {}) =>
  ({ sitename: "Demo", turnstile_enabled: false, ...extra }) as PublicConfig;

// bootCache 在页面打开时只读一次缓存，每个用例重新加载模块模拟一次新的页面打开。
async function freshModule() {
  vi.resetModules();
  return import("@/services/bootCache");
}

describe("bootCache", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("下次打开时读回上次存的配置和节点列表", async () => {
    const first = await freshModule();
    first.saveBootConfig(config());
    first.saveBootServers([{ base: "", data: { servers: [] } }]);

    const second = await freshModule();
    expect(second.readBootConfig()?.data.sitename).toBe("Demo");
    expect(second.readBootServers()?.results).toEqual([{ base: "", data: { servers: [] } }]);
  });

  it("登录状态变了就不用另一种身份的缓存", async () => {
    const first = await freshModule();
    first.saveBootConfig(config());

    window.localStorage.setItem("jwt_token", "token");
    const second = await freshModule();
    expect(second.readBootConfig()).toBeNull();
  });

  it("开了人机验证的站点不缓存", async () => {
    const first = await freshModule();
    first.saveBootConfig(config({ turnstile_enabled: true }));

    const second = await freshModule();
    expect(second.readBootConfig()).toBeNull();
    expect(second.readBootServers()).toBeNull();
  });

  it("超过 24 小时的缓存不用", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
    const first = await freshModule();
    first.saveBootConfig(config());

    vi.setSystemTime(new Date("2026-10-02T01:00:00Z"));
    const second = await freshModule();
    expect(second.readBootConfig()).toBeNull();
  });
});
