import { clsx } from "clsx";
import { useSlidingIndicator } from "@/hooks/useSlidingIndicator";
import { t } from "@/i18n";

export interface TimeRangeOption {
  value: number;
  label: string;
}

/**
 * 详情页图表的时间段选择条。
 *
 * 选中高亮是滑过去的（见 useSlidingIndicator），首页的分组标签用的是同一套。选择条可以横向滚动，
 * 高亮放在滚动容器里面，跟着内容一起滚。
 */
export function RangeSelector({
  ranges,
  value,
  onChange,
  label,
}: {
  ranges: TimeRangeOption[];
  value: number;
  onChange: (value: number) => void;
  /** 读屏用的分组名，比如「负载图表时间段」。 */
  label: string;
}) {
  const { rootRef, animated, indicatorStyle } = useSlidingIndicator<HTMLDivElement>([ranges, value]);

  return (
    <div
      ref={rootRef}
      className="instance-segmented is-scrollable has-indicator"
      role="group"
      aria-label={label}
    >
      {indicatorStyle && (
        <span
          className={clsx("instance-segmented-indicator", animated && "is-animated")}
          style={indicatorStyle}
          aria-hidden
        />
      )}
      {ranges.map((range) => (
        <button
          key={range.value}
          type="button"
          data-active={value === range.value ? "true" : "false"}
          aria-pressed={value === range.value}
          onClick={() => onChange(range.value)}
        >
          {t(range.label)}
        </button>
      ))}
    </div>
  );
}
