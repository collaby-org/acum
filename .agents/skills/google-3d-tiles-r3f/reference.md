# Reference: Google 3D Tiles + R3F + ECEF→ENU

This skill is **project-agnostic**. All code lives in the [examples/](examples/) folder so you can copy it into any repo.

---

## 1. Example files (in this skill)

Full copy-paste examples are in [examples/](examples/). Mapping to your project:

| Purpose                       | Example file                                                       | Your project path (suggestion)      |
| ----------------------------- | ------------------------------------------------------------------ | ----------------------------------- |
| Origin + tiles config         | [examples/config.ts](examples/config.ts)                           | `src/config/map-config.ts`          |
| ECEF↔ENU matrix + transformer | [examples/ECEFtoENU.tsx](examples/ECEFtoENU.tsx)                   | `src/components/map/ECEFtoENU.tsx`  |
| Geo utils (lat/lng↔ENU)       | [examples/geo-utils.ts](examples/geo-utils.ts)                     | `src/lib/geo-utils.ts`              |
| Tiles scene                   | [examples/TilesScene.example.tsx](examples/TilesScene.example.tsx) | `src/components/map/TilesScene.tsx` |
| Page (Canvas + scene)         | [examples/page.example.tsx](examples/page.example.tsx)             | Your app page (snippet)             |

See [examples/README.md](examples/README.md) for copy-to-path mapping.

---

## 2. Config: origin and tiles URL

Use **one origin** for the whole scene so ENU is consistent. Example shape (see [examples/config.ts](examples/config.ts)):

```ts
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
```

---

## 3. ECEF → ENU matrix and TilesTransformer

- **Library ENU**: `WGS84_ELLIPSOID.getEastNorthUpFrame` gives ENU→ECEF (X=east, Y=north, Z=up). Invert for ECEF→ENU.
- **Y-up remap**: Three.js convention is X=east, Y=up, Z=-north (north = -Z). Apply a fixed matrix so the tiles group uses this frame.
- Apply the combined matrix to the **parent group** of `TilesRenderer` once on mount and set `matrixAutoUpdate = false`.

Full implementation: [examples/ECEFtoENU.tsx](examples/ECEFtoENU.tsx) (`createECEFtoENUMatrix` + `TilesTransformer`).

Scene usage: wrap `TilesRenderer` with the transformer and plugins:

```tsx
<TilesTransformer originLat={SCENE_ORIGIN.lat} originLng={SCENE_ORIGIN.lng} groupRef={tilesGroupRef}>
  <TilesRenderer url={GOOGLE_TILES_CONFIG.rootUrl} onLoadTileSet={...} onLoadError={...}>
    <TilesPlugin plugin={GLTFExtensionsPlugin} args={{ dracoLoader: getDRACOLoader() }} />
    <TilesPlugin plugin={GoogleCloudAuthPlugin} args={{ apiToken: apiKey }} />
  </TilesRenderer>
</TilesTransformer>
```

---

## 4. Geo utils: lat/lng/alt ↔ ECEF ↔ ENU

Use the **same** origin as in `createECEFtoENUMatrix` for every `latLngAltToENU` and `enuToLatLngAlt` call.

- **latLngAltToECEF** / **ecefToLatLngAlt**: WGS84 ellipsoid (see [examples/geo-utils.ts](examples/geo-utils.ts)).
- **latLngAltToENU**: Geodetic → ENU with Y-up remap (X=east, Y=up, Z=-north).
- **enuToLatLngAlt**: Inverse of above.

Full code: [examples/geo-utils.ts](examples/geo-utils.ts).

---

## 5. Page: Canvas and initial camera

- Put your tiles scene inside R3F `<Canvas>` with `logarithmicDepthBuffer` and large `far` for planet-scale.
- Initial camera position: compute with `latLngAltToENU(lat, lng, alt, originLat, originLng, originAlt)` so the camera is in the same ENU frame as the transformed tiles.

Example: [examples/page.example.tsx](examples/page.example.tsx).

---

## 6. Summary: 座標系 consistency

| Item                      | Coordinate system                                              |
| ------------------------- | -------------------------------------------------------------- |
| Google 3D Tiles (raw)     | ECEF                                                           |
| Tiles after transformer   | ENU at origin, Y-up (X=east, Y=up, Z=-north)                   |
| Camera / entities / audio | ENU via `latLngAltToENU(..., originLat, originLng, originAlt)` |

Keep **one** origin and use it in both `createECEFtoENUMatrix` (or `TilesTransformer`) and every `latLngAltToENU` / `enuToLatLngAlt` call.
