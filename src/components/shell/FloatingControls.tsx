import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
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
import {
  COLUMN_CIRCLE_SLOT,
  COLUMN_TOP_RESERVE,
  columnVisibleCount,
} from "@/utils/duoSideColumn";
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

interface ControlAction {
  key: string;
  /** 侧栏放不下时数字小的留在按钮栏里，其余收进「⋯」菜单。 */
  priority: number;
  icon: LucideIcon;
  /** 读屏用的名称。 */
  label: string;
  /** 悬停提示，也是「⋯」菜单里显示的文字。 */
  title: string;
  /** 已切换的按钮保持高亮。 */
  active?: boolean;
  pressed?: boolean;
  onSelect?: () => void;
  /** 站内跳转（router）。 */
  to?: string;
  /** 站外跳转。 */
  href?: string;
}

export function FloatingControls({
  onExpandedChange,
  backTo,
  homeActions = true,
}: {
  onExpandedChange?: (expanded: boolean) => void;
  /** 子页面（详情页、资产页）在侧栏模式下用：按钮栏上方多一枚返回圆钮，跳到这个地址。 */
  backTo?: string;
  /** 是否显示只作用于首页卡片的按钮（切换卡片视图、隐藏价格与资产）；详情页用不上。 */
  homeActions?: boolean;
}) {
  const { appearance, setAppearance } = usePreferences();
  const { mode, nextMode, toggleMode } = useViewMode();
  const { data: me } = useAuth();
  const themeSettings = useThemeSettings();
  const { isPriceVisible, togglePriceVisibility } = usePriceVisibility();
  const { failureStreak } = useNodeStoreStatus();
  const lang = useLang();
  // iPhone Duo 主屏幕 App：快捷按钮竖排放进透明侧栏，不挡内容，所以始终展开、没有收起按钮
  // （系统 App 的侧栏按钮栏也不能收起）；放不下的按钮收进「⋯」菜单，不在按钮栏里滚动。
  const sideColumn = useSideColumn();
  const inSideColumn = sideColumn !== null;
  const [collapsed, setCollapsed] = useState(!inSideColumn);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [prevInSideColumn, setPrevInSideColumn] = useState(inSideColumn);
  if (prevInSideColumn !== inSideColumn) {
    setPrevInSideColumn(inSideColumn);
    setCollapsed(!inSideColumn);
    setColorsOpen(false);
    setMenuOpen(false);
  }
  const [colorsMounted, setColorsMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // 侧栏里按钮栏可用的高度（屏幕高度扣掉底边距、顶部系统图标区和返回圆钮）；非侧栏模式不用。
  const [columnRoom, setColumnRoom] = useState<number | null>(null);
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
  const ToggleIcon = collapsed ? ChevronLeft : ChevronRight;
  const currentAppearance = APPEARANCE_META[appearance] ?? APPEARANCE_META.system;

  const cycleAppearance = () => {
    setAppearance(NEXT_APPEARANCE[appearance] ?? "system");
  };

  // 只要不在最宽松的大卡默认态,就视为"已切换"，按钮保持高亮。
  const isReducedView = mode !== "large";

  // 横向快捷栏里的顺序（外观在前）；侧栏里按 priority 排，常用的留在按钮栏、其余进「⋯」菜单。
  const actions: ControlAction[] = [];
  if (settingsReady) {
    actions.push({
      key: "appearance",
      priority: 3,
      icon: currentAppearance.icon,
      label: t("切换外观风格"),
      title: t("外观：{from} → {to}", {
        from: t(currentAppearance.label),
        to: t(currentAppearance.nextLabel),
      }),
      active: appearance !== "system",
      onSelect: cycleAppearance,
    });
    if (homeActions) {
      actions.push({
        key: "view",
        priority: 1,
        icon: VIEW_MODE_META[nextMode].icon,
        label: t("切换卡片视图"),
        title: t("临时切换到{view}", { view: t(VIEW_MODE_META[nextMode].label) }),
        active: isReducedView,
        pressed: isReducedView,
        onSelect: toggleMode,
      });
    }
    if (homeActions && showPriceToggle) {
      actions.push({
        key: "price",
        priority: 2,
        icon: isPriceVisible ? Eye : EyeOff,
        label: isPriceVisible ? t("隐藏价格与资产") : t("显示价格与资产"),
        title: isPriceVisible ? t("临时隐藏价格与资产") : t("临时显示价格与资产"),
        active: !isPriceVisible,
        pressed: !isPriceVisible,
        onSelect: togglePriceVisibility,
      });
    }
    if (showColorPicker) {
      actions.push({
        key: "colors",
        priority: 4,
        icon: Palette,
        label: t("卡片配色"),
        title: t("卡片配色"),
        active: colorsOpen,
        pressed: colorsOpen,
        onSelect: () => {
          setColorsMounted(true);
          setColorsOpen((value) => !value);
        },
      });
    }
  }
  // 语言切换对所有访客开放，不依赖主题设置是否就绪。
  actions.push({
    key: "lang",
    priority: 5,
    icon: Languages,
    label: lang === "zh" ? "切换语言 / Switch language" : "Switch language / 切换语言",
    title: lang === "zh" ? "语言：中文 → English" : "Language: English → 中文",
    onSelect: () => setLang(lang === "zh" ? "en" : "zh"),
  });
  if (showThemeManage) {
    actions.push({
      key: "theme",
      priority: 6,
      icon: SlidersHorizontal,
      label: t("主题设置"),
      title: t("主题设置"),
      to: "/?view=theme-manage",
    });
  }
  if (showAdmin) {
    actions.push({
      key: "admin",
      priority: 7,
      icon: Settings,
      label: me?.logged_in ? t("管理") : t("后台登录"),
      title: me?.logged_in ? t("管理") : t("后台登录"),
      href: getAdminUrl(),
    });
  }

  const ordered = inSideColumn
    ? [...actions].sort((a, b) => a.priority - b.priority)
    : actions;
  const visibleCount =
    inSideColumn && columnRoom !== null
      ? columnVisibleCount(columnRoom, ordered.length)
      : ordered.length;
  const barActions = ordered.slice(0, visibleCount);
  const menuActions = ordered.slice(visibleCount);
  const showMore = menuActions.length > 0;
  const isMenuOpen = menuOpen && showMore;

  // 侧栏模式下量一下按钮栏能用的高度：屏幕高度 − 底边距（外屏横放避让摄像头时更高）− 顶部系统图标区 − 返回圆钮。
  // 方向、内外屏切换都会触发 resize；底边距由 <html> 上的类决定，等它更新完下一帧再量。
  useLayoutEffect(() => {
    if (!inSideColumn) return;
    let frame = 0;
    const measure = () => {
      const root = rootRef.current;
      if (!root) return;
      const bottom = parseFloat(getComputedStyle(root).bottom) || 0;
      const room =
        window.innerHeight - bottom - COLUMN_TOP_RESERVE - (showBack ? COLUMN_CIRCLE_SLOT : 0);
      setColumnRoom(room);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
    };
  }, [inSideColumn, sideColumn, showBack]);

  // 「⋯」菜单：点外面、按 Esc 关闭；打开时焦点落到第一项，Esc 关闭后回到「⋯」。
  useEffect(() => {
    if (!isMenuOpen) return;
    menuRef.current?.querySelector<HTMLElement>("[role='menuitem']")?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || moreRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      moreRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isMenuOpen]);

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

  const toggleMenu = () => {
    // 菜单和调色盘都贴在按钮栏旁边同一处，打开菜单时先收起调色盘。
    if (!isMenuOpen) setColorsOpen(false);
    setMenuOpen(!isMenuOpen);
  };

  const renderBarAction = (action: ControlAction) => {
    const Icon = action.icon;
    const className = clsx(
      "control-button grid h-9 w-9 place-items-center",
      action.active && "control-toggle is-active",
    );
    const common = {
      "aria-label": action.label,
      title: action.title,
      tabIndex: hiddenTabIndex,
      className,
    };
    if (action.to) {
      return (
        <Link key={action.key} to={action.to} {...common}>
          <Icon size={16} />
        </Link>
      );
    }
    if (action.href) {
      return (
        <a key={action.key} href={action.href} {...common}>
          <Icon size={16} />
        </a>
      );
    }
    return (
      <button
        key={action.key}
        type="button"
        onClick={action.onSelect}
        aria-pressed={action.pressed}
        {...common}
      >
        <Icon size={16} />
      </button>
    );
  };

  const renderMenuAction = (action: ControlAction) => {
    const Icon = action.icon;
    const className = clsx("floating-controls-menu-item", action.active && "is-active");
    const content = (
      <>
        <Icon size={20} aria-hidden />
        <span>{action.title}</span>
      </>
    );
    const close = () => setMenuOpen(false);
    if (action.to) {
      return (
        <Link key={action.key} to={action.to} role="menuitem" className={className} onClick={close}>
          {content}
        </Link>
      );
    }
    if (action.href) {
      return (
        <a key={action.key} href={action.href} role="menuitem" className={className} onClick={close}>
          {content}
        </a>
      );
    }
    return (
      <button
        key={action.key}
        type="button"
        role="menuitem"
        aria-pressed={action.pressed}
        className={className}
        onClick={() => {
          close();
          action.onSelect?.();
        }}
      >
        {content}
      </button>
    );
  };

  return (
    <div
      ref={rootRef}
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
          {barActions.length > 0 && (
            <div className="floating-controls-actions" aria-hidden={collapsed}>
              {barActions.map(renderBarAction)}
            </div>
          )}
          {inSideColumn && showMore && (
            <button
              ref={moreRef}
              type="button"
              className={clsx(
                "control-button floating-controls-more grid h-9 w-9 place-items-center",
                isMenuOpen && "is-open",
              )}
              aria-label={t("更多操作")}
              title={t("更多操作")}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              onClick={toggleMenu}
            >
              <Ellipsis size={16} />
            </button>
          )}
          {!inSideColumn && (
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
          )}
        </div>
        {isMenuOpen && (
          <div
            ref={menuRef}
            className="floating-controls-menu"
            role="menu"
            aria-label={t("更多操作")}
          >
            {menuActions.map(renderMenuAction)}
          </div>
        )}
        {showColorPicker && colorsMounted && (
          <Suspense fallback={null}>
            <MetricColorPicker hidden={collapsed || !colorsOpen} />
          </Suspense>
        )}
        {showSyncWarning && !collapsed && !colorsOpen && !isMenuOpen && (
          <div className="floating-controls-sync-warning pointer-events-none flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--status-offline)_32%,transparent)] bg-[color-mix(in_srgb,var(--surface-a)_90%,transparent)] px-3 py-1 text-[11px] font-medium text-(--status-offline) shadow-[0_10px_25px_-18px_rgba(0,0,0,0.8)] backdrop-blur">
            <AlertTriangle size={12} />
            <span>{t("实时状态同步异常，当前展示的是最近缓存")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
