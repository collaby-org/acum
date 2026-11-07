/**
 * The catalogue while its request is still being answered.
 *
 * The real page opens with the channel catalogue, so the boundary keeps the
 * same card rhythm and the same amount of room. It is a shape, not data:
 * every block below is empty until the server has sent the real channels.
 */

const CARD_COUNT = 8;

function SkeletonCard({ index }: { index: number }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-white/[0.07] bg-surface">
      <div className="aspect-video bg-surface-2 motion-safe:animate-pulse motion-reduce:animate-none" />
      <div className="space-y-2 p-3" aria-hidden>
        <div className="h-2.5 w-[62%] rounded-full bg-white/[0.08] motion-safe:animate-pulse motion-reduce:animate-none" />
        <div className="h-2 w-[42%] rounded-full bg-white/[0.055] motion-safe:animate-pulse motion-reduce:animate-none" />
      </div>
      <span className="sr-only">Canal {index + 1} se încarcă</span>
    </div>
  );
}

export default function CanaleLoading() {
  return (
    <div className="min-h-dvh bg-canvas pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <main className="mx-auto max-w-[1800px] px-4 pb-28 pt-28 sm:px-8 sm:pt-36 lg:px-12">
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="mb-8 flex items-center gap-3"
        >
          <span
            aria-hidden
            className="h-px w-8 bg-signal motion-safe:animate-pulse motion-reduce:animate-none"
          />
          <p className="font-display text-sm font-semibold tracking-tight text-signal">
            Se încarcă catalogul…
          </p>
        </div>

        <div
          aria-label="Catalogul se încarcă"
          className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        >
          {Array.from({ length: CARD_COUNT }, (_, index) => (
            <SkeletonCard key={index} index={index} />
          ))}
        </div>
      </main>
    </div>
  );
}
