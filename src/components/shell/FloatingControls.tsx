import { lazy, Suspense, useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  Grid3x3,
  Languages,
  LayoutGrid,
  List,
  Monitor,
  Palette,
  Settings,
  SlidersHorizontal,
  Square,
  Sun,
  Moon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { usePreferences } from "@/hooks/usePreferences";
import { useViewMode } from "@/hooks/useViewMode";
import { useNodeStoreStatus } from "@/hooks/useNode";
import { useAuth } from "@/hooks/useAuth";
import { useThemeSettings } from "@/hooks/useThemeSettings";
import { usePriceVisibility } from "@/hooks/usePriceVisibility";
import { useSideColumn } from "@/hooks/useSideColumn";
import { getAdminUrl } from "@/services/cfsm/config";
import { setLang, useLang } from "@/i18n";
import type { NodeViewMode, Appearance } from "@/utils/themeSettings";
import { clsx } from "clsx";
import { t } from "@/i18n";

const MetricColorPicker = lazy(() =>
  import("./MetricColorPicker").then((module) => ({ default: module.MetricColorPicker })),
);

// 悬浮球切换按钮展示"下一档"的图标/文案(点击后会切到的视图),而不是当前视图——
// 与 ThemeManage 里 NODE_VIEW_MODE_OPTIONS 的图标语义保持一致。
const VIEW_MODE_META: Record<NodeViewMode, { icon: typeof LayoutGrid; label: string }> = {
  large: { icon: Square, label: "大视图" },
  compact: { icon: LayoutGrid, label: "小视图" },
  mini: { icon: Grid3x3, label: "迷你视图" },
  list: { icon: List, label: "列表视图" },
};

const NEXT_APPEARANCE: Record<Appearance, Appearance> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const APPEARANCE_META: Record<
  Appearance,
  { icon: typeof Sun; label: string; nextLabel: string }
> = {
  light: { icon: Sun, label: "浅色", nextLabel: "深色" },
  dark: { icon: Moon, label: "深色", nextLabel: "跟随系统" },
  system: { icon: Monitor, label: "跟随系统", nextLabel: "浅色" },
};

export function FloatingControls({
  onExpandedChange,
  backTo,
}: {
  onExpandedChange?: (expanded: boolean) => void;
  /** 子页面（详情页、资产页）在侧栏模式下用：按钮栏上方多一枚返回圆钮，跳到这个地址。 */
  backTo?: string;
}) {
  const { appearance, setAppearance } = usePreferences();
  const { mode, nextMode, toggleMode } = useViewMode();
  const { data: me } = useAuth();
  const themeSettings = useThemeSettings();
  const { isPriceVisible, togglePriceVisibility } = usePriceVisibility();
  const { failureStreak } = useNodeStoreStatus();
  const lang = useLang();
  // iPhone Duo 主屏幕 App：快捷按钮竖排放进透明侧栏，不挡内容，所以默认展开、滚动时也不收起。
  const inSideColumn = useSideColumn() !== null;
  const [collapsed, setCollapsed] = useState(!inSideColumn);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [prevInSideColumn, setPrevInSideColumn] = useState(inSideColumn);
  if (prevInSideColumn !== inSideColumn) {
    setPrevInSideColumn(inSideColumn);
    setCollapsed(!inSideColumn);
    setColorsOpen(false);
  }
  const [colorsMounted, setColorsMounted] = useState(false);
  const settingsReady = themeSettings.isReady;
  const showAdmin = settingsReady && themeSettings.enableAdminButton;
  // 主题管理入口与配色取色器都仅对登录管理员开放（配色存后端、全局生效）。
  const loggedIn = Boolean(me?.logged_in);
  const showThemeManage = loggedIn;
  const showColorPicker = loggedIn;
  const showPriceToggle = loggedIn;
  const showSyncWarning = failureStreak >= 2;
  const showBack = inSideColumn && Boolean(backTo);
  const hiddenTabIndex = collapsed ? -1 : undefined;
  const ToggleIcon = inSideColumn
    ? collapsed
      ? ChevronUp
      : ChevronDown
    : collapsed
      ? ChevronLeft
      : ChevronRight;
  const ViewIcon = VIEW_MODE_META[nextMode].icon;
  const currentAppearance = APPEARANCE_META[appearance] ?? APPEARANCE_META.system;
  const AppearanceIcon = currentAppearance.icon;

  const cycleAppearance = () => {
    setAppearance(NEXT_APPEARANCE[appearance] ?? "system");
  };

  // 只要不在最宽松的大卡默认态,就视为"已切换"，按钮保持高亮。
  const isReducedView = mode !== "large";
  // 展开的横向快捷栏会盖住顶栏站点名（由 Home 撤出）；放进侧栏时不占顶栏，不必撤出。
  useEffect(() => {
    onExpandedChange?.(!collapsed && !inSideColumn);
  }, [collapsed, inSideColumn, onExpandedChange]);
  useEffect(() => () => onExpandedChange?.(false), [onExpandedChange]);

  // 仅监听用户主动的滚轮/触摸滑动手势（wheel / touchmove），100% 免疫任何 DOM 尺寸变化或重排引发的 scroll 事件
  useEffect(() => {
    if (collapsed || inSideColumn) return;

    const handleUserScroll = () => {
      setCollapsed(true);
      setColorsOpen(false);
    };

    window.addEventListener("wheel", handleUserScroll, { passive: true });
    window.addEventListener("touchmove", handleUserScroll, { passive: true });

    return () => {
      window.removeEventListener("wheel", handleUserScroll);
      window.removeEventListener("touchmove", handleUserScroll);
    };
  }, [collapsed, inSideColumn]);

  const toggleControls = () => {
    // 收起快捷栏时同时结束子面板状态，避免下次展开时调色盘自动复现。
    const nextCollapsed = !collapsed;
    if (nextCollapsed) setColorsOpen(false);
    setCollapsed(nextCollapsed);
  };

  return (
    <div
      className={clsx(
        "floating-controls",
        showSyncWarning && "has-warning",
        showBack && "has-back",
        collapsed ? "is-collapsed" : "is-expanded",
      )}
    >
      <div className="floating-controls-inner">
        <div className="floating-controls-bar">
          {/* 侧栏模式的返回：紧贴在按钮栏上方，跟着按钮栏一起从底部往上排，不钉在顶部（系统图标变多也挡不住） */}
          {showBack && backTo && (
            <Link
              to={backTo}
              aria-label={t("返回")}
              title={t("返回")}
              className="control-button floating-controls-back grid h-9 w-9 place-items-center"
            >
              <ChevronLeft size={16} />
            </Link>
          )}
          <div
            className="floating-controls-actions"
            aria-hidden={collapsed}
          >
            {settingsReady && (
              <>
                <button
                  type="button"
                  onClick={cycleAppearance}
                  aria-label={t("切换外观风格")}
                  title={t("外观：{from} → {to}", {
                    from: t(currentAppearance.label),
                    to: t(currentAppearance.nextLabel),
                  })}
                  tabIndex={hiddenTabIndex}
                  className={clsx(
                    "control-button grid h-9 w-9 place-items-center",
                    appearance !== "system" && "control-toggle is-active",
                  )}
                >
                  <AppearanceIcon size={16} />
                </button>
                <button
                  type="button"
                  onClick={toggleMode}
                  aria-label={t("切换卡片视图")}
                  aria-pressed={isReducedView}
                  title={t("临时切换到{view}", { view: t(VIEW_MODE_META[nextMode].label) })}
                  tabIndex={hiddenTabIndex}
                  className={clsx(
                    "control-button grid h-9 w-9 place-items-center",
                    isReducedView && "control-toggle is-active",
                  )}
                >
                  <ViewIcon size={16} />
                </button>
                {showPriceToggle && (
                  <button
                    type="button"
                    onClick={togglePriceVisibility}
                    aria-label={isPriceVisible ? t("隐藏价格与资产") : t("显示价格与资产")}
                    aria-pressed={!isPriceVisible}
                    title={isPriceVisible ? t("临时隐藏价格与资产") : t("临时显示价格与资产")}
                    tabIndex={hiddenTabIndex}
                    className={clsx(
                      "control-button grid h-9 w-9 place-items-center",
                      !isPriceVisible && "control-toggle is-active",
                    )}
                  >
                    {isPriceVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                )}
                {showColorPicker && (
                  <button
                    type="button"
                    onClick={() => {
                      setColorsMounted(true);
                      setColorsOpen((value) => !value);
                    }}
                    aria-label={t("卡片配色")}
                    aria-pressed={colorsOpen}
                    title={t("卡片配色")}
                    tabIndex={hiddenTabIndex}
                    className={clsx(
                      "control-button grid h-9 w-9 place-items-center",
                      colorsOpen && "control-toggle is-active",
                    )}
                  >
                    <Palette size={16} />
                  </button>
                )}
              </>
            )}
            {/* 语言切换对所有访客开放，不依赖主题设置是否就绪。 */}
            <button
              type="button"
              onClick={() => setLang(lang === "zh" ? "en" : "zh")}
              aria-label={lang === "zh" ? "切换语言 / Switch language" : "Switch language / 切换语言"}
              title={lang === "zh" ? "语言：中文 → English" : "Language: English → 中文"}
              tabIndex={hiddenTabIndex}
              className="control-button grid h-9 w-9 place-items-center"
            >
              <Languages size={16} />
            </button>
            {showThemeManage && (
              <Link
                to="/?view=theme-manage"
                aria-label={t("主题设置")}
                title={t("主题设置")}
                tabIndex={hiddenTabIndex}
                className="control-button grid h-9 w-9 place-items-center"
              >
                <SlidersHorizontal size={16} />
              </Link>
            )}
            {showAdmin && (
              <a
                href={getAdminUrl()}
                aria-label={me?.logged_in ? t("管理") : t("后台登录")}
                title={me?.logged_in ? t("管理") : t("后台登录")}
                tabIndex={hiddenTabIndex}
                className="control-button grid h-9 w-9 place-items-center"
              >
                <Settings size={16} />
              </a>
            )}
          </div>
          <button
            type="button"
            className="control-button floating-controls-trigger grid h-9 w-9 place-items-center"
            aria-label={collapsed ? t("展开快捷按钮") : t("收起快捷按钮")}
            aria-expanded={!collapsed}
            onClick={toggleControls}
            title={collapsed ? t("展开快捷按钮") : t("收起快捷按钮")}
          >
            <ToggleIcon size={16} />
            {showSyncWarning && collapsed && (
              <span className="floating-controls-warning-dot" aria-hidden />
            )}
          </button>
        </div>
        {showColorPicker && colorsMounted && (
          <Suspense fallback={null}>
            <MetricColorPicker hidden={collapsed || !colorsOpen} />
          </Suspense>
        )}
        {showSyncWarning && !collapsed && !colorsOpen && (
          <div className="floating-controls-sync-warning pointer-events-none flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--status-offline)_32%,transparent)] bg-[color-mix(in_srgb,var(--surface-a)_90%,transparent)] px-3 py-1 text-[11px] font-medium text-(--status-offline) shadow-[0_10px_25px_-18px_rgba(0,0,0,0.8)] backdrop-blur">
            <AlertTriangle size={12} />
            <span>{t("实时状态同步异常，当前展示的是最近缓存")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
