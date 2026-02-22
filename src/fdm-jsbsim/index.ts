/**
 * fdm-jsbsim - Flight Dynamics Model
 * 
 * Responsibilities:
 * - JSBSim initialization and aircraft definition loading
 * - Control input -> FDM -> state output
 * - MUST run in Web Worker if it impacts frame time
 * 
 * NOTE: If JSBSim WASM/JS port unavailable, use fallback aerodynamic model
 */

import type { Vector3, Quaternion } from '../sim-core/index';

export interface FlightControls {
  throttle: number;      // 0-1
  aileron: number;       // -1 to 1 (left to right)
  elevator: number;      // -1 to 1 (nose down to nose up)
  rudder: number;        // -1 to 1 (left to right)
  flaps: number;         // 0-1
  brakes: number;        // 0-1
  gear: number;          // 0-1 (up to down)
}

export interface FDMState {
  position: Vector3;           // ECEF position
  velocity: Vector3;           // m/s in body frame
  orientation: Quaternion;
  angularVelocity: Vector3;    // rad/s in body frame
  airspeed: number;           // m/s
  altitude: number;            // meters
  heading: number;            // radians
  pitch: number;              // radians
  roll: number;               // radians
}

export interface FDMAircraft {
  name: string;
  wingspan: number;           // meters
  length: number;             // meters
  mass: number;               // kg
  maxThrust: number;          // Newtons
  stallSpeed: number;         // m/s
  serviceCeiling: number;     // meters
}

export interface FDMConfig {
  aircraft: FDMAircraft;
  initialPosition: Vector3;   // ECEF
  initialHeading: number;     // radians
}

export type FDMStepFunction = (controls: FlightControls, dt: number) => FDMState;

// ============================================
// JSBSim Integration (if available)
// ============================================

/**
 * Initialize JSBSim with aircraft definition
 * Returns FDM step function
 */
export async function initJSBSim(config: FDMConfig): Promise<FDMStepFunction> {
  // TODO: Check if jsbsim-wasm package available
  // For now, fall back to simple aerodynamic model
  console.warn('JSBSim WASM not available, using fallback aerodynamic model');
  return initFallbackFDM(config);
}

// ============================================
// Fallback Aerodynamic Model
// ============================================

function initFallbackFDM(config: FDMConfig): FDMStepFunction {
  const { aircraft, initialPosition, initialHeading } = config;
  
  let state: FDMState = {
    position: { ...initialPosition },
    velocity: { x: 0, y: 0, z: 0 },
    orientation: { x: 0, y: 0, z: Math.sin(initialHeading / 2), w: Math.cos(initialHeading / 2) },
    angularVelocity: { x: 0, y: 0, z: 0 },
    airspeed: 0,
    altitude: initialPosition.z,
    heading: initialHeading,
    pitch: 0,
    roll: 0
  };

  const gravity = 9.81;
  const rho = 1.225; // air density at sea level

  return (controls: FlightControls, dt: number): FDMState => {
    const { throttle, aileron, elevator, rudder, flaps } = controls;
    
    // Calculate forces
    const thrust = throttle * aircraft.maxThrust;
    
    // Lift coefficient (simplified)
    const CL = 2 * Math.PI * elevator * (1 - flaps * 0.3);
    
    // Drag coefficient
    const CD = 0.02 + CL * CL / (Math.PI * 6 * 0.8); // L/D ratio ~6
    
    // Dynamic pressure
    const speed = Math.sqrt(
      state.velocity.x ** 2 + 
      state.velocity.y ** 2 + 
      state.velocity.z ** 2
    );
    const q = 0.5 * rho * speed * speed;
    const S = aircraft.wingspan * aircraft.length; // wing area estimate
    
    // Forces in body frame
    const Fx = thrust - q * S * CD;
    const Fy = q * S * CL * Math.cos(aileron * 0.5); // lift from wings
    const Fz = q * S * CL * Math.sin(aileron * 0.5); // side force from roll
    
    // Apply forces (F = ma)
    const ax = Fx / aircraft.mass;
    const ay = Fy / aircraft.mass;
    const az = -gravity + Fz / aircraft.mass; // gravity in body frame
    
    // Update velocity
    state.velocity.x += ax * dt;
    state.velocity.y += ay * dt;
    state.velocity.z += az * dt;
    
    // Update position
    state.position.x += state.velocity.x * dt;
    state.position.y += state.velocity.y * dt;
    state.position.z += state.velocity.z * dt;
    
    // Angular velocities from controls
    const p = aileron * 2.0;  // roll rate
    const q_rate = elevator * 1.5; // pitch rate
    const r = rudder * 1.0;  // yaw rate
    
    state.angularVelocity.x += p * dt;
    state.angularVelocity.y += q_rate * dt;
    state.angularVelocity.z += r * dt;
    
    // Damping
    state.angularVelocity.x *= 0.95;
    state.angularVelocity.y *= 0.95;
    state.angularVelocity.z *= 0.95;
    
    // Update orientation (simplified)
    state.roll += state.angularVelocity.x * dt;
    state.pitch += state.angularVelocity.y * dt;
    state.heading += state.angularVelocity.z * dt;
    
    // Recompute quaternion from euler
    const cr = Math.cos(state.roll / 2);
    const sr = Math.sin(state.roll / 2);
    const cp = Math.cos(state.pitch / 2);
    const sp = Math.sin(state.pitch / 2);
    const cy = Math.cos(state.heading / 2);
    const sy = Math.sin(state.heading / 2);
    
    state.orientation = {
      x: sr * cp * cy - cr * sp * sy,
      y: cr * sp * cy + sr * cp * sy,
      z: cr * cp * sy - sr * sp * cy,
      w: cr * cp * cy + sr * sp * sy
    };
    
    // Update derived values
    state.airspeed = speed;
    state.altitude = state.position.z;
    
    return { ...state };
  };
}

// ============================================
// A380 Aircraft Definition
// ============================================

export const A380_AIRCRAFT: FDMAircraft = {
  name: 'Airbus A380',
  wingspan: 79.75,        // meters
  length: 72.72,          // meters
  mass: 276800,          // kg (MTOW)
  maxThrust: 4 * 356000, // 4 engines × 356 kN
  stallSpeed: 100,       // m/s (~195 knots)
  serviceCeiling: 13100  // meters
};

export function createA380Config(initialPosition: Vector3, heading: number = 0): FDMConfig {
  return {
    aircraft: A380_AIRCRAFT,
    initialPosition,
    initialHeading: heading
  };
}
