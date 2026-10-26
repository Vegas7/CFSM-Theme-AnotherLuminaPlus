import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useThemeSettings } from "@/hooks/useThemeSettings";
import type {
  PingLatencyColors,
  PingLatencyThresholds,
  PingOverviewBucket,
} from "@/types/cfsm";
import { resolveCustomLatencyColor, resolveCustomLossColor } from "@/utils/metricTone";
import { supportsFineHover } from "@/utils/mediaQuery";
import { HealthBucketTooltip } from "./HealthBucketTooltip";
import { formatHealthBucketTooltip } from "./pingBucketText";
import { buildSparkline, lossSparklineRange } from "./sparklineGeometry";
import { resolveTouchBucketIndex, TOUCH_BUCKET_HOLD_MS } from "./touchBucketPick";

export type PingSparklineMetric = "latency" | "loss";

/** 这一格在曲线上的值：延迟取 value；丢包要这一格真有探测（total > 0）才算数，没探测的不当 0%。 */
function bucketValue(bucket: PingOverviewBucket, metric: PingSparklineMetric): number | null {
  if (metric === "latency") return bucket.value;
  return bucket.total > 0 && bucket.loss != null && Number.isFinite(bucket.loss) ? bucket.loss : null;
}

/**
 * 首页延迟 / 丢包的「曲线」模式（设置里「延迟图形 → 曲线」）。
 *
 * 平滑折线 + 渐变填充，整条的颜色按当前值取色（延迟、丢包各用自己的阈值和配色），数值一变颜色跟着变。
 * 延迟按这一行的数据自动缩放；丢包底边固定 0%、顶边至少 5%，没丢包时平平地贴着下方。
 * 节点掉线的格子在底边画一小段红色；延迟曲线里整轮超时的格子也这样标（丢包曲线里它就是 100% 的尖峰）。
 * 用 SVG 画，不建 canvas：迷你卡一屏几十张，和 MiniHealthBars 一样保持轻量。
 * 悬停 / 触屏点按的口径与点阵模式一致（按整条宽度均分到格，见 touchBucketPick），
 * 外层照旧用 HealthBucketTooltip 显示那一格的数值。
 */
export const PingSparkline = memo(function PingSparkline({
  buckets,
  metric = "latency",
  height = 16,
  value,
  onHoverIndex,
  latencyThresholds,
  latencyColors,
  className,
}: {
  buckets: PingOverviewBucket[];
  metric?: PingSparklineMetric;
  height?: number;
  /** 决定曲线颜色的当前值（延迟 ms 或丢包 %）；不传就取最后一个有样本的格子。 */
  value?: number | null;
  onHoverIndex?: (index: number | null) => void;
  latencyThresholds?: PingLatencyThresholds;
  latencyColors?: PingLatencyColors;
  className?: string;
}) {
  const themeSettings = useThemeSettings();
  const gradientId = useId();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const touchHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const values = useMemo(
    () => buckets.map((bucket) => bucketValue(bucket, metric)),
    [buckets, metric],
  );
  const geometry = useMemo(
    () =>
      buildSparkline(values, {
        height,
        range: metric === "loss" ? lossSparklineRange(values) : undefined,
      }),
    [values, height, metric],
  );

  const colorValue = useMemo(() => {
    if (value != null) return value;
    for (let i = values.length - 1; i >= 0; i--) {
      const sample = values[i];
      if (sample != null && Number.isFinite(sample) && sample >= 0) return sample;
    }
    return null;
  }, [value, values]);
  const color =
    colorValue == null
      ? "var(--text-tertiary)"
      : metric === "loss"
        ? resolveCustomLossColor(
            colorValue,
            themeSettings.pingLossThresholds,
            themeSettings.pingLossColors,
          )
        : resolveCustomLatencyColor(
            colorValue,
            latencyThresholds ?? themeSettings.pingLatencyThresholds,
            latencyColors ?? themeSettings.pingLatencyColors,
          );
  const failColor = resolveCustomLossColor(
    100,
    themeSettings.pingLossThresholds,
    themeSettings.pingLossColors,
  );

  useEffect(
    () => () => {
      if (touchHoldTimerRef.current != null) clearTimeout(touchHoldTimerRef.current);
    },
    [],
  );

  const setHover = (index: number | null) => {
    setHoveredIndex(index);
    onHoverIndex?.(index);
  };
  const pickIndex = (clientX: number, rect: DOMRect) =>
    setHover(resolveTouchBucketIndex(clientX, rect, buckets.length));

  /** 触屏：按下就选中，抬手后再留一会儿（口径见 `touchBucketPick`）。 */
  const handleTouchPick = (clientX: number, rect: DOMRect) => {
    pickIndex(clientX, rect);
    if (touchHoldTimerRef.current != null) clearTimeout(touchHoldTimerRef.current);
    touchHoldTimerRef.current = setTimeout(() => {
      touchHoldTimerRef.current = null;
      setHover(null);
    }, TOUCH_BUCKET_HOLD_MS);
  };

  const slot = geometry.width / Math.max(1, buckets.length);
  const hoveredPoint = hoveredIndex == null ? null : geometry.points[hoveredIndex];
  const empty = geometry.lines.length === 0;

  return (
    <span
      className={["ping-sparkline", className].filter(Boolean).join(" ")}
      style={{ height, "--sparkline-color": color } as CSSProperties}
      onPointerDown={(event) => {
        if (supportsFineHover(event.pointerType)) return;
        handleTouchPick(event.clientX, event.currentTarget.getBoundingClientRect());
      }}
      onPointerMove={(event) => {
        if (!supportsFineHover(event.pointerType)) {
          // 手指按着才跟随；触屏没有悬停，抬着手划过来不该动它。
          if (event.buttons !== 0) {
            handleTouchPick(event.clientX, event.currentTarget.getBoundingClientRect());
          }
          return;
        }
        pickIndex(event.clientX, event.currentTarget.getBoundingClientRect());
      }}
      onPointerLeave={() => {
        // 触屏那份有自己的收尾计时，别被这里抢先清掉。
        if (touchHoldTimerRef.current != null) return;
        setHover(null);
      }}
    >
      <svg
        viewBox={`0 0 ${geometry.width} ${height}`}
        preserveAspectRatio="none"
        width="100%"
        height={height}
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.34 }} />
            <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {/* 底边一条淡虚线当轨道：还没采到样本的时段（如页面刚打开）看得出是「空」，与点阵模式的灰格对应 */}
        <line
          className="ping-sparkline-track"
          x1="0"
          x2={geometry.width}
          y1={height - 0.5}
          y2={height - 0.5}
          vectorEffect="non-scaling-stroke"
        />
        {!empty && (
          <>
            {geometry.areas.map((d, index) => (
              <path key={`a${index}`} d={d} fill={`url(#${gradientId})`} stroke="none" />
            ))}
            {geometry.lines.map((d, index) => (
              <path
                key={`l${index}`}
                className="ping-sparkline-line"
                d={d}
                style={{ stroke: color }}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </>
        )}
        {buckets.map((bucket, index) =>
          bucket.offline ||
          (metric === "latency" && bucket.value == null && bucket.total > 0 && (bucket.loss ?? 0) >= 100) ? (
            <rect
              key={`f${bucket.index}`}
              x={index * slot + slot * 0.12}
              y={height - 2}
              width={slot * 0.76}
              height={2}
              rx={1}
              style={{ fill: failColor }}
            />
          ) : null,
        )}
        {hoveredIndex != null && (
          <line
            className="ping-sparkline-guide"
            x1={(hoveredIndex + 0.5) * slot}
            x2={(hoveredIndex + 0.5) * slot}
            y1="0"
            y2={height}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {hoveredPoint && (
        <span
          className="ping-sparkline-dot"
          style={{
            left: `${((hoveredIndex! + 0.5) / buckets.length) * 100}%`,
            top: hoveredPoint.y,
          }}
          aria-hidden
        />
      )}
    </span>
  );
});

/** 曲线 + 那一格数值的气泡，给自己不管悬停状态的地方（小卡、迷你卡、多线行）直接用。 */
export function PingSparklineChart({
  buckets,
  metric = "latency",
  height,
  value,
  className,
}: {
  buckets: PingOverviewBucket[];
  metric?: PingSparklineMetric;
  height?: number;
  value?: number | null;
  className?: string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const hoveredBucket = hoveredIndex == null ? null : (buckets[hoveredIndex] ?? null);
  const tooltip = hoveredBucket ? formatHealthBucketTooltip(hoveredBucket, metric) : null;
  return (
    <span className={["ping-sparkline-wrap", className].filter(Boolean).join(" ")}>
      <PingSparkline
        buckets={buckets}
        metric={metric}
        height={height}
        value={value}
        onHoverIndex={setHoveredIndex}
      />
      <HealthBucketTooltip text={tooltip} index={hoveredIndex} count={buckets.length} />
    </span>
  );
}
