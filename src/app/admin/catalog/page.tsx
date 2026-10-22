import type { Metadata } from "next";
import { CataloguePanel } from "@/components/admin/catalogue";

export const metadata: Metadata = {
  title: "Catalog",
};

/**
 * The catalogue, in the same shape the browser is allowed to see it.
 */
export default function AdminCataloguePage() {
  return <CataloguePanel />;
}
