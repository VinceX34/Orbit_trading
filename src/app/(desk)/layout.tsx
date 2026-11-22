import { Suspense } from "react";
import { DeskProvider } from "@/components/desk-provider";
import { Shell } from "@/components/sidebar";

export default function DeskLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted">Loading the desk…</div>}>
      <DeskProvider>
        <Shell>{children}</Shell>
      </DeskProvider>
    </Suspense>
  );
}
