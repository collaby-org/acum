import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { OverviewPanel } from "@/components/admin/overview";
import { deskState } from "@/lib/admin";

export const dynamic = "force-dynamic";


export const metadata: Metadata = {
  title: "Panou",
};

// The desk reads the session on every request, so it is never prerendered —
// the same contract the rest of the product's data pages use.

/**
 * The overview: the live audience, the numbers of the day, the last thirty
 * days, the plans, the catalogue and the newest accounts.
 */
export default async function AdminOverviewPage() {
  const state = await deskState();
  if (state.status !== "ok") notFound();
  return <OverviewPanel />;
}
