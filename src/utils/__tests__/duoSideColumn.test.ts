import { describe, expect, it } from "vitest";
import { columnVisibleCount, isCameraAtColumnBottom, pickSideColumn } from "@/utils/duoSideColumn";

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
