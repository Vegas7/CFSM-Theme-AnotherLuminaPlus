import { useSyncExternalStore } from "react";
import { getSideColumnSide, subscribeSideColumn, type SideColumnSide } from "@/utils/duoSideColumn";

/** iPhone Duo 主屏幕 App 的透明侧栏在哪一侧（没有侧栏时为 null），见 utils/duoSideColumn。 */
export function useSideColumn(): SideColumnSide | null {
  return useSyncExternalStore(subscribeSideColumn, getSideColumnSide, () => null);
}
