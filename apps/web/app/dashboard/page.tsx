import type { Metadata } from "next";

import { DashboardClient } from "@/components/dashboard-client";

export const metadata: Metadata = {
  title: "Dashboard — ZenoLedgr",
};

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl p-6 md:p-10">
      <DashboardClient />
    </main>
  );
}
