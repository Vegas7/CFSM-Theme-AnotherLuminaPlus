import { t } from "@/i18n";
export function Spinner({
  size = 20,
  label,
}: {
  size?: number;
  label?: string;
}) {
  label ??= t("加载中");
  return (
    <span
      role={label ? "status" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className="inline-block animate-spin rounded-full border-2 border-(--border-subtle) border-t-(--accent-500) motion-reduce:animate-none"
      style={{ width: size, height: size }}
    />
  );
}
