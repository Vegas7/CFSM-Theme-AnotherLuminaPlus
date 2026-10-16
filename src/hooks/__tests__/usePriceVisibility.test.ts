import { describe, expect, it } from "vitest";
import { resolvePriceVisibility } from "@/hooks/usePriceVisibility";

describe("resolvePriceVisibility", () => {
  it("shows prices to the logged-in owner by default; guests follow showPriceForGuests", () => {
    // 站长登录了就看得到，不受「公开资产」影响
    expect(resolvePriceVisibility(true, false, null)).toBe(true);
    expect(resolvePriceVisibility(true, true, null)).toBe(true);

    // 访客：只有开了「公开资产」才看得到
    expect(resolvePriceVisibility(false, false, null)).toBe(false);
    expect(resolvePriceVisibility(false, true, null)).toBe(true);
  });

  it("never lets a guest reveal prices through the override", () => {
    expect(resolvePriceVisibility(false, false, "visible")).toBe(false);
    expect(resolvePriceVisibility(true, false, "visible")).toBe(true);
  });

  it("respects the temporary hidden override (e.g. before taking a screenshot)", () => {
    expect(resolvePriceVisibility(true, true, "hidden")).toBe(false);
    expect(resolvePriceVisibility(false, true, "hidden")).toBe(false);
    expect(resolvePriceVisibility(true, false, "hidden")).toBe(false);
    expect(resolvePriceVisibility(false, false, "hidden")).toBe(false);
  });

  it("suppresses node card price tags when price visibility resolves to false", () => {
    const rawPrice = "¥30.00/月";
    expect(resolvePriceVisibility(false, false, null) ? rawPrice : null).toBeNull();
    expect(resolvePriceVisibility(true, false, null) ? rawPrice : null).toBe(rawPrice);
    expect(resolvePriceVisibility(true, false, "hidden") ? rawPrice : null).toBeNull();
    expect(resolvePriceVisibility(false, true, null) ? rawPrice : null).toBe(rawPrice);
  });
});
