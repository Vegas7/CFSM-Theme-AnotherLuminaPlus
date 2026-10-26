import { describe, expect, it } from "vitest";
import { buildSparkline, monotonePath, sparklineRange } from "../sparklineGeometry";

/** 从路径里取出所有数字对，检查控制点有没有冲出数据范围。 */
function pathYs(d: string): number[] {
  const numbers = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  return numbers.filter((_, index) => index % 2 === 1);
}

describe("sparklineRange", () => {
  it("returns null when there are no samples", () => {
    expect(sparklineRange([null, null])).toBeNull();
  });

  it("widens a flat series so small jitter is not exaggerated", () => {
    const range = sparklineRange([100, 101, 100, 102]);
    expect(range).not.toBeNull();
    // 均值约 100.75，最小跨度 max(8, 15%) ≈ 15.1
    expect(range!.hi - range!.lo).toBeGreaterThanOrEqual(15);
  });

  it("keeps the real range when it is already wide", () => {
    expect(sparklineRange([20, 80, 50])).toEqual({ lo: 20, hi: 80 });
  });
});

describe("buildSparkline", () => {
  it("places one point per bucket at the slot centre", () => {
    const geometry = buildSparkline([30, 40, 35], { height: 20 });
    expect(geometry.width).toBe(30);
    expect(geometry.points.map((point) => point?.x)).toEqual([5, 15, 25]);
  });

  it("breaks the curve where buckets have no sample", () => {
    const geometry = buildSparkline([30, 40, null, null, 35, 38], { height: 20 });
    expect(geometry.lines).toHaveLength(2);
    expect(geometry.areas).toHaveLength(2);
    expect(geometry.points[2]).toBeNull();
  });

  it("draws nothing for an empty series", () => {
    const geometry = buildSparkline([null, null, null], { height: 16 });
    expect(geometry.lines).toEqual([]);
    expect(geometry.points.every((point) => point === null)).toBe(true);
  });

  it("puts higher latency higher up and keeps every point inside the box", () => {
    const geometry = buildSparkline([20, 80], { height: 20 });
    const [low, high] = geometry.points;
    expect(high!.y).toBeLessThan(low!.y);
    for (const point of geometry.points) {
      expect(point!.y).toBeGreaterThanOrEqual(0);
      expect(point!.y).toBeLessThanOrEqual(20);
    }
  });
});

describe("monotonePath", () => {
  it("does not overshoot between samples", () => {
    const points = [
      { x: 5, y: 10 },
      { x: 15, y: 2 },
      { x: 25, y: 2 },
      { x: 35, y: 18 },
    ];
    const ys = pathYs(monotonePath(points));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...ys)).toBeLessThanOrEqual(18);
  });

  it("draws a short dash for a single sample", () => {
    expect(monotonePath([{ x: 15, y: 8 }])).toBe("M11.5,8L18.5,8");
  });
});
