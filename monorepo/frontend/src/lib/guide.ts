import { readFile } from "node:fs/promises";
import path from "node:path";
import { prepareGuide, type EpgGuide } from "@/components/now-next";
import type { Channel } from "@/data/types";

/**
 * Today's programme guide, prepared for the hero.
 *
 * The clock is read here rather than in the page, because a render must be
 * pure: what is on now is a property of the request, not of the component.
 * A missing guide is not a broken page — the hero falls back to the
 * channel-only view.
 */
export async function loadGuide(channels: Channel[]): Promise<EpgGuide | null> {
  try {
    const raw = await readFile(
      path.join(process.cwd(), "data", "epg.json"),
      "utf8",
    );
    return prepareGuide(JSON.parse(raw), channels, Date.now(), 8).guide;
  } catch {
    return null;
  }
}
