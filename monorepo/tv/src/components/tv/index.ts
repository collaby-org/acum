/**
 * The television components.
 *
 * Everything here is remote-driven: it is built for a D-pad and five
 * buttons, and it assumes there is no mouse until a pointer proves
 * otherwise. The navigation engine lives in `@/hooks/use-remote-nav` and
 * the cursor rule in `@/hooks/use-remote-cursor`; neither is re-implemented
 * here.
 */

export { TVSafeArea } from "./safe-area";
export { TVFocusable, TV_FOCUSABLE_CLASS, TV_RAIL_CLASS, TV_RAIL_PROPS, TV_RING } from "./focusable";
export { TVChannelCard, type TVChannelCardProps } from "./card";
export { TVChannelRow, type TVChannelRowProps } from "./rail";
export { TVHero, type TVHeroProps } from "./hero";
export { TVNav } from "./nav";
export { TVShell } from "./shell";
