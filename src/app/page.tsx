import { connection } from "next/server";
import { Browse } from "@/components/browse";
import { Footer } from "@/components/footer";
import { CATEGORIES, CHANNELS } from "@/data/channels";
import { toPublicChannels } from "@/lib/catalogue";
import { loadGuide } from "@/lib/guide";

/**
 * The guide is about now, so the page is rendered per request.
 */
export const instant = false;

/**
 * The catalogue is stripped before it reaches the browser: the client gets
 * names, artwork, status and quality, but no upstream address and no source
 * page. When the player wants a feed it asks the server for it by reference.
 */
export default async function Home() {
  await connection();

  const channels = toPublicChannels(CHANNELS);
  const guide = await loadGuide(channels);

  return (
    <>
      <Browse channels={channels} categories={CATEGORIES} guide={guide} />
      <Footer />
    </>
  );
}
