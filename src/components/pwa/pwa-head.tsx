/**
 * The PWA head tags.
 *
 * They live here, in the PWA lane, instead of in `src/app/layout.tsx`:
 * React 19 hoists `<link>`, `<meta>` and `<title>` elements from anywhere in
 * the tree into `<head>` — verified against the installed React 19.3 server
 * renderer — so the layout only has to render one component.
 *
 * `<link>` elements need a `rel` and an `href` to be hoisted, and must not
 * carry `onLoad` / `onError` handlers, or React leaves them where they are.
 */

/** The manifest is the install contract: name, icons, display, colours. */
export function PwaHead() {
  return (
    <>
      <link rel="manifest" href="/manifest.webmanifest" />
      <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />

      {/* iOS home screen: the app opens without the Safari chrome. */}
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-title" content="VIZOR" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black" />
    </>
  );
}
