"use client";

import { useAccount } from "@/hooks/use-account";
import { isAdmin, ADMIN_EMAIL } from "@/lib/admin-access";
import { OverviewPanel } from "@/components/admin/overview";

export default function AdminClientPage() {
  const { ready, email, plan } = useAccount();
  const ok = ready && isAdmin(email, plan);

  if (!ready) return <main className="min-h-screen bg-black" />;
  if (!ok) return <main className="min-h-screen flex items-center justify-center bg-black text-white"><h1>404 — Nu ești autorizat</h1></main>;
  return <OverviewPanel />;
}
