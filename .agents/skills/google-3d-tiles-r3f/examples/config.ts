/**
 * Scene origin and Google 3D Tiles config.
 * Use one origin for the whole scene so ENU is consistent.
 * Copy to your project (e.g. src/config/map-config.ts).
 */

export const SCENE_ORIGIN = {
  lat: 35.6762,
  lng: 139.6503,
  alt: 0,
};

export const GOOGLE_TILES_CONFIG = {
  rootUrl: "https://tile.googleapis.com/v1/3dtiles/root.json",
  errorTarget: 12,
  maxDepth: 20,
};
