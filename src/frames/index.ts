/**
 * frames - Coordinate Systems & Conversions
 * 
 * Responsibilities:
 * - Aircraft body frame (NED)
 * - Local tangent frame (NED or ENU - this file uses NED)
 * - Cesium world frame (ECEF + cartographic)
 * - Quaternion conventions (NED, right-handed)
 * 
 * CONVENTIONS CHOSEN:
 * - Body frame: NED (North-East-Down) - right-handed
 * - Local tangent: NED
 * - World: ECEF (Earth-Centered, Earth-Fixed)
 * - Heading 0 = North, positive = clockwise (yaw)
 * - Pitch positive = nose up
 * - Roll positive = right wing down
 */

import type { Vector3, Quaternion } from '../sim-core/index';

// ============================================
// Constants
// ============================================

export const WGS84_A = 6378137.0;           // Semi-major axis (m)
export const WGS84_F = 1 / 298.257223563;   // Flattening
export const WGS84_B = WGS84_A * (1 - WGS84_F); // Semi-minor axis
export const WGS84_E2 = 1 - (WGS84_B * WGS84_B) / (WGS84_A * WGS84_A); // First eccentricity squared

// ============================================
// ECEF <-> Geodetic Conversions
// ============================================

export interface Cartographic {
  longitude: number;   // radians
  latitude: number;    // radians
  height: number;      // meters above ellipsoid
}

export function ecefToCartographic(ecef: Vector3): Cartographic {
  const { x, y, z } = ecef;
  
  const p = Math.sqrt(x * x + y * y);
  const lon = Math.atan2(y, x);
  
  let lat = Math.atan2(z, p * (1 - WGS84_E2));
  let prevLat = 0;
  let iter = 0;
  
  // Iterate to convergence
  while (Math.abs(lat - prevLat) > 1e-12 && iter < 10) {
    prevLat = lat;
    const sinLat = Math.sin(lat);
    const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
    lat = Math.atan2(z + N * WGS84_E2 * sinLat, p);
    iter++;
  }
  
  const sinLat = Math.sin(lat);
  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const h = p / Math.cos(lat) - N;
  
  return { longitude: lon, latitude: lat, height: h };
}

export function cartographicToEcef(cartographic: Cartographic): Vector3 {
  const { longitude, latitude, height } = cartographic;
  
  const sinLat = Math.sin(latitude);
  const cosLat = Math.cos(latitude);
  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  
  const x = (N + height) * cosLat * Math.cos(longitude);
  const y = (N + height) * cosLat * Math.sin(longitude);
  const z = (N * (1 - WGS84_E2) + height) * sinLat;
  
  return { x, y, z };
}

// ============================================
// ECEF <-> Local NED Frame
// ============================================

export interface LocalFrame {
  origin: Vector3;      // ECEF origin
  rotation: Quaternion; // NED to ECEF rotation
}

/**
 * Create local NED frame at given geodetic location
 */
export function createLocalFrame(originEcef: Vector3): LocalFrame {
  const cart = ecefToCartographic(originEcef);
  return {
    origin: originEcef,
    rotation: geodeticToNedQuaternion(cart.latitude, cart.longitude)
  };
}

/**
 * Convert geodetic orientation to NED quaternion
 */
function geodeticToNedQuaternion(lat: number, lon: number): Quaternion {
  const cosLon = Math.cos(-lon);
  const sinLon = Math.sin(-lon);
  const cos90Lat = Math.cos(-(Math.PI / 2 - lat));
  const sin90Lat = Math.sin(-(Math.PI / 2 - lat));
  
  // Combined rotation quaternion
  return {
    x: sinLon * sin90Lat,
    y: -cosLon * sin90Lat,
    z: cosLon * cos90Lat,
    w: cosLon * cos90Lat + sinLon * sin90Lat
  };
}

/**
 * Transform ECEF position to local NED
 */
export function ecefToNed(ecef: Vector3, frame: LocalFrame): Vector3 {
  // Translate
  const dx = ecef.x - frame.origin.x;
  const dy = ecef.y - frame.origin.y;
  const dz = ecef.z - frame.origin.z;
  
  // Rotate by inverse of frame rotation (conjugate for unit quat)
  const q = frame.rotation;
  const qConj = { x: -q.x, y: -q.y, z: -q.z, w: q.w };
  
  return rotateVectorByQuaternion({ x: dx, y: dy, z: dz }, qConj);
}

/**
 * Transform local NED position to ECEF
 */
export function nedToEcef(ned: Vector3, frame: LocalFrame): Vector3 {
  // Rotate
  const rotated = rotateVectorByQuaternion(ned, frame.rotation);
  
  // Translate
  return {
    x: frame.origin.x + rotated.x,
    y: frame.origin.y + rotated.y,
    z: frame.origin.z + rotated.z
  };
}

/**
 * Rotate vector by quaternion
 */
function rotateVectorByQuaternion(v: Vector3, q: Quaternion): Vector3 {
  const qv = { x: q.x, y: q.y, z: q.z };
  const uv = cross(qv, v);
  const uuv = cross(qv, uv);
  
  return {
    x: v.x + 2 * (q.w * uv.x + uuv.x),
    y: v.y + 2 * (q.w * uv.y + uuv.y),
    z: v.z + 2 * (q.w * uv.z + uuv.z)
  };
}

function cross(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

// ============================================
// Body Frame <-> NED Frame
// ============================================

/**
 * Aircraft body frame is NED-aligned when orientation is neutral
 * Body +X = forward (nose)
 * Body +Y = right (starboard wing)
 * Body +Z = down
 */

/**
 * Convert body-frame velocity to NED
 */
export function bodyToNedVelocity(bodyVel: Vector3, orientation: Quaternion): Vector3 {
  return rotateVectorByQuaternion(bodyVel, orientation);
}

/**
 * Convert NED velocity to body frame
 */
export function nedToBodyVelocity(nedVel: Vector3, orientation: Quaternion): Vector3 {
  // Inverse rotation = conjugate
  const qConj = { x: -orientation.x, y: -orientation.y, z: -orientation.z, w: orientation.w };
  return rotateVectorByQuaternion(nedVel, qConj);
}

/**
 * Convert body-frame angular velocity to NED rates (heading/pitch/roll)
 */
export function bodyAngularToEulerRates(
  bodyRates: Vector3, 
  orientation: Quaternion
): Vector3 {
  // Simplified conversion
  const euler = quatToEuler(orientation);
  const roll = euler.x;
  const pitch = euler.y;
  
  const cosRoll = Math.cos(roll);
  const sinRoll = Math.sin(roll);
  const tanPitch = Math.tan(pitch);
  const secPitch = 1 / Math.cos(pitch);
  
  return {
    x: bodyRates.x + sinRoll * tanPitch * bodyRates.y + cosRoll * tanPitch * bodyRates.z,
    y: cosRoll * bodyRates.y - sinRoll * bodyRates.z,
    z: sinRoll * secPitch * bodyRates.y + cosRoll * secPitch * bodyRates.z
  };
}

// ============================================
// Utility Functions
// ============================================

function quatToEuler(q: Quaternion): Vector3 {
  const sinr_cosp = 2 * (q.w * q.x + q.y * q.z);
  const cosr_cosp = 1 - 2 * (q.x * q.x + q.y * q.y);
  const roll = Math.atan2(sinr_cosp, cosr_cosp);

  const sinp = 2 * (q.w * q.y - q.z * q.x);
  const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp);

  const siny_cosp = 2 * (q.w * q.z + q.x * q.y);
  const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z);
  const yaw = Math.atan2(siny_cosp, cosy_cosp);

  return { x: roll, y: pitch, z: yaw };
}

/**
 * Calculate distance between two ECEF positions (meters)
 */
export function ecefDistance(a: Vector3, b: Vector3): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate bearing from point A to point B (radians, 0 = North)
 */
export function ecefBearing(from: Vector3, to: Vector3): number {
  const fromCart = ecefToCartographic(from);
  const toCart = ecefToCartographic(to);
  
  const dLon = toCart.longitude - fromCart.longitude;
  const y = Math.sin(dLon) * Math.cos(toCart.latitude);
  const x = Math.cos(fromCart.latitude) * Math.sin(toCart.latitude) -
            Math.sin(fromCart.latitude) * Math.cos(toCart.latitude) * Math.cos(dLon);
  
  return Math.atan2(y, x);
}
