import { describe, expect, it } from "vitest";
import {
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
  const duo = { touchIOS: true, isIPhoneUA: true, screenWidth: 466, screenHeight: 678 };

  it("recognises the outer and inner displays when the page covers the screen", () => {
    expect(isDuoFullScreen({ ...duo, width: 466, height: 678 })).toBe(true);
    expect(isDuoFullScreen({ ...duo, width: 678, height: 466 })).toBe(true);
    const inner = { ...duo, screenWidth: 669, screenHeight: 951 };
    expect(isDuoFullScreen({ ...inner, width: 669, height: 951 })).toBe(true);
    expect(isDuoFullScreen({ ...inner, width: 951, height: 669 })).toBe(true);
  });

  it("ignores a page that is narrower than the screen (Safari's opaque column)", () => {
    expect(isDuoFullScreen({ ...duo, width: 382, height: 580 })).toBe(false);
    expect(isDuoFullScreen({ ...duo, width: 594, height: 420 })).toBe(false);
  });

  it("ignores regular iPhones, iPads and non-touch devices", () => {
    expect(
      isDuoFullScreen({ ...duo, screenWidth: 393, screenHeight: 852, width: 393, height: 852 }),
    ).toBe(false);
    expect(
      isDuoFullScreen({ ...duo, screenWidth: 393, screenHeight: 852, width: 852, height: 393 }),
    ).toBe(false);
    // iPad 分屏：窗口很方，但屏幕短边远超 Duo
    expect(
      isDuoFullScreen({
        touchIOS: true,
        isIPhoneUA: false,
        screenWidth: 820,
        screenHeight: 1180,
        width: 590,
        height: 820,
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
