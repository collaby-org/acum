import type { Metadata } from "next";
import { OverviewPanel } from "@/components/admin/overview";

export const metadata: Metadata = {
  title: "Panou",
};

/**
 * The overview: the live audience, the numbers of the day, the last thirty
 * days, the plans, the catalogue and the newest accounts.
 */
export default function AdminOverviewPage() {
  return <OverviewPanel />;
}
