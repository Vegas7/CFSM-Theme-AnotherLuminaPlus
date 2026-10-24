import type { ChartTooltipState } from "./chartShared";

export function ChartTooltip({ tooltip }: { tooltip: ChartTooltipState }) {
  if (!tooltip.show) return null;
  return (
    <div
      aria-hidden="true"
      className="instance-chart-tooltip"
      style={{ left: tooltip.left, top: tooltip.top }}
    >
      <div className="instance-chart-tooltip-time">{tooltip.time}</div>
      {tooltip.rows.map((row, index) => (
        <div key={`${index}-${row.label}`} className="instance-chart-tooltip-row">
          <span
            aria-hidden="true"
            className="instance-chart-tooltip-dot"
            style={{ background: row.color }}
          />
          <span>{row.label}</span>
          <strong>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function SwitchToggle({
  label,
  active,
  onToggle,
  title,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      className="instance-toggle-button instance-switch-button"
      data-active={active ? "true" : "false"}
      onClick={onToggle}
      aria-pressed={active}
      title={title}
    >
      {/* 开关本身就表示开 / 关，不再另写「开启 / 关闭」，标题行右侧一组控件才排得进一行；读屏靠 aria-pressed。 */}
      <span className="instance-switch-copy">{label}</span>
      <span className="instance-switch-track" aria-hidden>
        <span className="instance-switch-thumb" />
      </span>
    </button>
  );
}
