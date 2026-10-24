import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { EN } from "../en";
import { getLang, setLang, t } from "..";

const SRC_DIR = fileURLToPath(new URL("../..", import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      return name === "__tests__" || name === "dev" ? [] : sourceFiles(full);
    }
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("i18n", () => {
  afterEach(() => setLang("zh"));

  it("returns Chinese as-is and fills placeholders", () => {
    expect(getLang()).toBe("zh");
    expect(t("保密")).toBe("保密");
    expect(t("{n} 台在线服务器", { n: 3 })).toBe("3 台在线服务器");
  });

  it("translates to English and falls back to the Chinese key", () => {
    setLang("en");
    expect(t("保密")).toBe("Private");
    expect(t("{n} 台在线服务器", { n: 3 })).toBe("3 servers online");
    expect(t("CPU")).toBe("CPU");
    expect(t("关闭", undefined, "switch")).toBe("Off");
    expect(t("关闭")).toBe("Close");
  });

  it("has an English entry for every literal t() key", () => {
    const missing: string[] = [];
    for (const file of sourceFiles(SRC_DIR)) {
      if (file.includes(`${path.sep}i18n${path.sep}`)) continue;
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) {
        const key = JSON.parse(`"${match[1]}"`) as string;
        if (/[　-〿一-鿿＀-￯]/.test(key) && !(key in EN)) {
          missing.push(`${path.basename(file)}: ${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("keeps the same placeholders in every translation", () => {
    const mismatched = Object.entries(EN)
      .filter(([zh, en]) => placeholders(zh.replace(/^\w+\|/, "")).join() !== placeholders(en).join())
      .map(([zh]) => zh);
    expect(mismatched).toEqual([]);
  });
});
