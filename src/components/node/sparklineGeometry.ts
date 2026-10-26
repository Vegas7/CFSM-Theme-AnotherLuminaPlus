/**
 * 首页延迟 / 丢包「曲线」模式的几何计算（与渲染层无关，便于单测）。
 *
 * 横轴：每个分桶占 `slot` 宽，点落在格子正中 —— 与点阵模式的柱子一一对应，悬停 / 点按取到的
 * 是同一格（见 touchBucketPick）。纵轴：按这一行自己的最小 / 最大延迟自动缩放，但至少留出
 * `minRange` 的跨度，免得几毫秒的抖动被放大成大起大落。没有样本的格子把曲线断开，不硬连。
 */

export interface SparklinePoint {
  x: number;
  y: number;
}

export interface SparklineGeometry {
  /** viewBox 宽度：分桶数 × slot。 */
  width: number;
  height: number;
  /** 每段连续样本一条描边路径。 */
  lines: string[];
  /** 与 lines 一一对应的填充路径（曲线下方到底边）。 */
  areas: string[];
  /** 每个分桶对应的点；没有样本为 null。 */
  points: (SparklinePoint | null)[];
}

export interface SparklineOptions {
  height: number;
  /** 每个分桶的横向宽度（viewBox 单位）。 */
  slot?: number;
  /** 顶部留白，避免描边被裁掉。 */
  padTop?: number;
  /** 底部留给填充渐变的比例（曲线最低点也不贴底）。 */
  bottomRoom?: number;
  /** 纵轴范围；不传按数据自动缩放（见 sparklineRange）。丢包用 lossSparklineRange 固定从 0 起。 */
  range?: { lo: number; hi: number } | null;
}

const DEFAULT_SLOT = 10;

function finite(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value >= 0;
}

/** 纵轴范围：至少 8ms 或均值的 15%，太平的数据居中显示成一条缓线。 */
export function sparklineRange(values: (number | null)[]): { lo: number; hi: number } | null {
  const samples = values.filter(finite);
  if (samples.length === 0) return null;
  let lo = Math.min(...samples);
  let hi = Math.max(...samples);
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const minRange = Math.max(8, mean * 0.15);
  if (hi - lo < minRange) {
    const mid = (hi + lo) / 2;
    lo = mid - minRange / 2;
    hi = mid + minRange / 2;
  }
  return { lo, hi };
}

/**
 * 丢包的纵轴：底边固定是 0%，顶边至少 5%。没有丢包时曲线平平地贴着下方，
 * 有丢包才隆起；整轮超时（100%）照实冲到顶。
 */
export function lossSparklineRange(values: (number | null)[]): { lo: number; hi: number } | null {
  const samples = values.filter(finite);
  if (samples.length === 0) return null;
  return { lo: 0, hi: Math.max(5, ...samples) };
}

/** 单调三次插值（Fritsch–Carlson）：曲线平滑，但不会冲过相邻两点的数值，不画出不存在的尖峰。 */
export function monotonePath(points: SparklinePoint[], slot = DEFAULT_SLOT): string {
  const n = points.length;
  if (n === 0) return "";
  const fmt = (value: number) => Number(value.toFixed(2));
  if (n === 1) {
    const { x, y } = points[0];
    return `M${fmt(x - slot * 0.35)},${fmt(y)}L${fmt(x + slot * 0.35)},${fmt(y)}`;
  }
  const dx: number[] = [];
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const h = points[i + 1].x - points[i].x;
    dx.push(h);
    slopes.push((points[i + 1].y - points[i].y) / h);
  }
  const tangents: number[] = new Array(n);
  tangents[0] = slopes[0];
  tangents[n - 1] = slopes[n - 2];
  for (let i = 1; i < n - 1; i++) {
    const a = slopes[i - 1];
    const b = slopes[i];
    tangents[i] = a * b <= 0 ? 0 : (a + b) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    const m = slopes[i];
    if (m === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const a = tangents[i] / m;
    const b = tangents[i + 1] / m;
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      tangents[i] = tau * a * m;
      tangents[i + 1] = tau * b * m;
    }
  }
  let d = `M${fmt(points[0].x)},${fmt(points[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i];
    const p0 = points[i];
    const p1 = points[i + 1];
    d +=
      `C${fmt(p0.x + h / 3)},${fmt(p0.y + (tangents[i] * h) / 3)}` +
      ` ${fmt(p1.x - h / 3)},${fmt(p1.y - (tangents[i + 1] * h) / 3)}` +
      ` ${fmt(p1.x)},${fmt(p1.y)}`;
  }
  return d;
}

export function buildSparkline(
  values: (number | null)[],
  { height, slot = DEFAULT_SLOT, padTop = 2, bottomRoom = 0.2, range: fixedRange }: SparklineOptions,
): SparklineGeometry {
  const width = Math.max(1, values.length) * slot;
  const range = fixedRange === undefined ? sparklineRange(values) : fixedRange;
  const points: (SparklinePoint | null)[] = values.map(() => null);
  const lines: string[] = [];
  const areas: string[] = [];
  if (!range) return { width, height, lines, areas, points };

  const top = padTop;
  const bottom = Math.max(top + 1, height * (1 - bottomRoom));
  const span = range.hi - range.lo;
  values.forEach((value, index) => {
    if (!finite(value)) return;
    points[index] = {
      x: (index + 0.5) * slot,
      y: top + ((range.hi - value) / span) * (bottom - top),
    };
  });

  let segment: SparklinePoint[] = [];
  const flush = () => {
    if (segment.length === 0) return;
    const line = monotonePath(segment, slot);
    const first = segment[0];
    const last = segment[segment.length - 1];
    const startX = segment.length === 1 ? first.x - slot * 0.35 : first.x;
    const endX = segment.length === 1 ? last.x + slot * 0.35 : last.x;
    lines.push(line);
    areas.push(`${line}L${Number(endX.toFixed(2))},${height}L${Number(startX.toFixed(2))},${height}Z`);
    segment = [];
  };
  for (const point of points) {
    if (point) segment.push(point);
    else flush();
  }
  flush();
  return { width, height, lines, areas, points };
}
