import type { Metadata } from "next";
import { MessagesPanel } from "@/components/admin/messages";

export const metadata: Metadata = {
  title: "Mesaje",
};

/**
 * The messages the contact form wrote.
 */
export default function AdminMessagesPage() {
  return <MessagesPanel />;
}
