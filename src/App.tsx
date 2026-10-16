import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { ErrorBoundary } from "@/components/shell/ErrorBoundary";
import { useLang } from "@/i18n";
import { queryClient } from "@/services/queryClient";
import { router } from "@/router";

export function App() {
  // 切换语言时整棵树按新语言重新挂载；数据在 queryClient 里，不会重新请求。
  const lang = useLang();
  return (
    <ErrorBoundary key={lang}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
