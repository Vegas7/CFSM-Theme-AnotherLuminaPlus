import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appleStatusBarStyle,
  columnVisibleCount,
  isCameraAtColumnBottom,
  isDuoFullScreen,
  pickSideColumn,
} from "@/utils/duoSideColumn";

const insets = (left: number, right: number) => ({ top: 0, right, bottom: 0, left });

describe("pickSideColumn", () => {
  it("detects the Duo's 84px column on the right in portrait", () => {
    expect(pickSideColumn({ eligible: true, insets: insets(0, 84), portrait: true })).toBe("right");
  });

  it("follows the column to either side in landscape", () => {
    expect(pickSideColumn({ eligible: true, insets: insets(0, 84), portrait: false })).toBe("right");
    expect(pickSideColumn({ eligible: true, insets: insets(84, 0), portrait: false })).toBe("left");
  });

  it("ignores a regular iPhone's Dynamic Island inset in landscape", () => {
    expect(pickSideColumn({ eligible: true, insets: insets(59, 59), portrait: false })).toBeNull();
    expect(pickSideColumn({ eligible: true, insets: insets(62, 0), portrait: false })).toBeNull();
  });

  it("stays off outside the iPhone home-screen app", () => {
    expect(pickSideColumn({ eligible: false, insets: insets(0, 84), portrait: true })).toBeNull();
  });

  // iOS 27.2：页面仍铺到侧栏下面，但安全区只报二三十像素。
  it("still finds the column on a full-screen Duo when iOS under-reports the inset", () => {
    expect(pickSideColumn({ eligible: true, insets: insets(0, 28), portrait: true })).toBeNull();
    expect(
      pickSideColumn({ eligible: true, insets: insets(0, 28), portrait: true, duoFullScreen: true }),
    ).toBe("right");
    expect(
      pickSideColumn({ eligible: false, insets: insets(24, 0), portrait: false, duoFullScreen: true }),
    ).toBe("left");
  });

  it("falls back to portrait-right and the rotation direction when no inset is reported", () => {
    const zero = insets(0, 0);
    expect(pickSideColumn({ eligible: true, insets: zero, portrait: true, duoFullScreen: true })).toBe(
      "right",
    );
    expect(
      pickSideColumn({
        eligible: true,
        insets: zero,
        portrait: false,
        duoFullScreen: true,
        rotatedClockwise: true,
      }),
    ).toBe("right");
    expect(
      pickSideColumn({
        eligible: true,
        insets: zero,
        portrait: false,
        duoFullScreen: true,
        rotatedClockwise: false,
      }),
    ).toBe("left");
  });
});

describe("isDuoFullScreen", () => {
  // 展开后 screen 仍报外屏的 466×678（真机实测），所以内屏也用这组 screen。
  const duo = { touchIOS: true, isIPhoneUA: true, screenWidth: 466, screenHeight: 678 };

  it("recognises a page that runs under the column on either display", () => {
    expect(isDuoFullScreen({ ...duo, width: 466, height: 678 })).toBe(true);
    expect(isDuoFullScreen({ ...duo, width: 678, height: 466 })).toBe(true);
    expect(isDuoFullScreen({ ...duo, width: 669, height: 951 })).toBe(true);
    expect(isDuoFullScreen({ ...duo, width: 951, height: 669 })).toBe(true);
  });

  // iOS 27.2 真机：页面被放在侧栏旁边，窄 84px。
  it("ignores a page that iOS placed beside the column", () => {
    expect(isDuoFullScreen({ ...duo, width: 382, height: 678 })).toBe(false);
    expect(isDuoFullScreen({ ...duo, width: 594, height: 466 })).toBe(false);
    expect(isDuoFullScreen({ ...duo, width: 867, height: 669 })).toBe(false);
    expect(isDuoFullScreen({ ...duo, width: 585, height: 951 })).toBe(false);
  });

  it("ignores Safari's narrower page", () => {
    expect(isDuoFullScreen({ ...duo, width: 382, height: 580 })).toBe(false);
  });

  it("ignores regular iPhones, iPads and non-touch devices", () => {
    expect(
      isDuoFullScreen({ ...duo, screenWidth: 393, screenHeight: 852, width: 393, height: 852 }),
    ).toBe(false);
    expect(
      isDuoFullScreen({ ...duo, screenWidth: 393, screenHeight: 852, width: 852, height: 393 }),
    ).toBe(false);
    // iPad 分屏：窗口比例可能落在区间里，但屏幕短边远超 Duo
    expect(
      isDuoFullScreen({
        touchIOS: true,
        isIPhoneUA: false,
        screenWidth: 820,
        screenHeight: 1180,
        width: 560,
        height: 800,
      }),
    ).toBe(false);
    expect(isDuoFullScreen({ ...duo, touchIOS: false, width: 466, height: 678 })).toBe(false);
  });

  it("still works if the Duo stops saying iPhone in its user agent", () => {
    expect(isDuoFullScreen({ ...duo, isIPhoneUA: false, width: 466, height: 678 })).toBe(true);
  });
});

describe("isCameraAtColumnBottom", () => {
  it("lifts the buttons only on the outer display rotated clockwise", () => {
    expect(
      isCameraAtColumnBottom({ side: "right", width: 678, height: 466, rotatedClockwise: true }),
    ).toBe(true);
    expect(
      isCameraAtColumnBottom({ side: "left", width: 678, height: 466, rotatedClockwise: false }),
    ).toBe(false);
    // 内屏横放是屏下摄像头
    expect(
      isCameraAtColumnBottom({ side: "right", width: 951, height: 669, rotatedClockwise: true }),
    ).toBe(false);
    expect(
      isCameraAtColumnBottom({ side: null, width: 678, height: 466, rotatedClockwise: true }),
    ).toBe(false);
  });
});

describe("columnVisibleCount", () => {
  it("shows every button when they all fit, with no overflow menu", () => {
    // 外屏竖放的详情页：678 − 24 − 174 − 60 = 420，7 项需要 7×52+6 = 370
    expect(columnVisibleCount(420, 7)).toBe(7);
    expect(columnVisibleCount(370, 7)).toBe(7);
  });

  it("keeps room for the ⋯ button when some buttons overflow", () => {
    // 外屏横放的详情页：466 − 24 − 174 − 60 = 208，减去「⋯」60 与内边距 6 后放得下 2 项
    expect(columnVisibleCount(208, 7)).toBe(2);
    expect(columnVisibleCount(369, 7)).toBe(5);
  });

  it("never goes below zero or above the number of buttons", () => {
    expect(columnVisibleCount(40, 7)).toBe(0);
    expect(columnVisibleCount(-100, 3)).toBe(0);
    expect(columnVisibleCount(1000, 3)).toBe(3);
  });
});

describe("appleStatusBarStyle", () => {
  afterEach(() => vi.unstubAllGlobals());

  const stub = (userAgent: string, width: number, height: number) => {
    vi.stubGlobal("navigator", { userAgent, maxTouchPoints: 5 });
    vi.stubGlobal("screen", { width, height });
    vi.stubGlobal("window", { screen: { width, height } });
  };
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) Version/27.2 Mobile/15E148";

  it("keeps a regular iPhone's light status bar", () => {
    stub(IPHONE, 393, 852);
    expect(appleStatusBarStyle(false)).toBe("default");
    expect(appleStatusBarStyle(true)).toBe("black-translucent");
  });

  // Duo 的状态栏就是侧栏：只有 black-translucent 时页面才铺到它下面。
  it("always uses black-translucent on the Duo", () => {
    stub(IPHONE, 466, 678);
    expect(appleStatusBarStyle(false)).toBe("black-translucent");
    expect(appleStatusBarStyle(true)).toBe("black-translucent");
  });
});
