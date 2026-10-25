import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MessagesPanel } from "@/components/admin/messages";
import { deskState } from "@/lib/admin";

export const metadata: Metadata = {
  title: "Mesaje",
};

// The desk reads the session on every request; it is never prerendered.
export const instant = false;

/**
 * The messages the contact form wrote.
 */
export default async function AdminMessagesPage() {
  const state = await deskState();
  if (state.status !== "ok") notFound();
  return <MessagesPanel />;
}
