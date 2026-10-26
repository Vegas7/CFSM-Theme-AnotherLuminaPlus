import { memo, useState } from "react";
import { clsx } from "clsx";
import { useMetricColorsVersion } from "@/hooks/useMetricColors";
import { usePreferences } from "@/hooks/usePreferences";
import { useThemeSettings } from "@/hooks/useThemeSettings";
import type { HomepagePingDisplayLine } from "@/types/cfsm";
import { resolveCustomLatencyColor, resolveCustomLossColor } from "@/utils/metricTone";
import { HealthBucketTooltip } from "./HealthBucketTooltip";
import { LatencyBars } from "./LatencyBars";
import { LatencySparklineChart } from "./LatencySparkline";
import { PingLineSwitcher } from "./PingLineSwitcher";
import { QualityBars } from "./QualityBars";
import { formatHealthBucketTooltip } from "./pingBucketText";
import { t, useLang } from "@/i18n";

type MultiPingStatusDensity = "large" | "compact";
type MultiPingMetric = "latency" | "loss";

const MultiPingMetricRow = memo(function MultiPingMetricRow({
  uuid,
  slot,
  line,
  metric,
  density,
  redrawKey,
}: {
  uuid: string;
  slot: number;
  line: HomepagePingDisplayLine;
  metric: MultiPingMetric;
  density: MultiPingStatusDensity;
  redrawKey: string;
}) {
  useLang();
  const themeSettings = useThemeSettings();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const latencyColor = resolveCustomLatencyColor(
    line.lastValue,
    themeSettings.pingLatencyThresholds,
    themeSettings.pingLatencyColors,
  );
  const lossColor = resolveCustomLossColor(
    line.loss,
    themeSettings.pingLossThresholds,
    themeSettings.pingLossColors,
  );
  const isLoading = line.loadState === "pending";
  const isError = line.loadState === "error";
  const staleError = isError && (line.lastValue != null || line.loss != null);
  const latencyLabel =
    isLoading && line.lastValue == null
      ? t("加载中")
      : isError && line.lastValue == null
        ? t("加载失败")
        : line.lastValue == null
          ? t("无样本")
          : `${Math.round(line.lastValue)}ms`;
  const lossLabel =
    isLoading && line.loss == null
      ? t("加载中")
      : isError && line.loss == null
        ? t("加载失败")
        : line.loss == null
          ? "—"
          : `${line.loss.toFixed(1)}%`;
  const hoveredBucket =
    hoveredIndex == null ? null : (line.buckets[hoveredIndex] ?? null);
  const tooltip = hoveredBucket
    ? formatHealthBucketTooltip(hoveredBucket, metric)
    : null;
  const chartHeight = density === "compact" ? 9 : 11;
  const value = metric === "latency" ? line.lastValue : line.loss;
  const valueColor = metric === "latency" ? latencyColor : lossColor;
  const unit = metric === "latency" ? "ms" : "%";
  const waiting = isLoading && value == null;
  const displayValue =
    waiting
      ? "..."
      : isError && value == null
        ? "!"
        : value == null
          ? "—"
          : metric === "latency"
            ? Math.round(value)
            : value.toFixed(1);
  return (
    <div
      className="multi-ping-metric-row"
      data-load-state={line.loadState ?? "ready"}
      title={`${t("{name} · 延迟 {latency} · 丢包 {loss}", { name: line.taskName, latency: latencyLabel, loss: lossLabel })}${
        staleError ? t(" · 刷新失败，显示上次数据") : ""
      }`}
    >
      <div
        className={clsx(
          "multi-ping-metric-head",
          metric === "loss" && "is-value-only",
        )}
      >
        {metric === "latency" && (
          <PingLineSwitcher uuid={uuid} slot={slot} taskName={line.taskName} />
        )}
        <strong
          className="multi-ping-value tabular"
          style={{
            color: value == null ? "var(--text-tertiary)" : valueColor,
          }}
        >
          {displayValue}
          {value != null && <small>{unit}</small>}
        </strong>
      </div>
      <span className="multi-ping-buckets" title="">
        {metric === "latency" ? (
          <LatencyBars
            buckets={line.buckets}
            redrawKey={redrawKey}
            height={chartHeight}
            onHoverIndex={setHoveredIndex}
          />
        ) : (
          <QualityBars
            buckets={line.buckets}
            redrawKey={redrawKey}
            height={chartHeight}
            onHoverIndex={setHoveredIndex}
          />
        )}
        <HealthBucketTooltip
          text={tooltip}
          index={hoveredIndex}
          count={line.buckets.length}
        />
      </span>
    </div>
  );
});

/**
 * 「曲线」模式下的一行：圆点 + 线路名 · 当前延迟 · 曲线 · 丢包，一条线路占一行（点阵模式是左右两列）。
 * 圆点、数值与曲线同色，跟着当前延迟变；丢包只显示数字。
 */
const MultiPingLineRow = memo(function MultiPingLineRow({
  uuid,
  slot,
  line,
  density,
}: {
  uuid: string;
  slot: number;
  line: HomepagePingDisplayLine;
  density: MultiPingStatusDensity;
}) {
  useLang();
  const themeSettings = useThemeSettings();
  const latencyColor = resolveCustomLatencyColor(
    line.lastValue,
    themeSettings.pingLatencyThresholds,
    themeSettings.pingLatencyColors,
  );
  const lossColor = resolveCustomLossColor(
    line.loss,
    themeSettings.pingLossThresholds,
    themeSettings.pingLossColors,
  );
  const isLoading = line.loadState === "pending";
  const isError = line.loadState === "error";
  const staleError = isError && (line.lastValue != null || line.loss != null);
  const latencyText =
    isLoading && line.lastValue == null
      ? "..."
      : isError && line.lastValue == null
        ? "!"
        : line.lastValue == null
          ? "—"
          : String(Math.round(line.lastValue));
  const lossText =
    isLoading && line.loss == null
      ? "..."
      : line.loss == null
        ? "—"
        : `${line.loss.toFixed(1)}%`;
  return (
    <div
      className="multi-ping-line-row"
      data-load-state={line.loadState ?? "ready"}
      title={`${t("{name} · 延迟 {latency} · 丢包 {loss}", {
        name: line.taskName,
        latency: line.lastValue == null ? latencyText : `${latencyText}ms`,
        loss: lossText,
      })}${staleError ? t(" · 刷新失败，显示上次数据") : ""}`}
    >
      <span
        className="multi-ping-line-dot"
        style={{ background: line.lastValue == null ? "var(--text-tertiary)" : latencyColor }}
        aria-hidden
      />
      <PingLineSwitcher uuid={uuid} slot={slot} taskName={line.taskName} />
      <strong
        className="multi-ping-value multi-ping-line-value tabular"
        style={{ color: line.lastValue == null ? "var(--text-tertiary)" : latencyColor }}
      >
        {latencyText}
        {line.lastValue != null && <small>ms</small>}
      </strong>
      <LatencySparklineChart
        className="multi-ping-line-chart"
        buckets={line.buckets}
        value={line.lastValue}
        height={density === "compact" ? 16 : 20}
      />
      <span className="multi-ping-line-loss tabular">
        <span>{t("丢包")}</span>
        <strong style={{ color: line.loss == null ? "var(--text-tertiary)" : lossColor }}>
          {lossText}
        </strong>
      </span>
    </div>
  );
});

const MultiPingMetricColumn = memo(function MultiPingMetricColumn({
  uuid,
  lines,
  metric,
  density,
  redrawKey,
}: {
  uuid: string;
  lines: HomepagePingDisplayLine[];
  metric: MultiPingMetric;
  density: MultiPingStatusDensity;
  redrawKey: string;
}) {
  useLang();
  return (
    <div
      className="multi-ping-metric-column"
      aria-label={metric === "latency" ? t("延迟") : t("丢包")}
    >
      {lines.map((line, slot) => (
        // 按行号当 key，不按线路 id：访客在这一行换了线路（PingLineSwitcher）后还是同一行、
        // 同一颗按钮，焦点能回到它身上；按线路 id 会让整行卸载重建。
        <MultiPingMetricRow
          key={slot}
          uuid={uuid}
          slot={slot}
          line={line}
          metric={metric}
          density={density}
          redrawKey={redrawKey}
        />
      ))}
    </div>
  );
});

export const MultiPingStatus = memo(function MultiPingStatus({
  uuid,
  lines,
  density,
  className,
}: {
  uuid: string;
  lines: HomepagePingDisplayLine[];
  density: MultiPingStatusDensity;
  className?: string;
}) {
  useLang();
  const { resolvedAppearance } = usePreferences();
  const colorsVersion = useMetricColorsVersion();
  const themeSettings = useThemeSettings();
  const redrawKey = `${resolvedAppearance}:${colorsVersion}`;

  if (themeSettings.homepagePingStyle === "line") {
    return (
      <div
        className={clsx("multi-ping-status", "is-line", `is-${density}`, className)}
        role="group"
        aria-label={t("各线路延迟与丢包")}
      >
        {lines.map((line, slot) => (
          // 与点阵模式一样按行号当 key，换线路后还是同一行（见 MultiPingMetricColumn）。
          <MultiPingLineRow key={slot} uuid={uuid} slot={slot} line={line} density={density} />
        ))}
      </div>
    );
  }

  return (
    <div
      className={clsx("multi-ping-status", `is-${density}`, className)}
      role="group"
      aria-label={t("各线路延迟与丢包")}
    >
      <div className="multi-ping-columns">
        <MultiPingMetricColumn
          uuid={uuid}
          lines={lines}
          metric="latency"
          density={density}
          redrawKey={redrawKey}
        />
        <MultiPingMetricColumn
          uuid={uuid}
          lines={lines}
          metric="loss"
          density={density}
          redrawKey={redrawKey}
        />
      </div>
    </div>
  );
});
