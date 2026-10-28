/**
 * The geometry of the A, in the mark's 100-unit grid.
 *
 * It is exported because the intro draws the same letter with light: the
 * sting animates this path, so the shape it draws and the shape the product
 * ships can never drift apart.
 */
export const ACUM_MARK_PATH = "M12 88 L50 14 L88 88 L70 88 L50 49 L30 88 Z";

/**
 * The ACUM mark.
 *
 * A capital A — the first letter of the name — with a bright rail running out
 * of it to the right. The rail is the playhead: the position of "now" on the
 * programme guide. The A itself stays intact; the rail passes behind it and
 * emerges on the right.
 *
 * This is the one hand-drawn shape in the product. It is a brand mark, not an
 * icon, so it does not come from lucide — the icons in the interface do, and
 * only they.
 */
export function AcumMark({
  className,
  id = "acum-mark",
}: {
  className?: string;
  /**
   * The id of the gradient definitions. Pass a unique one when the mark is
   * rendered more than once on a page, so the two gradients never collide.
   */
  id?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE7B0" />
          <stop offset="0.38" stopColor="#F7B733" />
          <stop offset="0.72" stopColor="#DE9206" />
          <stop offset="1" stopColor="#9C6600" />
        </linearGradient>
        <linearGradient id={`${id}-rail`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#D98F04" />
          <stop offset="0.55" stopColor="#FFC95E" />
          <stop offset="1" stopColor="#FFF3D4" />
        </linearGradient>
      </defs>
      <rect
        x="59"
        y="54"
        width="33"
        height="12"
        rx="6"
        fill={`url(#${id}-rail)`}
      />
      <path d={ACUM_MARK_PATH} fill={`url(#${id}-gold)`} />
    </svg>
  );
}
