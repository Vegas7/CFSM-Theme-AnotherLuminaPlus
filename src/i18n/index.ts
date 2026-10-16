import { useSyncExternalStore } from "react";
import { EN } from "./en";

/**
 * 界面语言（中文 / English）。
 *
 * 文案直接以中文原文作为键：`t("保密")` 在中文下原样返回，在英文下查 `EN` 词典，
 * 查不到就退回中文（开发环境会在控制台提示缺了哪条）。带变量的文案用 `{name}` 占位：
 * `t("{n} 台在线", { n: 3 })`。
 *
 * `t()` 是普通函数，组件和工具函数都能直接调用；切换语言时 App 根节点按语言重新挂载，
 * 所有文案（包括 memo 组件和模块级常量里的中文标签）都会按新语言重新渲染。
 * 后端给的内容（站点名、节点名、标签、地区等）不翻译。
 */

export type Lang = "zh" | "en";

const STORAGE_KEY = "cfsm-anotherluminaplus:lang";

function detectLang(): Lang {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "zh" || stored === "en") return stored;
  } catch {
    // 隐私模式等读不到本地存储时按浏览器语言来。
  }
  // 测试用例都按中文文案写断言。
  if (import.meta.env.MODE === "test") return "zh";
  const preferred =
    typeof navigator !== "undefined"
      ? [...(navigator.languages ?? []), navigator.language].filter(Boolean)
      : [];
  if (preferred.length === 0) return "zh";
  return preferred.some((value) => /^zh\b/i.test(value)) ? "zh" : "en";
}

let current: Lang = detectLang();
const listeners = new Set<() => void>();

function syncDocumentLang(lang: Lang) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
}

syncDocumentLang(current);

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // 写不进去也不影响本次会话切换。
  }
  syncDocumentLang(lang);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}

const reportedMissing = new Set<string>();

type Vars = Record<string, string | number>;

function fill(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

/**
 * 按当前语言取文案；`zh` 是中文原文，同时也是英文词典的键。
 * 同一句中文在不同地方英文不同时（如开关状态的「关闭」= Off、按钮的「关闭」= Close），
 * 传 `context`，词典里用 `"context|中文"` 作键单独写一条。
 */
export function t(zh: string, vars?: Vars, context?: string): string {
  // 不含中文（含全角标点）的文案本来就是通用的（"CPU"、已经翻好的英文等），原样返回。
  if (current === "zh" || !/[　-〿一-鿿＀-￯]/.test(zh)) {
    return fill(zh, vars);
  }
  const en = (context ? EN[`${context}|${zh}`] : undefined) ?? EN[zh];
  if (en === undefined) {
    if (import.meta.env.DEV && !reportedMissing.has(zh)) {
      reportedMissing.add(zh);
      console.warn("[i18n] 缺少英文翻译：", zh);
    }
    return fill(zh, vars);
  }
  return fill(en, vars);
}

/** 当前语言下的数字/日期 locale。 */
export function locale(): string {
  return current === "zh" ? "zh-CN" : "en-US";
}
