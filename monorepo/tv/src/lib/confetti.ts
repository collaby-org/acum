"use client";

import confetti from "canvas-confetti";
import type { Channel } from "@/data/types";
import { familyHue } from "@/lib/channel-meta";

/**
 * The celebration particle system.
 *
 * Every particle is a physical body: it gets a launch velocity, a random spin,
 * air drag, gravity and a fading tail. The burst is layered so it reads as
 * depth rather than as one flat explosion:
 *
 *   1. a hard vertical core, launched straight up,
 *   2. two angled wings that fan outward and fall slower,
 *   3. a shower of ribbons that drifts down over the next second,
 *   4. a second, later wave of sparks that catches the eye on the way out.
 *
 * The palette is taken from the channel's own family colour, so the
 * celebration belongs to the channel that was saved.
 */

const BASE_COLORS = ["#f0a500", "#ffc247", "#ff3b47", "#f2f4f8", "#5b6478"];

type Point = { x: number; y: number };

let instance: ReturnType<typeof confetti.create> | null = null;
let ribbon: confetti.Shape | null = null;
let spark: confetti.Shape | null = null;

/** One canvas, created lazily, reused for every burst. */
function getInstance() {
  if (!instance) {
    instance = confetti.create(undefined, { resize: true, useWorker: true });
  }
  return instance;
}

function reducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function shapes() {
  if (!ribbon) {
    try {
      ribbon = confetti.shapeFromText({ text: "▮", scalar: 0.7 });
    } catch {
      ribbon = "square";
    }
  }
  if (!spark) {
    try {
      spark = confetti.shapeFromText({ text: "✦", scalar: 0.9 });
    } catch {
      spark = "star";
    }
  }
  return { ribbon, spark };
}

/** The channel's own colour, lifted to a usable saturation and lightness. */
function channelColors(channel?: Channel): string[] {
  if (!channel) return BASE_COLORS;
  const hue = familyHue(channel.familyKey, channel.category);
  return [
    `hsl(${hue} 92% 58%)`,
    `hsl(${hue} 96% 72%)`,
    `hsl(${(hue + 340) % 360} 88% 60%)`,
    "#f6f7f9",
    "hsl(220 14% 42%)",
  ];
}

type BurstOptions = {
  colors: string[];
  origin: Point;
  count: number;
  angle: number;
  velocity: number;
  spread?: number;
  gravity?: number;
  decay?: number;
  ticks?: number;
  scalar?: number;
  shapes?: confetti.Shape[];
  delay?: number;
};

function burst({
  colors,
  origin,
  count,
  angle,
  velocity,
  spread = 62,
  gravity = 0.9,
  decay = 0.92,
  ticks = 120,
  scalar = 0.95,
  shapes: shapeList,
  delay = 0,
}: BurstOptions) {
  const fire = () =>
    getInstance()({
      particleCount: count,
      angle,
      spread,
      startVelocity: velocity,
      gravity,
      decay,
      ticks,
      scalar,
      colors,
      origin,
      zIndex: 9999,
      ...(shapeList ? { shapes: shapeList } : {}),
    });

  if (delay > 0) window.setTimeout(fire, delay);
  else fire();
}

/** Big, celebratory, and unmistakably tied to the channel that was saved. */
export function celebrate(channel?: Channel, at?: Point) {
  if (typeof window === "undefined" || reducedMotion()) return;

  const colors = channelColors(channel);
  const origin = at ?? { x: 0.5, y: 0.62 };
  const { ribbon: ribbonShape, spark: sparkShape } = shapes();

  // Core: straight up, fast, square chips.
  burst({ colors, origin, count: 70, angle: 90, velocity: 48, scalar: 0.9 });

  // Wings: fanned outward, slower, rounder.
  burst({ colors, origin, count: 34, angle: 56, velocity: 37, spread: 68, scalar: 0.8 });
  burst({ colors, origin, count: 34, angle: 124, velocity: 37, spread: 68, scalar: 0.8 });

  // Ribbons: a slow curtain drifting down from above.
  burst({
    colors,
    origin: { x: 0.5, y: 0 },
    count: 26,
    angle: 90,
    velocity: 7,
    spread: 180,
    gravity: 0.5,
    decay: 0.955,
    ticks: 200,
    scalar: 0.55,
    shapes: [ribbonShape],
  });

  // Second wave: sparks that catch the eye on the way out.
  burst({
    colors,
    origin,
    count: 18,
    angle: 90,
    velocity: 58,
    spread: 110,
    gravity: 0.75,
    decay: 0.9,
    ticks: 110,
    scalar: 0.7,
    shapes: [sparkShape],
    delay: 180,
  });
}

/** A soft, single-sided puff — used when a favourite is removed. */
export function dismiss(channel?: Channel, at?: Point) {
  if (typeof window === "undefined" || reducedMotion()) return;

  getInstance()({
    particleCount: 22,
    spread: 40,
    startVelocity: 18,
    gravity: 0.7,
    decay: 0.9,
    ticks: 70,
    scalar: 0.6,
    shapes: ["circle"],
    colors: channel
      ? [channelColors(channel)[4], channelColors(channel)[2]]
      : ["#5b6478", "#39404f"],
    origin: at ?? { x: 0.5, y: 0.6 },
    zIndex: 9999,
  });
}
