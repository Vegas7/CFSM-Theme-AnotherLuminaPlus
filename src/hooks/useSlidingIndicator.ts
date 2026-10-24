import { useEffect, useLayoutEffect, useRef, useState, type DependencyList } from "react";

export interface IndicatorBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * 分段按钮的「滑动高亮」：选中高亮是一块单独的底色，量出选中按钮（`[data-active="true"]`）的位置后
 * 用 transform 挪过去，从一个选项点到另一个时高亮是滑过去的，不是原地一灭一亮。
 *
 * 首次出现时直接落位，不从最左边滑进来（`animated` 等落位那一帧之后才变 true，调用方据此开过渡）。
 * 按钮宽度会随字体加载、窗口宽度、语言切换变化，用 ResizeObserver 跟着重量。容器要是定位元素
 * （position: relative），按钮的 offsetLeft/Top 才是相对它算的；容器能横向滚动时，高亮放在容器里面
 * 跟着内容一起滚。`deps` 写选中值和选项列表，变了就重新量。
 */
export function useSlidingIndicator<T extends HTMLElement>(deps: DependencyList) {
  const rootRef = useRef<T | null>(null);
  const [box, setBox] = useState<IndicatorBox | null>(null);
  const [animated, setAnimated] = useState(false);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const active = root?.querySelector<HTMLElement>('[data-active="true"]');
    if (!root || !active) {
      setBox(null);
      return;
    }
    const measure = () => {
      const next = {
        left: active.offsetLeft,
        top: active.offsetTop,
        width: active.offsetWidth,
        height: active.offsetHeight,
      };
      setBox((prev) =>
        prev &&
        prev.left === next.left &&
        prev.top === next.top &&
        prev.width === next.width &&
        prev.height === next.height
          ? prev
          : next,
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(active);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 由调用方给出依赖
  }, deps);

  // 第一次落位之后再打开过渡。
  useEffect(() => {
    if (!box || animated) return;
    const frame = window.requestAnimationFrame(() => setAnimated(true));
    return () => window.cancelAnimationFrame(frame);
  }, [animated, box]);

  const indicatorStyle = box
    ? {
        width: box.width,
        height: box.height,
        transform: `translate(${box.left}px, ${box.top}px)`,
      }
    : undefined;

  return { rootRef, box, animated, indicatorStyle };
}
