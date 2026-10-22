"use client";

/**
 * Example page: Canvas + TilesScene with camera in ENU.
 * Copy to your app page (e.g. src/app/page.tsx or src/app/(index)/page.tsx).
 */

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { TilesSceneExample } from "./TilesScene.example";
import { latLngAltToENU } from "./geo-utils";
import { SCENE_ORIGIN } from "./config";

const INITIAL_CAMERA = {
  lat: 35.678,
  lng: 139.652,
  alt: 800,
};

function Loader() {
  return <div>Loading tiles…</div>;
}

export default function PageExample() {
  const origin = SCENE_ORIGIN;
  const initialCameraPosition = latLngAltToENU(
    INITIAL_CAMERA.lat,
    INITIAL_CAMERA.lng,
    INITIAL_CAMERA.alt,
    origin.lat,
    origin.lng,
    origin.alt
  );

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas
        shadows="soft"
        camera={{
          position: [
            initialCameraPosition.x,
            initialCameraPosition.y,
            initialCameraPosition.z,
          ],
          fov: 60,
          near: 1,
          far: 1e9,
        }}
        gl={{
          logarithmicDepthBuffer: true,
          antialias: false,
          powerPreference: "high-performance",
        }}
      >
        <Suspense fallback={null}>
          <TilesSceneExample
            apiKey={apiKey}
            onTilesLoaded={() => console.log("Tiles loaded")}
          />
        </Suspense>
      </Canvas>
      <Loader />
    </div>
  );
}
