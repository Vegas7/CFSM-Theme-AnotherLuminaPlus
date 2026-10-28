import { useEffect, useState } from "react";
import { Copy, Smartphone } from "lucide-react";
import { InstancePanel } from "@/components/instance/InstancePanel";
import { t } from "@/i18n";
import { copyText } from "@/utils/clipboard";
import { getSideColumnDebug } from "@/utils/duoSideColumn";

/** 只在 iPhone / iPad 上显示；电脑上调试加 ?duo-debug。 */
function shouldShow(): boolean {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).has("duo-debug")) return true;
  return /iPhone|iPad|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 0;
}

/**
 * iPhone Duo 侧栏检测的诊断信息：系统报给页面的尺寸、安全区、主屏幕 App 判断和检测结论。
 * 真机上开不了 Web Inspector，系统一改报法就只能靠截这一块排查（见 utils/duoSideColumn）。
 */
export function SideColumnDiagnostics() {
  const [visible] = useState(shouldShow);
  const [info, setInfo] = useState(() => (visible ? getSideColumnDebug() : null));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!visible) return;
    // 旋转、冷启动补报安全区时数值会变，每秒刷新一次。
    const timer = window.setInterval(() => setInfo(getSideColumnDebug()), 1000);
    return () => window.clearInterval(timer);
  }, [visible]);

  if (!visible || !info) return null;

  const text = Object.entries(info)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("\n");

  const handleCopy = async () => {
    if (await copyText(text)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <InstancePanel
      kicker={t("诊断")}
      title={t("iPhone 侧栏检测")}
      aside={<Smartphone size={16} />}
    >
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-(--text-secondary)">
          {t("iPhone Duo 侧栏不正常时，在主屏幕 App 里打开这一页截图或复制下面的信息。")}
        </p>
        <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-(--surface-muted,rgba(127,127,127,0.08)) p-3 font-mono text-[11px] leading-relaxed text-(--text-primary)">
          {text}
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-2 self-start text-[13px] text-(--text-secondary)"
        >
          <Copy size={14} />
          <span>{copied ? t("已复制") : t("复制诊断信息")}</span>
        </button>
      </div>
    </InstancePanel>
  );
}
