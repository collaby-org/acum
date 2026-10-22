import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OverviewPanel } from "@/components/admin/overview";
import { deskState } from "@/lib/admin";

export const metadata: Metadata = {
  title: "Panou",
};

/**
 * The overview: the live audience, the numbers of the day, the last thirty
 * days, the plans, the catalogue and the newest accounts.
 */
export default async function AdminOverviewPage() {
  const state = await deskState();
  if (state.status !== "ok") notFound();
  return <OverviewPanel />;
}
