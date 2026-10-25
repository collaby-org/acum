/**
 * The channel page.
 *
 *   /canal/<id>
 *
 * A deep link that opens a channel on its own page — the phone's player.
 * The catalogue is projected through the public view before it leaves the
 * server, so the browser never holds an upstream address: it holds a name,
 * a logo and a channel id, and the picture comes from our own proxy.
 */
import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { CHANNELS } from "@/data/channels";
import { toPublicChannel } from "@/lib/catalogue";
import { CanalScreen } from "@/components/channel/canal-screen";

type CanalProps = {
  params: Promise<{ id: string }>;
};

/**
 * The player is live, so the page is rendered per request.
 */
export const instant = false;

/** The channel of a link, or null when the catalogue has no such channel. */
function findChannel(id: string) {
  const wanted = decodeURIComponent(id ?? "").toLowerCase();
  return (
    CHANNELS.find((channel) => channel.id.toLowerCase() === wanted) ?? null
  );
}

export async function generateMetadata({
  params,
}: CanalProps): Promise<Metadata> {
  const { id } = await params;
  const channel = findChannel(id);
  if (!channel) return { title: "Canal" };
  return {
    title: `${channel.name} — live`,
    description: `Vizionează ${channel.name} live, fără reclame și fără cont.`,
  };
}

export default async function CanalPage({ params }: CanalProps) {
  // The player is live, so the page is rendered per request.
  await connection();

  const { id } = await params;
  const upstream = findChannel(id);
  if (!upstream) notFound();

  // The public view: no upstream address, no source page.
  const channel = toPublicChannel(upstream);

  return <CanalScreen channel={channel} />;
}
