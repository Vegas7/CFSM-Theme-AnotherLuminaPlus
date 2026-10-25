import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import "uplot/dist/uPlot.min.css";
import { InstanceDetails } from "@/components/instance/InstanceDetails";
import { PingChart } from "@/components/instance/PingChart";
import { LoadChart } from "@/components/instance/LoadChart";
import { RangeSelector } from "@/components/instance/RangeSelector";
import { PageBack } from "@/components/shell/PageBack";
import { Spinner } from "@/components/ui/Spinner";
import {
  buildLoadTimeRangeOptions,
  buildPingTimeRangeOptions,
} from "@/components/instance/chartShared";
import { useAuth } from "@/hooks/useAuth";
import { useNodeMeta, useNodeStoreStatus, useRealtimeFocus } from "@/hooks/useNode";
import { useThemeSettings } from "@/hooks/useThemeSettings";
import { ANONYMOUS_MAX_HISTORY_HOURS } from "@/services/api";
import { t, useLang } from "@/i18n";

// 档位里不再有 10 / 30 分钟：负载默认「实时」（底下只拉最近 10 分钟打底），Ping 默认最短的 1 小时。
const DEFAULT_PING_HOURS = 1;
const DEFAULT_LOAD_HOURS = 0;
/** `/api/history/all` 的 hours 上限。 */
const MAX_HISTORY_HOURS = 168;

export function Instance() {
  const lang = useLang();
  const { uuid } = useParams<{ uuid: string }>();
  const { data: me } = useAuth();
  const themeSettings = useThemeSettings();
  const meta = useNodeMeta(uuid ?? "");
  const storeStatus = useNodeStoreStatus(Boolean(uuid));
  // 详情页只订阅这一台的实时推送（后端文档：详情页不要订阅全量再在前端过滤）。
  useRealtimeFocus(uuid);
  const [loadHours, setLoadHours] = useState(0);
  const [pingHours, setPingHours] = useState(DEFAULT_PING_HOURS);
  const chartsRef = useRef<HTMLDivElement | null>(null);

  // 后端最长支持 7 天；未登录访客查询超过 24 小时会被拒绝，所以直接不显示更长的档位。
  const maxHistoryHours = me?.logged_in
    ? MAX_HISTORY_HOURS
    : ANONYMOUS_MAX_HISTORY_HOURS;

  const loadRanges = useMemo(
    () => buildLoadTimeRangeOptions(maxHistoryHours),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 里面的文案按界面语言生成，切语言要重算
    [maxHistoryHours, lang],
  );
  const pingRanges = useMemo(
    () => buildPingTimeRangeOptions(maxHistoryHours),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 里面的文案按界面语言生成，切语言要重算
    [maxHistoryHours, lang],
  );
  const showPingChart = themeSettings.isReady && themeSettings.showPingChart;

  const alignCharts = useCallback(() => {
    const frame = window.requestAnimationFrame(() => {
      const element = chartsRef.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      if (rect.top >= 0 && rect.top < window.innerHeight) return;
      element.scrollIntoView({ behavior: "auto", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!loadRanges.some((range) => range.value === loadHours)) {
      setLoadHours(
        loadRanges.find((range) => range.value === DEFAULT_LOAD_HOURS)?.value ??
          loadRanges[0]?.value ??
          DEFAULT_LOAD_HOURS,
      );
    }
  }, [loadHours, loadRanges]);

  useEffect(() => {
    if (!pingRanges.some((range) => range.value === pingHours)) {
      setPingHours(
        pingRanges.find((range) => range.value === DEFAULT_PING_HOURS)?.value ??
          pingRanges[0]?.value ??
          DEFAULT_PING_HOURS,
      );
    }
  }, [pingHours, pingRanges]);

  if (!uuid) return null;

  if (!meta) {
    const message = storeStatus.hydrated
      ? t("找不到这个实例，它可能已被删除或链接无效。")
      : storeStatus.nodeInfoError
        ? t("节点列表加载失败，系统正在自动重试。")
        : null;
    return (
      <div className="flex flex-col gap-5 py-2">
        <PageBack homeActions={false} />
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
          {message ? (
            <>
              <div className="text-[15px] font-semibold text-(--text-primary)">
                {storeStatus.hydrated ? t("实例不存在") : t("暂时无法加载实例")}
              </div>
              <p className="text-[13px] text-(--text-secondary)">{message}</p>
            </>
          ) : (
            <Spinner size={24} label={t("正在加载实例")} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 py-2">
      {/* 详情页用不上首页卡片的视图切换、隐藏价格两个按钮 */}
      <PageBack homeActions={false} />
      <InstanceDetails uuid={uuid} onNodeReady={alignCharts} />
      {/* 负载在上、Ping 在下，同一页直接看，不再分标签切换。各自的时间段选择条放在各自面板的标题区中间，
          两张图的档位互不影响。 */}
      <div ref={chartsRef} className="instance-chart-stack">
        <LoadChart
          uuid={uuid}
          hours={loadHours}
          controls={
            <RangeSelector
              label={t("负载图表时间段")}
              ranges={loadRanges}
              value={loadHours}
              onChange={(value) => startTransition(() => setLoadHours(value))}
            />
          }
        />
        {showPingChart && (
          <PingChart
            uuid={uuid}
            hours={pingHours}
            controls={
              <RangeSelector
                label={t("Ping 图表时间段")}
                ranges={pingRanges}
                value={pingHours}
                onChange={(value) => startTransition(() => setPingHours(value))}
              />
            }
          />
        )}
      </div>
    </div>
  );
}
