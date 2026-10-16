// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 11, 12, 0);
const RELEASE_HTML =
  '<!doctype html><html><head>\n  <meta name="theme-version" content="LuminaPlus v1.2.16" />\n  </head></html>';

// 模块有缓存：每条用例重新求值，等于刷新页面。
async function loadModule() {
  vi.resetModules();
  return import("@/services/versionCheck");
}

function reply(html: string, ok = true) {
  return { ok, text: async () => html } as unknown as Response;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.head.innerHTML = "";
});

describe("theme version parsing", () => {
  it("reads the version out of the build meta, both on this page and in the release html", async () => {
    const { extractThemeVersionFromHtml, parseThemeVersionMeta, readCurrentThemeVersion } =
      await loadModule();

    expect(parseThemeVersionMeta("LuminaPlus v1.2.15")).toBe("1.2.15");
    expect(parseThemeVersionMeta("LuminaPlus")).toBeNull();
    expect(extractThemeVersionFromHtml(RELEASE_HTML)).toBe("1.2.16");

    document.head.innerHTML = '<meta name="theme-version" content="LuminaPlus v1.2.15" />';
    expect(readCurrentThemeVersion()).toBe("1.2.15");

    // 改名后的写法照样读得出。
    expect(parseThemeVersionMeta("AnotherLuminaPlus v1.2.21")).toBe("1.2.21");
  });
});

describe("fetchLatestThemeVersion", () => {
  it("换了检测地址后不沿用旧地址查来的版本（否则要顶着上游的「新版」等满 12 小时）", async () => {
    // 上一版主题查的是原作者仓库，缓存里记着上游的 1.2.21，没有 source 字段。
    window.localStorage.setItem(
      "cfsm-luminaplus:theme-latest-version",
      JSON.stringify({ checkedAt: NOW - HOUR, version: "1.2.21", ok: true }),
    );
    const fetchMock = vi.fn(async () => reply(RELEASE_HTML));
    vi.stubGlobal("fetch", fetchMock);

    const module = await loadModule();
    expect(await module.fetchLatestThemeVersion(NOW)).toBe("1.2.16");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      module.THEME_RELEASE_INDEX_URL,
      expect.anything(),
    );
  });

  it("换了检测地址又查不到时，也不拿旧地址的版本顶上", async () => {
    window.localStorage.setItem(
      "cfsm-luminaplus:theme-latest-version",
      JSON.stringify({ checkedAt: NOW - HOUR, version: "1.2.21", ok: true, source: "https://example.com/old" }),
    );
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));

    const module = await loadModule();
    expect(await module.fetchLatestThemeVersion(NOW)).toBeNull();
  });

  it("asks GitHub once, then serves the answer from the local cache for 12 hours", async () => {
    const fetchMock = vi.fn(async () => reply(RELEASE_HTML));
    vi.stubGlobal("fetch", fetchMock);

    const first = await loadModule();
    expect(await first.fetchLatestThemeVersion(NOW)).toBe("1.2.16");

    // 刷新页面也不再查。
    const reloaded = await loadModule();
    expect(await reloaded.fetchLatestThemeVersion(NOW + 11 * HOUR)).toBe("1.2.16");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await reloaded.fetchLatestThemeVersion(NOW + 13 * HOUR);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("backs off for an hour after a failure and keeps the last known version meanwhile", async () => {
    const fetchMock = vi.fn(async () => reply(RELEASE_HTML));
    vi.stubGlobal("fetch", fetchMock);
    const module = await loadModule();
    await module.fetchLatestThemeVersion(NOW);

    fetchMock.mockImplementation(async () => {
      throw new Error("offline");
    });
    expect(await module.fetchLatestThemeVersion(NOW + 13 * HOUR)).toBe("1.2.16");
    expect(await module.fetchLatestThemeVersion(NOW + 13.5 * HOUR)).toBe("1.2.16");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await module.fetchLatestThemeVersion(NOW + 14.5 * HOUR);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
