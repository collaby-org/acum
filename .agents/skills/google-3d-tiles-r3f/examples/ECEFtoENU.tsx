/**
 * ECEF → ENU matrix and TilesTransformer for 3d-tiles-renderer.
 * Apply to the group wrapping TilesRenderer so tiles are in local Y-up (X=east, Y=up, Z=-north).
 * Copy to your scene component or src/components/map/ECEFtoENU.tsx.
 */

import { useRef, useEffect } from "react";
import * as THREE from "three";
import { WGS84_ELLIPSOID } from "3d-tiles-renderer/three";

/**
 * ENU from library is X=east, Y=north, Z=up.
 * Remap to Three.js Y-up: X=east, Y=up, Z=-north (north = -Z).
 */
export function createECEFtoENUMatrix(
  centerLat: number,
  centerLng: number
): THREE.Matrix4 {
  const enuToECEF = new THREE.Matrix4();
  const latRad = THREE.MathUtils.degToRad(centerLat);
  const lngRad = THREE.MathUtils.degToRad(centerLng);
  WGS84_ELLIPSOID.getEastNorthUpFrame(latRad, lngRad, 0, enuToECEF);

  const ecefToENU = new THREE.Matrix4().copy(enuToECEF).invert();

  const enuToYUp = new THREE.Matrix4().set(
    1,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    -1,
    0,
    0,
    0,
    0,
    0,
    1
  );

  return new THREE.Matrix4().multiplyMatrices(enuToYUp, ecefToENU);
}

export function TilesTransformer({
  children,
  originLat,
  originLng,
  groupRef,
}: {
  children: React.ReactNode;
  originLat: number;
  originLng: number;
  groupRef?: React.RefObject<THREE.Group | null>;
}) {
  const internalRef = useRef<THREE.Group>(null);
  const appliedRef = useRef(false);
  const ref = groupRef ?? internalRef;

  useEffect(() => {
    if (ref.current && !appliedRef.current) {
      ref.current.matrix.copy(createECEFtoENUMatrix(originLat, originLng));
      ref.current.matrixAutoUpdate = false;
      appliedRef.current = true;
    }
  }, [originLat, originLng, ref]);

  return <group ref={ref as React.RefObject<THREE.Group>}>{children}</group>;
}
