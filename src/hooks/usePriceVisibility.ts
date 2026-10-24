import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useThemeSettings } from "@/hooks/useThemeSettings";

const PRICE_VISIBILITY_OVERRIDE_KEY = "komaritheme:price-visibility-override";

export type PriceVisibilityOverride = "visible" | "hidden" | null;

const listeners = new Set<() => void>();

export function resolvePriceVisibility(
  loggedIn: boolean,
  showPriceForGuests: boolean,
  override: PriceVisibilityOverride,
): boolean {
  if (override === "hidden") return false;
  if (override === "visible") return loggedIn || showPriceForGuests;

  // 默认状态（未设置临时覆盖）：登录站长始终看得到；访客按「公开资产」开关。
  // SAO 原本对站长也默认隐藏、要在快捷栏里临时展开 —— 站长登录了还看到「保密」很别扭，改成默认可见；
  // 快捷栏的按钮留着，用来临时隐藏（比如截图前）。
  return loggedIn || showPriceForGuests;
}

function readStoredOverride(): PriceVisibilityOverride {
  if (typeof window === "undefined") return null;
  try {
    const value = sessionStorage.getItem(PRICE_VISIBILITY_OVERRIDE_KEY);
    if (value === "visible" || value === "hidden") return value;
    return null;
  } catch {
    return null;
  }
}

let currentOverride: PriceVisibilityOverride = readStoredOverride();

function emit() {
  for (const listener of listeners) listener();
}

function writeStoredOverride(value: PriceVisibilityOverride) {
  currentOverride = value;
  try {
    if (value == null) {
      sessionStorage.removeItem(PRICE_VISIBILITY_OVERRIDE_KEY);
    } else {
      sessionStorage.setItem(PRICE_VISIBILITY_OVERRIDE_KEY, value);
    }
  } catch {
    // 忽略 sessionStorage 写入失败
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): PriceVisibilityOverride {
  return currentOverride;
}

export function usePriceVisibility() {
  const { data: me } = useAuth();
  const themeSettings = useThemeSettings();
  const override = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const loggedIn = Boolean(me?.logged_in);

  const isPriceVisible = resolvePriceVisibility(
    loggedIn,
    themeSettings.showPriceForGuests,
    override,
  );

  const togglePriceVisibility = useCallback(() => {
    if (!loggedIn) return;
    const next = isPriceVisible ? "hidden" : "visible";
    writeStoredOverride(next);
  }, [loggedIn, isPriceVisible]);

  const setPriceVisible = useCallback(
    (visible: boolean) => {
      if (!loggedIn) return;
      writeStoredOverride(visible ? "visible" : "hidden");
    },
    [loggedIn],
  );

  const resetPriceVisibilityOverride = useCallback(() => {
    writeStoredOverride(null);
  }, []);

  return {
    isPriceVisible,
    canToggle: loggedIn,
    togglePriceVisibility,
    setPriceVisible,
    resetPriceVisibilityOverride,
  };
}
