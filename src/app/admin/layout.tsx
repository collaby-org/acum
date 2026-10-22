import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/shell";

/**
 * The desk's shell.
 *
 * The rail, the bar and the content. The data behind it is never rendered
 * here: it comes from `/api/admin/**`, and every one of those routes asks
 * the guard first.
 */
export const metadata: Metadata = {
  title: "Panou de administrare",
  // The desk is not a page of the product. It is not for the index.
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
