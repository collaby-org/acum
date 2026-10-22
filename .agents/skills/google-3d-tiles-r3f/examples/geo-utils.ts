/**
 * WGS84 geo utils: lat/lng/alt ↔ ECEF ↔ ENU (Y-up: X=east, Y=up, Z=-north).
 * Use the same origin as createECEFtoENUMatrix for latLngAltToENU / enuToLatLngAlt.
 * Copy to your project (e.g. src/lib/geo-utils.ts).
 */

import * as THREE from "three";

const WGS84_A = 6378137.0;
const WGS84_B = 6356752.314245;
const WGS84_E2 = 1 - (WGS84_B * WGS84_B) / (WGS84_A * WGS84_A);

export function latLngAltToECEF(
  lat: number,
  lng: number,
  alt: number = 0
): THREE.Vector3 {
  const latRad = THREE.MathUtils.degToRad(lat);
  const lngRad = THREE.MathUtils.degToRad(lng);
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);

  const x = (N + alt) * cosLat * Math.cos(lngRad);
  const y = (N + alt) * cosLat * Math.sin(lngRad);
  const z = (N * (1 - WGS84_E2) + alt) * sinLat;

  return new THREE.Vector3(x, y, z);
}

export function ecefToLatLngAlt(ecef: THREE.Vector3): {
  lat: number;
  lng: number;
  alt: number;
} {
  const x = ecef.x;
  const y = ecef.y;
  const z = ecef.z;

  const lng = THREE.MathUtils.radToDeg(Math.atan2(y, x));

  const p = Math.sqrt(x * x + y * y);
  let lat = Math.atan2(z, p * (1 - WGS84_E2));
  let alt = 0;

  for (let i = 0; i < 10; i++) {
    const sinLat = Math.sin(lat);
    const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
    alt = p / Math.cos(lat) - N;
    lat = Math.atan2(z, p * (1 - (WGS84_E2 * N) / (N + alt)));
  }

  return {
    lat: THREE.MathUtils.radToDeg(lat),
    lng,
    alt,
  };
}

export function latLngAltToENU(
  lat: number,
  lng: number,
  alt: number,
  originLat: number,
  originLng: number,
  originAlt: number = 0
): THREE.Vector3 {
  const pointECEF = latLngAltToECEF(lat, lng, alt);
  const originECEF = latLngAltToECEF(originLat, originLng, originAlt);
  const diff = pointECEF.clone().sub(originECEF);

  const latRad = THREE.MathUtils.degToRad(originLat);
  const lngRad = THREE.MathUtils.degToRad(originLng);
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLng = Math.sin(lngRad);
  const cosLng = Math.cos(lngRad);

  const east = -sinLng * diff.x + cosLng * diff.y;
  const north =
    -sinLat * cosLng * diff.x - sinLat * sinLng * diff.y + cosLat * diff.z;
  const up =
    cosLat * cosLng * diff.x + cosLat * sinLng * diff.y + sinLat * diff.z;

  return new THREE.Vector3(east, up, -north);
}

export function enuToLatLngAlt(
  enu: THREE.Vector3,
  originLat: number,
  originLng: number,
  originAlt: number = 0
): { lat: number; lng: number; alt: number } {
  const east = enu.x;
  const up = enu.y;
  const north = -enu.z;

  const latRad = THREE.MathUtils.degToRad(originLat);
  const lngRad = THREE.MathUtils.degToRad(originLng);
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLng = Math.sin(lngRad);
  const cosLng = Math.cos(lngRad);

  const dx = -sinLng * east - sinLat * cosLng * north + cosLat * cosLng * up;
  const dy = cosLng * east - sinLat * sinLng * north + cosLat * sinLng * up;
  const dz = cosLat * north + sinLat * up;

  const originECEF = latLngAltToECEF(originLat, originLng, originAlt);
  const pointECEF = new THREE.Vector3(
    originECEF.x + dx,
    originECEF.y + dy,
    originECEF.z + dz
  );

  return ecefToLatLngAlt(pointECEF);
}
