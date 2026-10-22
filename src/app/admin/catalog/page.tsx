import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CataloguePanel } from "@/components/admin/catalogue";
import { deskState } from "@/lib/admin";

export const metadata: Metadata = {
  title: "Catalog",
};

// The desk reads the session on every request; it is never prerendered.
export const instant = false;

/**
 * The catalogue, in the same shape the browser is allowed to see it.
 */
export default async function AdminCataloguePage() {
  const state = await deskState();
  if (state.status !== "ok") notFound();
  return <CataloguePanel />;
}
