/**
 * iPhone Duo 主屏幕 App（PWA）的透明侧栏。
 *
 * 折叠态 / 展开态的 Duo 以主屏幕 App 打开时，系统状态栏放在摄像头一侧的一列里，这一列是透明的，
 * 页面延伸到它下面，并通过 safe-area-inset-left / right（约 84px，内外屏都是）告知。
 * 竖持时在右侧；横持时随旋转方向在左侧或右侧。检测到后在 <html> 上挂：
 *   has-side-column + side-left / side-right：快捷按钮竖排放进这一列（见 surface.css）
 *   cam-bottom：外屏向右（顺时针）横放时摄像头落在侧栏底部，按钮整体上移避让
 * Safari 里那一列是 Safari 自己的浏览器栏（不透明，页面放不进去），不处理。
 *
 * iOS 27.2 起情况分两种（真机实测）：
 *   - 页面放在侧栏旁边：页面本身窄 84px（外屏竖放 382×678、内屏横放 867×669），安全区全是 0。
 *     侧栏在页面之外，什么都不用做，按钮留在右上角。
 *   - 页面铺到侧栏下面：安全区只报二三十像素甚至 0（实际仍是 84px 宽），光看安全区会漏检。
 * 两种情况靠页面自己的长宽比区分：铺满时就是整块屏幕的比例（外屏 466×678 ≈ 1.455、内屏 951×669 ≈ 1.42）；
 * 窄掉 84px 后竖放变长（1.63–1.78）、横放变方（1.28–1.30）。普通 iPhone 都在 1.77 以上。
 * 不能拿 screen 尺寸比：展开后 screen 仍报外屏的 466×678。
 * 认出铺满后侧栏宽度至少按 84px 算（见 surface.css）；在哪一侧先看哪边安全区大，两边都是 0 时
 * 竖持在右、横持按旋转方向（顺时针转在右，实测内屏 window.orientation -90 时侧栏在右）。
 * 页面放在侧栏旁边还是下面由 iOS 决定，跟状态栏样式有关（见 index.html 的 apple-mobile-web-app-status-bar-style）。
 *
 * 电脑上测试：网址加 ?column（右侧）或 ?column=left 模拟 84px 侧栏，?cam=bottom 模拟摄像头在底部。
 */

export type SideColumnSide = "left" | "right";

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** 竖持：普通 iPhone 左右安全区为 0，大于 40 即为侧栏。 */
const PORTRAIT_MIN_INSET = 40;
/** 横持：普通 iPhone 灵动岛一侧也有安全区（最多约 62px），Duo 的侧栏为 84px，阈值取 70。 */
const LANDSCAPE_MIN_INSET = 70;
/** 外屏横放宽度约 678，内屏横放约 890–951；只有外屏的摄像头在侧栏里，内屏是屏下摄像头。 */
const OUTER_DISPLAY_MAX_WIDTH = 720;
/**
 * 页面铺满 Duo 一块屏幕时的长宽比：外屏 466×678 ≈ 1.455、内屏 951×669 ≈ 1.42。
 * 页面被放到侧栏旁边（窄 84px）时：外屏竖放 382×678 ≈ 1.78、内屏竖放约 585×951 ≈ 1.63、
 * 外屏横放 594×466 ≈ 1.27、内屏横放 867×669 ≈ 1.30，都落在区间外；普通 iPhone 都在 1.77 以上。
 */
const DUO_MIN_ASPECT = 1.38;
const DUO_MAX_ASPECT = 1.5;
/** iPad 的屏幕短边至少 744：UA 里没有 iPhone 时用它排除 iPad（分屏时窗口也可能很方）。 */
const DUO_MAX_SHORT_SIDE = 740;

/**
 * 这台设备是不是 iPhone Duo：screen 恒报外屏的 466×678（展开后也一样），长宽比约 1.455；
 * 普通 iPhone 的屏幕都在 1.77 以上，iPad 屏幕短边至少 744。
 * index.html 的首屏脚本里有一份同样的判断（那里不能 import），改这里要一起改。
 */
export function isDuoDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (!/iPhone/.test(navigator.userAgent) || navigator.maxTouchPoints <= 0) return false;
  const short = Math.min(window.screen?.width ?? 0, window.screen?.height ?? 0);
  const long = Math.max(window.screen?.width ?? 0, window.screen?.height ?? 0);
  return short > 0 && short <= DUO_MAX_SHORT_SIDE && long / short < 1.6;
}

/**
 * 主屏幕 App 的状态栏样式。只有 black-translucent 时 iOS 才让页面铺到状态栏下面；Duo 的状态栏就是侧栏，
 * iOS 27.2 起用 default 时页面被放到侧栏旁边（窄 84px），侧栏里放不了按钮。所以 Duo 上不论深浅色都用
 * black-translucent；普通 iPhone 照旧深色 black-translucent、浅色 default（浅色页面上白色状态栏字看不清）。
 */
export function appleStatusBarStyle(isDark: boolean): "black-translucent" | "default" {
  return isDark || isDuoDevice() ? "black-translucent" : "default";
}

/**
 * 页面是不是铺满了一块 Duo 的屏幕（延伸到侧栏下面），按页面自己的长宽比判断。
 * Safari 里那一列是不透明的浏览器栏、主屏幕 App 被系统放在侧栏旁边时，页面都窄 84px，比例对不上，不算。
 */
export function isDuoFullScreen(input: {
  touchIOS: boolean;
  isIPhoneUA: boolean;
  screenWidth: number;
  screenHeight: number;
  width: number;
  height: number;
}): boolean {
  if (!input.touchIOS) return false;
  // UA 里没有 iPhone（比如被当成 iPad / 桌面版）时，靠屏幕短边排除真正的 iPad。
  const screenShort = Math.min(input.screenWidth, input.screenHeight);
  if (!input.isIPhoneUA && screenShort > DUO_MAX_SHORT_SIDE) return false;
  const short = Math.min(input.width, input.height);
  const long = Math.max(input.width, input.height);
  if (short <= 0 || short > DUO_MAX_SHORT_SIDE) return false;
  const aspect = long / short;
  return aspect >= DUO_MIN_ASPECT && aspect <= DUO_MAX_ASPECT;
}

export function pickSideColumn(input: {
  /** iPhone 主屏幕 App：按安全区判断（iOS 27.2 以前系统会报完整的 84px）。 */
  eligible: boolean;
  insets: SafeAreaInsets;
  portrait: boolean;
  /** 页面铺满 Duo 的屏幕（见 isDuoFullScreen）：安全区报小了也认。 */
  duoFullScreen?: boolean;
  rotatedClockwise?: boolean;
}): SideColumnSide | null {
  const { left, right } = input.insets;
  if (input.eligible) {
    const minInset = input.portrait ? PORTRAIT_MIN_INSET : LANDSCAPE_MIN_INSET;
    if (right >= minInset && right >= left) return "right";
    if (left >= minInset) return "left";
  }
  if (!input.duoFullScreen) return null;
  if (right > left) return "right";
  if (left > right) return "left";
  // 两边都没报：竖持在右；外屏横放时侧栏在摄像头那一侧 —— 顺时针转摄像头到右下，逆时针到左上。
  if (input.portrait) return "right";
  return input.rotatedClockwise ? "right" : "left";
}

/** 外屏向右（顺时针）横放：摄像头在侧栏底部。 */
export function isCameraAtColumnBottom(input: {
  side: SideColumnSide | null;
  width: number;
  height: number;
  rotatedClockwise: boolean;
}): boolean {
  return (
    input.side !== null &&
    input.width > input.height &&
    input.width <= OUTER_DISPLAY_MAX_WIDTH &&
    input.rotatedClockwise
  );
}

function readSimulation(): { side: SideColumnSide | null; camBottom: boolean } {
  try {
    const params = new URLSearchParams(window.location.search);
    const side = params.has("column") ? (params.get("column") === "left" ? "left" : "right") : null;
    return { side, camBottom: params.get("cam") === "bottom" };
  } catch {
    return { side: null, camBottom: false };
  }
}

function rotatedClockwise(): boolean {
  // iOS：window.orientation = -90 即顺时针；其他浏览器看 screen.orientation.angle = 270。
  const legacy = (window as Window & { orientation?: unknown }).orientation;
  if (typeof legacy === "number") return legacy === -90;
  const angle = window.screen?.orientation?.angle;
  return typeof angle === "number" && angle === 270;
}

/**
 * iPhone Duo 侧栏里按钮栏的尺寸，与 surface.css 侧栏一节保持一致：
 * 顶部 174px 留给系统图标；按钮栏每项 52px、上下内边距共 6px；圆钮 48px，与按钮栏间隔 12px。
 */
export const COLUMN_TOP_RESERVE = 174;
export const COLUMN_ITEM_HEIGHT = 52;
export const COLUMN_BAR_PADDING = 6;
export const COLUMN_CIRCLE_SLOT = 48 + 12;

/** 侧栏里按钮栏能放下几项：全部放得下就不要「⋯」；否则留出「⋯」圆钮的位置再算。 */
export function columnVisibleCount(available: number, total: number): number {
  if (total * COLUMN_ITEM_HEIGHT + COLUMN_BAR_PADDING <= available) return total;
  const room = available - COLUMN_CIRCLE_SLOT - COLUMN_BAR_PADDING;
  return Math.max(0, Math.min(total, Math.floor(room / COLUMN_ITEM_HEIGHT)));
}

let currentSide: SideColumnSide | null = null;
const listeners = new Set<() => void>();
let installed = false;
let collectDebug: (() => Record<string, unknown>) | null = null;

/**
 * 侧栏检测用到的原始数据与结论，设置页的诊断信息据此显示（真机上没法开 Web Inspector 时靠它排查）。
 * 每次调用都现读，不缓存。
 */
export function getSideColumnDebug(): Record<string, unknown> | null {
  return collectDebug?.() ?? null;
}

export function getSideColumnSide(): SideColumnSide | null {
  return currentSide;
}

export function subscribeSideColumn(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 启动检测（幂等）。在挂载 React 之前调用，首屏就带上正确的类名。 */
export function installSideColumnDetection(): void {
  if (installed || typeof window === "undefined" || typeof document === "undefined") return;
  installed = true;

  const root = document.documentElement;
  const sim = readSimulation();
  if (sim.side) root.classList.add(sim.side === "left" ? "sim-col-left" : "sim-col-right");

  const isIPhone = /iPhone/.test(navigator.userAgent) && navigator.maxTouchPoints > 0;
  const touchIOS = /iPhone|iPad|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 0;
  const isStandalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches);

  // env() 只能在 CSS 里取值：用一个隐藏的探针元素把安全区换算成像素。
  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
    "padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);";
  document.body.appendChild(probe);
  const readInsets = (): SafeAreaInsets => {
    const cs = getComputedStyle(probe);
    return {
      top: parseFloat(cs.paddingTop) || 0,
      right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
      left: parseFloat(cs.paddingLeft) || 0,
    };
  };

  const readInputs = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const clockwise = rotatedClockwise();
    const insets = readInsets();
    const duoFullScreen = isDuoFullScreen({
      touchIOS,
      isIPhoneUA: isIPhone,
      screenWidth: window.screen?.width ?? 0,
      screenHeight: window.screen?.height ?? 0,
      width,
      height,
    });
    return { width, height, clockwise, insets, duoFullScreen };
  };

  collectDebug = () => {
    const { width, height, clockwise, insets, duoFullScreen } = readInputs();
    const legacyOrientation = (window as Window & { orientation?: unknown }).orientation;
    const rootStyle = getComputedStyle(root);
    const main = document.querySelector(".app-main");
    return {
      version: document.querySelector<HTMLMetaElement>('meta[name="theme-version"]')?.content ?? "dev",
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
      isIPhone,
      touchIOS,
      navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone ?? null,
      displayModeStandalone:
        typeof window.matchMedia === "function"
          ? window.matchMedia("(display-mode: standalone)").matches
          : null,
      isStandalone,
      displayMode:
        typeof window.matchMedia === "function"
          ? (["fullscreen", "standalone", "minimal-ui", "browser"].find(
              (mode) => window.matchMedia(`(display-mode: ${mode})`).matches,
            ) ?? "none")
          : null,
      manifest:
        document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href.slice(0, 80) ?? null,
      inner: `${width}×${height}`,
      client: `${root.clientWidth}×${root.clientHeight}`,
      visualViewport: window.visualViewport
        ? `${Math.round(window.visualViewport.width)}×${Math.round(window.visualViewport.height)}`
        : null,
      screen: `${window.screen?.width}×${window.screen?.height}`,
      screenAvail: `${window.screen?.availWidth}×${window.screen?.availHeight}`,
      devicePixelRatio: window.devicePixelRatio,
      statusBarStyle:
        document.querySelector<HTMLMetaElement>(
          'meta[name="apple-mobile-web-app-status-bar-style"]',
        )?.content ?? null,
      isDuoDevice: isDuoDevice(),
      safeArea: `top ${insets.top} · right ${insets.right} · bottom ${insets.bottom} · left ${insets.left}`,
      orientation: `window.orientation ${String(legacyOrientation)} · screen ${window.screen?.orientation?.type ?? "?"} ${window.screen?.orientation?.angle ?? "?"}`,
      rotatedClockwise: clockwise,
      duoFullScreen,
      simulated: sim.side,
      side: currentSide,
      htmlClasses: root.className,
      colL: rootStyle.getPropertyValue("--col-l").trim(),
      colR: rootStyle.getPropertyValue("--col-r").trim(),
      appMainPadding: main
        ? `${getComputedStyle(main).paddingLeft} / ${getComputedStyle(main).paddingRight}`
        : null,
    };
  };

  const update = () => {
    const { width, height, clockwise, insets, duoFullScreen } = readInputs();
    const side =
      sim.side ??
      pickSideColumn({
        eligible: isIPhone && isStandalone,
        insets,
        portrait: height > width,
        duoFullScreen,
        rotatedClockwise: clockwise,
      });
    const camBottom =
      side !== null &&
      (sim.camBottom ||
        isCameraAtColumnBottom({ side, width, height, rotatedClockwise: clockwise }));
    root.classList.toggle("has-side-column", side !== null);
    root.classList.toggle("side-left", side === "left");
    root.classList.toggle("side-right", side === "right");
    root.classList.toggle("cam-bottom", camBottom);
    if (side !== currentSide) {
      currentSide = side;
      for (const listener of listeners) listener();
    }
  };

  update();
  window.addEventListener("resize", update);
  window.addEventListener("orientationchange", update);
  // 左右横屏直接互转（180°）时尺寸不变、不一定触发 resize，单独监听方向变化。
  window.screen?.orientation?.addEventListener?.("change", update);
  // 冷启动（从多任务关闭后重新打开）时，iOS 会在首次脚本执行之后才给出侧栏的安全区，且不触发 resize：
  // 安全区一到位就重新检测；另在加载完成、回到前台以及启动后几秒内补检几次。
  if ("ResizeObserver" in window) {
    try {
      new ResizeObserver(update).observe(probe, { box: "border-box" });
    } catch {
      /* 旧 Safari 不支持 box 选项 */
    }
  }
  window.addEventListener("load", update);
  window.addEventListener("pageshow", update);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") update();
  });
  requestAnimationFrame(() => requestAnimationFrame(update));
  for (const ms of [150, 500, 1000, 2000, 3000]) window.setTimeout(update, ms);
  // 兜底：ResizeObserver 对隐藏的探针不一定触发。iOS 触屏设备上每秒比对一次，有变化才重新检测。
  // 不再要求主屏幕 App：系统换了报法时 standalone 也可能判不准，比对一次的开销可以忽略。
  if (touchIOS) {
    let lastKey = "";
    window.setInterval(() => {
      const sa = readInsets();
      const key = `${sa.top},${sa.right},${sa.bottom},${sa.left},${window.innerWidth}x${window.innerHeight}`;
      if (key !== lastKey) {
        lastKey = key;
        update();
      }
    }, 1000);
  }
}
