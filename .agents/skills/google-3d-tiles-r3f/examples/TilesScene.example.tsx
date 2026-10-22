"use client";

/**
 * Minimal Google 3D Tiles scene with ECEF→ENU transform.
 * Copy to your project (e.g. src/components/map/TilesScene.tsx).
 * Requires: config (SCENE_ORIGIN, GOOGLE_TILES_CONFIG), ECEFtoENU (TilesTransformer), geo-utils.
 */

import { useRef, useCallback } from "react";
import * as THREE from "three";
import { TilesRenderer, TilesPlugin } from "3d-tiles-renderer/r3f";
import {
  GoogleCloudAuthPlugin,
  GLTFExtensionsPlugin,
} from "3d-tiles-renderer/plugins";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { TilesTransformer } from "./ECEFtoENU";
import { SCENE_ORIGIN, GOOGLE_TILES_CONFIG } from "./config";

let dracoLoader: DRACOLoader | null = null;
function getDRACOLoader() {
  if (!dracoLoader) {
    dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(
      "https://www.gstatic.com/draco/versioned/decoders/1.5.6/"
    );
  }
  return dracoLoader;
}

interface TilesSceneExampleProps {
  apiKey: string;
  onTilesLoaded?: () => void;
  onLoadError?: (event: unknown) => void;
}

export function TilesSceneExample({
  apiKey,
  onTilesLoaded,
  onLoadError,
}: TilesSceneExampleProps) {
  const tilesGroupRef = useRef<THREE.Group>(null);

  const handleLoadTileset = useCallback(() => {
    onTilesLoaded?.();
  }, [onTilesLoaded]);

  const handleLoadError = useCallback(
    (event: unknown) => {
      onLoadError?.(event);
    },
    [onLoadError]
  );

  if (!apiKey) return null;

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[100, 200, 100]} intensity={1} castShadow />

      <TilesTransformer
        originLat={SCENE_ORIGIN.lat}
        originLng={SCENE_ORIGIN.lng}
        groupRef={tilesGroupRef}
      >
        <TilesRenderer
          url={GOOGLE_TILES_CONFIG.rootUrl}
          onLoadTileSet={handleLoadTileset}
          onLoadError={handleLoadError}
        >
          <TilesPlugin
            plugin={GLTFExtensionsPlugin}
            args={{ dracoLoader: getDRACOLoader() }}
          />
          <TilesPlugin
            plugin={GoogleCloudAuthPlugin}
            args={{ apiToken: apiKey }}
          />
        </TilesRenderer>
      </TilesTransformer>
    </>
  );
}
