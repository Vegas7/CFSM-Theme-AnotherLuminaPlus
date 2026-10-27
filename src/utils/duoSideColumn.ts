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
 * iOS 27.2 起主屏幕 App 也不再让页面延伸到这一列下面：左右安全区都报 0，页面本身窄 84px
 * （外屏竖放 382、横放 594），这一列在页面之外，页面画不进去。于是这里检测不到侧栏，快捷按钮回到右上角，
 * 与普通 iPhone 一样。代码保留：以后的 iOS 再把这一列还给页面时，按钮会自动回到侧栏里。
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

export function pickSideColumn(input: {
  eligible: boolean;
  insets: SafeAreaInsets;
  portrait: boolean;
}): SideColumnSide | null {
  if (!input.eligible) return null;
  const { left, right } = input.insets;
  const minInset = input.portrait ? PORTRAIT_MIN_INSET : LANDSCAPE_MIN_INSET;
  if (right >= minInset && right >= left) return "right";
  if (left >= minInset) return "left";
  return null;
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

  const update = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const side =
      sim.side ??
      pickSideColumn({
        eligible: isIPhone && isStandalone,
        insets: readInsets(),
        portrait: height > width,
      });
    const camBottom =
      side !== null &&
      (sim.camBottom ||
        isCameraAtColumnBottom({ side, width, height, rotatedClockwise: rotatedClockwise() }));
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
  // 兜底：ResizeObserver 对隐藏的探针不一定触发。只在 iPhone 主屏幕 App 里每秒比对一次，有变化才重新检测。
  if (isIPhone && isStandalone) {
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
