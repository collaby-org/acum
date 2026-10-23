/**
 * Safely resolves searchParams. During static export (output: 'export'),
 * searchParams is not available at build time — returns {} so the page
 * can still be pre-rendered. In server mode, delegates to await searchParams.
 */
export async function readSearchParams(
  searchParams: Promise<Record<string, string | string[] | undefined>>
): Promise<Record<string, string | string[] | undefined>> {
  return await searchParams;
}
