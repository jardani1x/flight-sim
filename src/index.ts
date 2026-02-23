/**
 * Massive Web Flight Simulator - Main Entry Point
 * 
 * A380 Cockpit-First Flight Simulator
 * Built with CesiumJS + TypeScript
 */

import { CesiumWorld, CameraMode } from './world-cesium/index';
import { AircraftRenderer } from './aircraft-render/index';
import { InputManager } from './input/index';
import { FlightUI, UI_STYLES } from './ui/index';
import { PhysicsLoop } from './sim-core/index';
import { createA380Config, FlightControls, FDMState } from './fdm-jsbsim/index';
import { cartographicToEcef, ecefToCartographic, createLocalFrame } from './frames/index';

import type { PerformanceTier } from './aircraft-render/index';

// ============================================
// Configuration
// ============================================

interface SimulatorConfig {
  cesiumIonToken?: string;
  initialPosition: {
    latitude: number;
    longitude: number;
    altitude: number;
  };
  initialHeading: number;
  performanceTier: PerformanceTier['name'];
}

const DEFAULT_CONFIG: SimulatorConfig = {
  // User must provide their own Cesium ion token
  cesiumIonToken: undefined,
  initialPosition: {
    latitude: 1.3644,  // Singapore
    longitude: 103.9915,
    altitude: 1000     // meters
  },
  initialHeading: 90,  // East
  performanceTier: 'high'
};

// ============================================
// Main Simulator Class
// ============================================

export class FlightSimulator {
  private container: HTMLElement;
  private config: SimulatorConfig;
  
  // Core systems
  private world: CesiumWorld;
  private aircraft: AircraftRenderer;
  private input: InputManager;
  private ui: FlightUI;
  private physics: PhysicsLoop;
  
  // State
  private fdmState: FDMState;
  private fdmStep: ((controls: FlightControls, dt: number) => FDMState) | null = null;
  private running: boolean = false;

  constructor(container: HTMLElement, config: Partial<SimulatorConfig> = {}) {
    this.container = container;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize systems
    this.world = new CesiumWorld();
    this.aircraft = new AircraftRenderer({
      scale: 1.0,
      minimumPixelSize: 128
    });
    
    this.input = new InputManager();
    
    this.ui = new FlightUI(container, {
      showHUD: true,
      showPFD: true,
      showDebug: true
    });
    
    this.physics = new PhysicsLoop({
      fixedTimeStep: 1 / 60,
      maxSubSteps: 3
    });

    // Calculate initial position in ECEF
    const initialEcef = cartographicToEcef({
      longitude: this.config.initialPosition.longitude * Math.PI / 180,
      latitude: this.config.initialPosition.latitude * Math.PI / 180,
      height: this.config.initialPosition.altitude
    });

    // Create FDM config
    const fdmConfig = createA380Config(
      initialEcef,
      this.config.initialHeading * Math.PI / 180
    );

    // Initialize FDM (with fallback)
    this.fdmStep = null; // Will be set after init

    // Set initial state
    this.fdmState = {
      position: initialEcef,
      velocity: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: Math.sin(this.config.initialHeading / 2), w: Math.cos(this.config.initialHeading / 2) },
      angularVelocity: { x: 0, y: 0, z: 0 },
      airspeed: 0,
      altitude: this.config.initialPosition.altitude,
      heading: this.config.initialHeading * Math.PI / 180,
      pitch: 0,
      roll: 0
    };
  }

  /**
   * Initialize the simulator
   */
  async initialize(): Promise<void> {
    // Inject UI styles
    this.injectStyles();

    // Initialize Cesium world
    await this.world.initialize(this.container, {
      ionToken: this.config.cesiumIonToken,
      terrainProvider: 'default',
      imageryProvider: 'bing',
      enable3DTiles: true
    });

    // Set cockpit camera by default
    this.world.setCameraMode({ type: 'cockpit' });

    // Subscribe to physics updates
    this.physics.subscribe(this.updatePhysics);

    // Subscribe to UI tier changes
    this.ui.onTierChangeCallback((tier) => {
      this.setPerformanceTier(tier);
    });

    // Listen for gyro calibration
    window.addEventListener('gyro-calibrate', () => {
      this.input.calibrateGyro();
    });

    console.log('Flight Simulator initialized');
  }

  /**
   * Start the simulator
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.physics.start();
    console.log('Simulator started');
  }

  /**
   * Stop the simulator
   */
  stop(): void {
    this.running = false;
    this.physics.stop();
  }

  /**
   * Set camera mode
   */
  setCameraMode(mode: 'chase' | 'cockpit' | 'free'): void {
    const cameraMode: CameraMode = { type: mode };
    if (mode === 'chase') {
      cameraMode.distance = 50;
    }
    this.world.setCameraMode(cameraMode);
  }

  /**
   * Set performance tier
   */
  setPerformanceTier(tier: PerformanceTier['name']): void {
    this.aircraft.setTier(tier);
    this.world.setTerrainQuality(tier === 'low' ? 'low' : tier === 'medium' ? 'medium' : 'high');
  }

  /**
   * Load aircraft model
   */
  async loadAircraft(modelUrl: string): Promise<void> {
    await this.aircraft.load(this.world.getViewer()!.models);
  }

  /**
   * Physics update callback
   */
  private updatePhysics = (state, dt): void => {
    // Get input controls
    const controls = this.input.getControls();

    // Step FDM if available
    if (this.fdmStep) {
      this.fdmState = this.fdmStep(controls, dt);
    } else {
      // Fallback: simple movement
      this.updateSimplePhysics(controls, dt);
    }

    // Update world
    this.world.updateAircraft(this.fdmState.position, this.fdmState.orientation);

    // Update UI
    this.ui.updateFlightState(this.fdmState);
    this.ui.tick();
  };

  /**
   * Simple physics fallback
   */
  private updateSimplePhysics(controls: FlightControls, dt: number): void {
    const speed = 50; // m/s
    const turnRate = 0.5;

    // Update heading
    this.fdmState.heading += controls.rudder * turnRate * dt;
    this.fdmState.roll = controls.aileron * 0.5;
    this.fdmState.pitch = controls.elevator * 0.3;

    // Update position based on heading
    const heading = this.fdmState.heading;
    const pitch = this.fdmState.pitch;
    
    this.fdmState.velocity.x = Math.cos(heading) * Math.cos(pitch) * speed;
    this.fdmState.velocity.y = Math.sin(heading) * Math.cos(pitch) * speed;
    this.fdmState.velocity.z = -Math.sin(pitch) * speed;

    this.fdmState.position.x += this.fdmState.velocity.x * dt;
    this.fdmState.position.y += this.fdmState.velocity.y * dt;
    this.fdmState.position.z += this.fdmState.velocity.z * dt;

    // Update altitude
    this.fdmState.altitude = this.fdmState.position.z;
    this.fdmState.airspeed = speed;

    // Update orientation quaternion
    const roll = this.fdmState.roll;
    const pitchQ = this.fdmState.pitch;
    const yaw = this.fdmState.heading;

    const cr = Math.cos(roll / 2);
    const sr = Math.sin(roll / 2);
    const cp = Math.cos(pitchQ / 2);
    const sp = Math.sin(pitchQ / 2);
    const cy = Math.cos(yaw / 2);
    const sy = Math.sin(yaw / 2);

    this.fdmState.orientation = {
      x: sr * cp * cy - cr * sp * sy,
      y: cr * sp * cy + sr * cp * sy,
      z: cr * cp * sy - sr * sp * cy,
      w: cr * cp * cy + sr * sp * sy
    };
  }

  /**
   * Inject CSS styles
   */
  private injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = UI_STYLES;
    document.head.appendChild(style);
  }

  /**
   * Destroy simulator
   */
  destroy(): void {
    this.stop();
    this.world.destroy();
    this.aircraft.destroy();
    this.input.destroy();
    this.ui.destroy();
  }
}

// ============================================
// Auto-initialize on DOM ready
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Check for container
  const container = document.getElementById('flight-sim');
  if (!container) {
    console.error('Flight simulator container not found');
    return;
  }

  // Check for Cesium ion token
  const cesiumToken = (window as any).__CESIUM_ION_TOKEN__;
  if (!cesiumToken) {
    console.warn('Cesium ion token not provided. Set window.__CESIUM_ION_TOKEN__');
  }

  // Create and initialize simulator
  const sim = new FlightSimulator(container, {
    cesiumIonToken: cesiumToken,
    performanceTier: 'high'
  });

  await sim.initialize();

  // Try to load aircraft model (will fail without actual GLB)
  try {
    // Placeholder URL - user must replace with actual model
    // await sim.loadAircraft('/assets/a380.glb');
  } catch (e) {
    console.log('Aircraft model not loaded (placeholder)');
  }

  // Start simulator
  sim.start();

  // Expose for debugging
  (window as any).flightSim = sim;
});
