"use client";

import confetti from "canvas-confetti";

/**
 * Celebration particle system.
 *
 * Every particle is a physical body: it gets a launch velocity, a random spin,
 * air drag, gravity and a fading tail. Three staggered emitters give the burst
 * a sense of depth — a hard vertical core, two angled wings, and a light rain
 * of ribbons that drifts down over the next second.
 */

const COLORS = ["#f0a500", "#ffc247", "#ff3b47", "#f2f4f8", "#5b6478"];

type Point = { x: number; y: number };

let instance: ReturnType<typeof confetti.create> | null = null;

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

function emitter(origin: Point, count: number, angle: number, velocity: number) {
  return {
    particleCount: count,
    angle,
    spread: 62,
    startVelocity: velocity,
    gravity: 0.9,
    decay: 0.92,
    ticks: 120,
    scalar: 0.95,
    colors: COLORS,
    origin,
    zIndex: 9999,
  };
}

/** A thin vertical bar, used for the falling ribbons. */
function ribbonShape() {
  try {
    return confetti.shapeFromText({ text: "▮", scalar: 0.7 });
  } catch {
    return "square" as const;
  }
}

export function celebrate(at?: Point) {
  if (typeof window === "undefined" || reducedMotion()) return;
  const confettiInstance = getInstance();
  const origin = at ?? { x: 0.5, y: 0.62 };

  // Core: straight up, fast.
  confettiInstance(emitter(origin, 70, 90, 46));

  // Wings: fanned outward, slower.
  confettiInstance(emitter(origin, 34, 58, 36));
  confettiInstance(emitter(origin, 34, 122, 36));

  // Ribbons: drifting down from above.
  confettiInstance({
    particleCount: 24,
    spread: 180,
    startVelocity: 6,
    gravity: 0.5,
    decay: 0.955,
    ticks: 200,
    scalar: 0.6,
    shapes: [ribbonShape()],
    colors: COLORS,
    origin: { x: 0.5, y: 0 },
    zIndex: 9998,
  });
}

/** A softer, single-sided puff — used when a favourite is removed. */
export function dismiss(at?: Point) {
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
    colors: ["#5b6478", "#39404f"],
    origin: at ?? { x: 0.5, y: 0.6 },
    zIndex: 9999,
  });
}
