import type { Metadata } from "next";
import { AccountsPanel } from "@/components/admin/accounts";

export const metadata: Metadata = {
  title: "Conturi",
};

/**
 * The accounts, and the panel where access is granted by hand.
 */
export default function AdminAccountsPage() {
  return <AccountsPanel />;
}
