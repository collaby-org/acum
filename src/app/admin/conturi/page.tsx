import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { AccountsPanel } from "@/components/admin/accounts";
import { deskState } from "@/lib/admin";

export const dynamic = "force-dynamic";


export const metadata: Metadata = {
  title: "Conturi",
};

// The desk reads the session on every request; it is never prerendered.

/**
 * The accounts, and the panel where access is granted by hand.
 */
export default async function AdminAccountsPage() {
  const state = await deskState();
  if (state.status !== "ok") notFound();
  return <AccountsPanel />;
}
