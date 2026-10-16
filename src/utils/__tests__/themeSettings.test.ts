import { describe, expect, it } from "vitest";
import { normalizeThemeSettings } from "@/utils/themeSettings";

describe("normalizeThemeSettings", () => {
  it("keeps mini and falls unknown saved view modes back to compact", () => {
    const settings = normalizeThemeSettings({
      desktopNodeViewMode: "retired-view",
      mobileNodeViewMode: "retired-view",
    } as never);

    expect(settings.desktopNodeViewMode).toBe("compact");
    expect(settings.mobileNodeViewMode).toBe("compact");
    expect(normalizeThemeSettings({ desktopNodeViewMode: "mini" }).desktopNodeViewMode).toBe(
      "mini",
    );
    expect(normalizeThemeSettings({ mobileNodeViewMode: "mini" }).mobileNodeViewMode).toBe("mini");
    expect(normalizeThemeSettings({ mobileNodeViewMode: "list" }).mobileNodeViewMode).toBe(
      "compact",
    );
  });

  it("defaults overview ratings on unless explicitly disabled, while asset rating defaults to false", () => {
    const defaults = normalizeThemeSettings({});
    expect(defaults.showOverviewRatings).toBe(true);
    expect(defaults.showBandwidthRating).toBe(true);
    expect(defaults.showAssetRating).toBe(false);

    expect(normalizeThemeSettings({ showOverviewRatings: false }).showOverviewRatings).toBe(false);
    expect(normalizeThemeSettings({ showAssetRating: true }).showAssetRating).toBe(true);
    expect(normalizeThemeSettings({ showBandwidthRating: false }).showBandwidthRating).toBe(false);
  });

  it("normalizes homepage multi-ping tasks while preserving an enabled draft for repair", () => {
    const untouched = normalizeThemeSettings({});
    expect(untouched.enableHomepageMultiPing).toBe(true);
    expect(untouched.homepageMultiPingTaskIds).toEqual([1, 2, 3]);
    expect(normalizeThemeSettings({ enableHomepageMultiPing: false }).enableHomepageMultiPing).toBe(
      false,
    );
    expect(
      normalizeThemeSettings({ homepageMultiPingTaskIds: [] }).homepageMultiPingTaskIds,
    ).toEqual([]);
    expect(
      normalizeThemeSettings({
        enableHomepageMultiPing: true,
        homepageMultiPingTaskIds: [3, 1],
      }).enableHomepageMultiPing,
    ).toBe(true);

    const resolved = normalizeThemeSettings({
      enableHomepageMultiPing: true,
      homepageMultiPingTaskIds: [3, 1, 3, 2, 4],
    });
    expect(resolved.enableHomepageMultiPing).toBe(true);
    expect(resolved.homepageMultiPingTaskIds).toEqual([3, 1, 2, 4]);
  });

  it("defaults home sort to weight ascending and falls back to a field's natural direction", () => {
    const base = normalizeThemeSettings({});
    expect(base.enableHomeSort).toBe(true);
    expect(base.homeSortField).toBe("default");
    expect(base.homeSortDirection).toBe("asc");

    // 指定字段但缺省方向 → 回落该字段自然方向(网速为降序)。
    expect(normalizeThemeSettings({ homeSortField: "speed" } as never).homeSortDirection).toBe("desc");
    // 非法字段回落 default。
    expect(normalizeThemeSettings({ homeSortField: "nope" } as never).homeSortField).toBe("default");
  });

  it("keeps the in-card asset entry and the floating entry as two independent switches (SAO)", () => {
    expect(normalizeThemeSettings({}).showCostSummary).toBe(true);
    expect(normalizeThemeSettings({}).showCostSummaryFloatingButton).toBe(true);
    const onlyFloating = normalizeThemeSettings({
      showCostSummary: false,
      showCostSummaryFloatingButton: true,
    } as never);
    expect(onlyFloating.showCostSummary).toBe(false);
    expect(onlyFloating.showCostSummaryFloatingButton).toBe(true);
  });

  it("clamps the renewal reminder window and treats 0 as off", () => {
    expect(normalizeThemeSettings({}).renewalReminderDays).toBe(7);
    expect(normalizeThemeSettings({ renewalReminderDays: 0 } as never).renewalReminderDays).toBe(0);
    expect(normalizeThemeSettings({ renewalReminderDays: 999 } as never).renewalReminderDays).toBe(60);
    expect(normalizeThemeSettings({ renewalReminderDays: -3 } as never).renewalReminderDays).toBe(0);
    // 写坏了回到默认，而不是 0（0 等于悄悄关掉提醒）。
    expect(normalizeThemeSettings({ renewalReminderDays: "later" } as never).renewalReminderDays).toBe(7);
  });

  it("keeps the homepage default group only when it is a non-empty string", () => {
    expect(normalizeThemeSettings({}).homeDefaultGroup).toBe("");
    expect(normalizeThemeSettings({ homeDefaultGroup: " 生产 " } as never).homeDefaultGroup).toBe("生产");
    expect(normalizeThemeSettings({ homeDefaultGroup: 12 } as never).homeDefaultGroup).toBe("");
  });

  it("puts offline nodes last unless asked otherwise", () => {
    expect(normalizeThemeSettings({}).offlineNodesFirst).toBe(false);
    expect(normalizeThemeSettings({ offlineNodesFirst: true } as never).offlineNodesFirst).toBe(true);
  });

  it("defaults showPriceForGuests to false unless explicitly enabled", () => {
    expect(normalizeThemeSettings({}).showPriceForGuests).toBe(false);
    expect(normalizeThemeSettings({ showPriceForGuests: true }).showPriceForGuests).toBe(true);
    expect(normalizeThemeSettings({ showPriceForGuests: false }).showPriceForGuests).toBe(false);
    expect(normalizeThemeSettings({ showPriceForGuests: "yes" } as never).showPriceForGuests).toBe(false);
  });

  it("parses hiddenNodes from a delimited string and dedupes", () => {
    expect(normalizeThemeSettings({}).hiddenNodes).toEqual([]);
    expect(
      normalizeThemeSettings({ hiddenNodes: "节点A, 节点A\nuuid-1；节点B" } as never).hiddenNodes,
    ).toEqual(["节点A", "uuid-1", "节点B"]);
  });

  it("normalizes and trims adminNickname cleanly", () => {
    expect(normalizeThemeSettings({}).adminNickname).toBe("");
    expect(normalizeThemeSettings({ adminNickname: "  jerry  " }).adminNickname).toBe("jerry");
  });
});
