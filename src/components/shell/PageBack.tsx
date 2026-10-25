import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { FloatingControls } from "@/components/shell/FloatingControls";
import { useSideColumn } from "@/hooks/useSideColumn";
import { t } from "@/i18n";

/**
 * 子页面（详情页、资产页）回首页的入口。
 *
 * 平时是页面顶部的「← 返回」；iPhone Duo 主屏幕 App 的侧栏模式下去掉这一行，改为在侧栏里放和首页
 * 同一套快捷按钮栏，返回圆钮紧贴在按钮栏上方（见 FloatingControls 的 backTo）。
 * 按钮栏挂到 body 上：页面容器里有动画用的 transform 时，fixed 会相对容器而不是屏幕定位。
 */
export function PageBack({
  homeActions = true,
}: {
  /** 侧栏按钮栏里是否带上只作用于首页卡片的按钮（切换卡片视图、隐藏价格与资产）。 */
  homeActions?: boolean;
} = {}) {
  const inSideColumn = useSideColumn() !== null;

  if (inSideColumn) {
    return createPortal(<FloatingControls backTo="/" homeActions={homeActions} />, document.body);
  }

  return (
    <Link to="/" className="instance-page-back">
      <ChevronLeft size={14} />
      {t("返回")}
    </Link>
  );
}
