/**
 * input - Control Input System
 * 
 * Responsibilities:
 * - Desktop: keyboard/mouse + gamepad/joystick mapping
 * - Mobile: touch controls + gyro calibration + fallback
 * - Normalized control outputs: throttle, aileron, elevator, rudder, brakes, flaps, trim
 */

import type { FlightControls } from '../fdm-jsbsim/index';

export interface InputConfig {
  enableKeyboard: boolean;
  enableMouse: boolean;
  enableGamepad: boolean;
  enableTouch: boolean;
  enableGyro: boolean;
}

export interface GamepadState {
  connected: boolean;
  axes: number[];
  buttons: boolean[];
  id: string;
}

export interface GyroState {
  available: boolean;
  alpha: number;   // Z-axis (yaw)
  beta: number;   // X-axis (pitch)
  gamma: number;  // Y-axis (roll)
  calibrated: boolean;
  calibrationOffset: { alpha: number; beta: number; gamma: number };
}

const DEFAULT_CONFIG: InputConfig = {
  enableKeyboard: true,
  enableMouse: true,
  enableGamepad: true,
  enableTouch: true,
  enableGyro: true
};

// Keyboard mapping
const KEY_MAP: Record<string, keyof FlightControls> = {
  'KeyW': 'throttle',
  'KeyS': 'throttle',
  'KeyA': 'aileron',
  'KeyD': 'aileron',
  'ArrowUp': 'elevator',
  'ArrowDown': 'elevator',
  'ArrowLeft': 'rudder',
  'ArrowRight': 'rudder',
  'KeyF': 'flaps',
  'KeyB': 'brakes',
  'KeyG': 'gear'
};

export class InputManager {
  private config: InputConfig;
  private controls: FlightControls = {
    throttle: 0,
    aileron: 0,
    elevator: 0,
    rudder: 0,
    flaps: 0,
    brakes: 0,
    gear: 0
  };

  // Input state
  private keys: Set<string> = new Set();
  private mousePosition: { x: number; y: number } = { x: 0, y: 0 };
  private mouseDelta: { x: number; y: number } = { x: 0, y: 0 };
  private mouseButtons: Set<number> = new Set();
  
  // Gamepad
  private gamepad: GamepadState | null = null;
  
  // Touch
  private touchPoints: Map<number, { x: number; y: number }> = new Map();
  private virtualJoystickLeft: { x: number; y: number; active: boolean } = { x: 0, y: 0, active: false };
  private virtualJoystickRight: { x: number; y: number; active: boolean } = { x: 0, y: 0, active: false };
  
  // Gyro
  private gyro: GyroState = {
    available: false,
    alpha: 0,
    beta: 0,
    gamma: 0,
    calibrated: false,
    calibrationOffset: { alpha: 0, beta: 0, gamma: 0 }
  };

  // Callbacks
  private onControlChange: ((controls: FlightControls) => void) | null = null;

  constructor(config: Partial<InputConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Keyboard
    if (this.config.enableKeyboard) {
      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('keyup', this.handleKeyUp);
    }

    // Mouse
    if (this.config.enableMouse) {
      window.addEventListener('mousemove', this.handleMouseMove);
      window.addEventListener('mousedown', this.handleMouseDown);
      window.addEventListener('mouseup', this.handleMouseUp);
    }

    // Gamepad
    if (this.config.enableGamepad) {
      window.addEventListener('gamepadconnected', this.handleGamepadConnected);
      window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
    }

    // Touch
    if (this.config.enableTouch) {
      window.addEventListener('touchstart', this.handleTouchStart);
      window.addEventListener('touchmove', this.handleTouchMove);
      window.addEventListener('touchend', this.handleTouchEnd);
    }

    // Gyro
    if (this.config.enableGyro) {
      this.initGyro();
    }
  }

  // ============================================
  // Event Handlers
  // ============================================

  private handleKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    this.updateKeyboardControls();
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    this.updateKeyboardControls();
  };

  private handleMouseMove = (e: MouseEvent): void => {
    this.mouseDelta.x = e.clientX - this.mousePosition.x;
    this.mouseDelta.y = e.clientY - this.mousePosition.y;
    this.mousePosition = { x: e.clientX, y: e.clientY };
  };

  private handleMouseDown = (e: MouseEvent): void => {
    this.mouseButtons.add(e.button);
  };

  private handleMouseUp = (e: MouseEvent): void => {
    this.mouseButtons.delete(e.button);
  };

  private handleGamepadConnected = (e: GamepadEvent): void => {
    this.gamepad = {
      connected: true,
      axes: Array.from(e.gamepad.axes),
      buttons: e.gamepad.buttons.map(b => b.pressed),
      id: e.gamepad.id
    };
    console.log('Gamepad connected:', this.gamepad.id);
  };

  private handleGamepadDisconnected = (): void => {
    this.gamepad = null;
  };

  private handleTouchStart = (e: TouchEvent): void => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      this.touchPoints.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
    }
    this.updateTouchControls();
  };

  private handleTouchMove = (e: TouchEvent): void => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const start = this.touchPoints.get(touch.identifier);
      if (start) {
        // Update virtual joystick positions
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        
        if (touch.clientX < window.innerWidth / 2) {
          // Left side - throttle/yaw
          this.virtualJoystickLeft = {
            x: Math.max(-1, Math.min(1, dx / 50)),
            y: Math.max(-1, Math.min(1, dy / 50)),
            active: true
          };
        } else {
          // Right side - pitch/roll
          this.virtualJoystickRight = {
            x: Math.max(-1, Math.min(1, dx / 50)),
            y: Math.max(-1, Math.min(1, dy / 50)),
            active: true
          };
        }
      }
    }
    this.updateTouchControls();
  };

  private handleTouchEnd = (e: TouchEvent): void => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      this.touchPoints.delete(touch.identifier);
      
      // Reset joystick when touch ends
      if (touch.clientX < window.innerWidth / 2) {
        this.virtualJoystickLeft.active = false;
        this.virtualJoystickLeft.x = 0;
        this.virtualJoystickLeft.y = 0;
      } else {
        this.virtualJoystickRight.active = false;
        this.virtualJoystickRight.x = 0;
        this.virtualJoystickRight.y = 0;
      }
    }
    this.updateTouchControls();
  };

  private async initGyro(): Promise<void> {
    try {
      // Request permission for iOS
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        if (response !== 'granted') {
          console.warn('Gyro permission denied');
          return;
        }
      }

      window.addEventListener('deviceorientation', this.handleGyro);
      this.gyro.available = true;
    } catch (e) {
      console.warn('Gyro not available:', e);
    }
  };

  private handleGyro = (e: DeviceOrientationEvent): void => {
    if (!this.gyro.calibrated) {
      // Calibrate on first reading
      this.gyro.calibrationOffset = {
        alpha: e.alpha || 0,
        beta: e.beta || 0,
        gamma: e.gamma || 0
      };
      this.gyro.calibrated = true;
    }

    this.gyro.alpha = (e.alpha || 0) - this.gyro.calibrationOffset.alpha;
    this.gyro.beta = (e.beta || 0) - this.gyro.calibrationOffset.beta;
    this.gyro.gamma = (e.gamma || 0) - this.gyro.calibrationOffset.gamma;
  };

  // ============================================
  // Control Updates
  // ============================================

  private updateKeyboardControls(): void {
    // Reset keyboard-driven controls
    let throttle = 0;
    let aileron = 0;
    let elevator = 0;
    let rudder = 0;

    // Throttle (W/S or W/S keys)
    if (this.keys.has('KeyW')) throttle = 1;
    if (this.keys.has('KeyS')) throttle = -1;

    // Aileron (A/D)
    if (this.keys.has('KeyA')) aileron = -1;
    if (this.keys.has('KeyD')) aileron = 1;

    // Elevator (Arrow Up/Down)
    if (this.keys.has('ArrowUp')) elevator = 1;
    if (this.keys.has('ArrowDown')) elevator = -1;

    // Rudder (Arrow Left/Right)
    if (this.keys.has('ArrowLeft')) rudder = -1;
    if (this.keys.has('ArrowRight')) rudder = 1;

    // Flaps (F key - cycle)
    const flaps = this.keys.has('KeyF') ? 1 : 0;
    
    // Brakes (B key)
    const brakes = this.keys.has('KeyB') ? 1 : 0;

    // Gear (G key)
    const gear = this.keys.has('KeyG') ? 1 : 0;

    this.controls = {
      throttle,
      aileron,
      elevator,
      rudder,
      flaps,
      brakes,
      gear
    };

    this.notifyChange();
  }

  private updateGamepadControls(): void {
    if (!this.gamepad || !this.config.enableGamepad) return;

    const gamepads = navigator.getGamepads();
    const gp = gamepads[0];
    
    if (!gp) return;

    // Standard flight stick mapping
    // Axes: 0=aileron, 1=elevator, 2=throttle, 3=rudder
    this.controls.aileron = gp.axes[0] || 0;
    this.controls.elevator = gp.axes[1] || 0;
    this.controls.throttle = (gp.axes[2] + 1) / 2; // Normalize -1..1 to 0..1
    this.controls.rudder = gp.axes[3] || 0;

    // Buttons
    if (gp.buttons[0]?.pressed) this.controls.flaps = 1;
    if (gp.buttons[1]?.pressed) this.controls.brakes = 1;
    if (gp.buttons[2]?.pressed) this.controls.gear = 1;
  }

  private updateTouchControls(): void {
    if (!this.config.enableTouch) return;

    // Left joystick: throttle (Y) + rudder (X)
    if (this.virtualJoystickLeft.active) {
      this.controls.throttle = -this.virtualJoystickLeft.y; // Inverted
      this.controls.rudder = this.virtualJoystickLeft.x;
    }

    // Right joystick: aileron (X) + elevator (Y)
    if (this.virtualJoystickRight.active) {
      this.controls.aileron = this.virtualJoystickRight.x;
      this.controls.elevator = -this.virtualJoystickRight.y; // Inverted
    }
  }

  private updateGyroControls(): void {
    if (!this.gyro.available || !this.config.enableGyro || !this.gyro.calibrated) return;

    // Map gyro to controls
    // Beta (tilt forward/back) -> elevator
    this.controls.elevator = Math.max(-1, Math.min(1, this.gyro.beta / 30));
    
    // Gamma (tilt left/right) -> aileron
    this.controls.aileron = Math.max(-1, Math.min(1, this.gyro.gamma / 30));
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * Get current controls (call each frame)
   */
  getControls(): FlightControls {
    // Poll gamepad each frame
    this.updateGamepadControls();
    
    // Apply gyro
    this.updateGyroControls();

    return { ...this.controls };
  }

  /**
   * Subscribe to control changes
   */
  onChange(callback: (controls: FlightControls) => void): void {
    this.onControlChange = callback;
  }

  /**
   * Calibrate gyro
   */
  calibrateGyro(): void {
    this.gyro.calibrated = false;
  }

  /**
   * Check if gyro is available
   */
  isGyroAvailable(): boolean {
    return this.gyro.available;
  }

  /**
   * Get gamepad state
   */
  getGamepadState(): GamepadState | null {
    return this.gamepad;
  }

  private notifyChange(): void {
    if (this.onControlChange) {
      this.onControlChange(this.controls);
    }
  }

  /**
   * Destroy input manager
   */
  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('gamepadconnected', this.handleGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
    window.removeEventListener('touchstart', this.handleTouchStart);
    window.removeEventListener('touchmove', this.handleTouchMove);
    window.removeEventListener('touchend', this.handleTouchEnd);
    window.removeEventListener('deviceorientation', this.handleGyro);
  }
}
