/**
 * sim-core - Fixed timestep physics loop
 * 
 * Responsibilities:
 * - Fixed timestep accumulator pattern (60 Hz default)
 * - Pause/step/time scale controls
 * - Deterministic update order
 */

export interface SimState {
  position: Vector3;
  orientation: Quaternion;
  velocity: Vector3;
  angularVelocity: Vector3;
  acceleration: Vector3;
  deltaTime: number;
  totalTime: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface SimConfig {
  fixedTimeStep: number;      // Default: 1/60 = 0.0167s
  maxSubSteps: number;        // Default: 3
  timeScale: number;          // Default: 1.0
  paused: boolean;
}

export type SimCallback = (state: SimState, dt: number) => void;

export class PhysicsLoop {
  private accumulator: number = 0;
  private state: SimState;
  private config: SimConfig;
  private callbacks: SimCallback[] = [];
  private lastTime: number = 0;
  private running: boolean = false;
  private animationFrameId: number | null = null;

  constructor(config: Partial<SimConfig> = {}) {
    this.config = {
      fixedTimeStep: 1 / 60,
      maxSubSteps: 3,
      timeScale: 1.0,
      paused: false,
      ...config
    };

    this.state = this.createInitialState();
  }

  private createInitialState(): SimState {
    return {
      position: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      velocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
      deltaTime: 0,
      totalTime: 0
    };
  }

  subscribe(callback: SimCallback): void {
    this.callbacks.push(callback);
  }

  unsubscribe(callback: SimCallback): void {
    this.callbacks = this.callbacks.filter(cb => cb !== callback);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.loop();
  }

  stop(): void {
    this.running = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  pause(): void {
    this.config.paused = true;
  }

  resume(): void {
    this.config.paused = false;
    this.lastTime = performance.now();
  }

  step(): void {
    if (this.config.paused) return;
    this.update(this.config.fixedTimeStep);
  }

  setTimeScale(scale: number): void {
    this.config.timeScale = Math.max(0, Math.min(10, scale));
  }

  getState(): SimState {
    return { ...this.state };
  }

  setState(state: Partial<SimState>): void {
    Object.assign(this.state, state);
  }

  private loop = (): void => {
    if (!this.running) return;

    const currentTime = performance.now();
    const frameTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Clamp frame time to avoid spiral of death
    const clampedFrameTime = Math.min(frameTime, 0.25);

    if (!this.config.paused) {
      this.accumulator += clampedFrameTime * this.config.timeScale;

      let steps = 0;
      while (this.accumulator >= this.config.fixedTimeStep && steps < this.config.maxSubSteps) {
        this.update(this.config.fixedTimeStep);
        this.accumulator -= this.config.fixedTimeStep;
        steps++;
      }
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    this.state.deltaTime = dt;
    this.state.totalTime += dt;

    // Notify all subscribers
    for (const callback of this.callbacks) {
      callback(this.state, dt);
    }
  }
}

// Utility functions
export function vec3Add(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function vec3Scale(v: Vector3, s: number): Vector3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function quatMultiply(a: Quaternion, b: Quaternion): Quaternion {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
  };
}

export function quatToEuler(q: Quaternion): Vector3 {
  // Roll (x), Pitch (y), Yaw (z)
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
