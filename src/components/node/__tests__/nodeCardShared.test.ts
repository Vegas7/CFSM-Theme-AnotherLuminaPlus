import { describe, expect, it } from "vitest";
import type { PingOverviewBucket } from "@/types/cfsm";
import {
  formatCompactBillingCycle,
  formatCompactExpire,
  getBarGeometry,
  healthBarInteractionModel,
  healthBarSlotModel,
  snapBarRect,
  snapBarTop,
} from "@/components/node/nodeCardShared";

function bucket(value: number | null, loss: number | null = 0): PingOverviewBucket {
  return {
    index: 0,
    value,
    loss,
    total: value == null ? 0 : 1,
    lost: 0,
    startAt: null,
    endAt: null,
  };
}

describe("healthBarSlotModel", () => {
  it("keeps every valid latency bucket at one height while color carries severity", () => {
    const values = [0, 20, 55, 88.5, 151, 400];
    const slots = values.map((value) => healthBarSlotModel(bucket(value), "latency"));

    expect(slots.every((slot) => slot.active)).toBe(true);
    expect(new Set(slots.map((slot) => slot.heightFraction))).toEqual(new Set([0.84]));
    expect(slots.map((slot) => slot.color)).toEqual([
      "var(--latency-excellent)",
      "var(--latency-excellent)",
      "var(--latency-excellent)",
      "var(--latency-good)",
      "var(--latency-moderate)",
      "var(--latency-critical)",
    ]);
  });

  it("renders missing latency as a short neutral gap", () => {
    expect(healthBarSlotModel(bucket(null, null), "latency")).toMatchObject({
      active: false,
      heightFraction: 0.25,
      color: "var(--progress-bg)",
    });
  });

  it("keeps loss buckets on the same fixed-height visual language", () => {
    expect(healthBarSlotModel(bucket(20), "latency")).toMatchObject({
      active: true,
      heightFraction: 0.84,
      alpha: 0.94,
    });
    expect(healthBarSlotModel(bucket(20, 12.5), "loss")).toMatchObject({
      active: true,
      heightFraction: 0.84,
      alpha: 0.94,
    });
  });

  it("uses the shared hover lift and sibling fade for canvas renderers", () => {
    const slot = healthBarSlotModel(bucket(55), "latency");

    expect(healthBarInteractionModel(slot, true, 1)).toMatchObject({
      heightFraction: 1,
      alpha: 1,
    });
    expect(healthBarInteractionModel(slot, false, 1).alpha).toBeCloseTo(slot.alpha * 0.54);
    expect(healthBarInteractionModel(slot, true, 0)).toMatchObject({
      heightFraction: slot.heightFraction,
      alpha: slot.alpha,
    });
  });
});

describe("formatCompactExpire", () => {
  it("shows 永久 when no expiry date is set", () => {
    // 之前显示 "余 --",看不出是"没填"还是"算不出来"。
    expect(formatCompactExpire({ value: "—", unit: "" })).toBe("永久");
  });

  it("keeps the remaining-days form otherwise", () => {
    expect(formatCompactExpire({ value: "12", unit: "天" })).toBe("余 12天");
    expect(formatCompactExpire({ value: "长期", unit: "" })).toBe("长期");
  });
});

describe("formatCompactBillingCycle", () => {
  it("formats standard cycles correctly", () => {
    expect(formatCompactBillingCycle("month")).toBe("月付");
    expect(formatCompactBillingCycle(30)).toBe("月付");
    expect(formatCompactBillingCycle("quarter")).toBe("季付");
    expect(formatCompactBillingCycle(90)).toBe("季付");
    expect(formatCompactBillingCycle("half_year")).toBe("半年付");
    expect(formatCompactBillingCycle(180)).toBe("半年付");
    expect(formatCompactBillingCycle("year")).toBe("年付");
    expect(formatCompactBillingCycle(365)).toBe("年付");
    expect(formatCompactBillingCycle("two_years")).toBe("2年付");
    expect(formatCompactBillingCycle("三年付")).toBe("3年付");
    expect(formatCompactBillingCycle("three_years")).toBe("3年付");
    expect(formatCompactBillingCycle("four_years")).toBe("4年付");
    expect(formatCompactBillingCycle("five_years")).toBe("5年付");
    expect(formatCompactBillingCycle(1095)).toBe("3年付");
    expect(formatCompactBillingCycle("lifetime")).toBe("永久");
    expect(formatCompactBillingCycle(-1)).toBe("永久");
  });

  it("handles free price sentinel", () => {
    expect(formatCompactBillingCycle("year", -1)).toBe("免费");
  });

  it("falls back to 年付 for invalid or empty cycle values", () => {
    expect(formatCompactBillingCycle("")).toBe("年付");
    expect(formatCompactBillingCycle(null)).toBe("年付");
    expect(formatCompactBillingCycle(undefined)).toBe("年付");
  });
});

describe("snapBarRect", () => {
  // 175.95px 分 20 根 → 柱宽 6.9px，不取整时每条边都落在半像素上，边界列只有部分覆盖率。
  it("lands both edges of every bar on whole device pixels", () => {
    const geometry = getBarGeometry(175.95, 20);
    // 除以 dpr 会留下 1e-14 级的浮点尾数，栅格化看不出来，断言给个容差即可。
    const isWhole = (value: number) => Math.abs(value - Math.round(value)) < 1e-9;

    for (const dpr of [1, 1.25, 2]) {
      for (let index = 0; index < 20; index += 1) {
        const { x, width } = snapBarRect(index, geometry, dpr);
        expect(isWhole(x * dpr)).toBe(true);
        expect(isWhole((x + width) * dpr)).toBe(true);
      }
    }
  });

  it("keeps the row inside the track and every bar at least one device pixel wide", () => {
    const geometry = getBarGeometry(60, 20);
    const last = snapBarRect(19, geometry, 1);

    expect(snapBarRect(0, geometry, 1).x).toBe(0);
    expect(last.x + last.width).toBeLessThanOrEqual(60);
    expect(last.width).toBeGreaterThanOrEqual(1);
  });

  it("keeps each gap within one device pixel of the requested gap", () => {
    const geometry = getBarGeometry(175.95, 20);

    for (let index = 1; index < 20; index += 1) {
      const previous = snapBarRect(index - 1, geometry, 1);
      const current = snapBarRect(index, geometry, 1);
      const gap = current.x - (previous.x + previous.width);
      expect(Math.abs(gap - geometry.gap)).toBeLessThanOrEqual(1);
    }
  });
});

describe("snapBarTop", () => {
  it("rounds the top edge to whole device pixels", () => {
    expect(snapBarTop(11 - 11 * 0.84, 1)).toBe(2);
    expect(snapBarTop(2.4, 1)).toBe(2);
    expect(snapBarTop(2.4, 2)).toBe(2.5);
  });
});
