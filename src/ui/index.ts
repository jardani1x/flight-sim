/**
 * ui - HUD + PFD + Debug Overlays
 * 
 * Responsibilities:
 * - HUD: airspeed, altitude, VSI, heading
 * - Minimal PFD (Primary Flight Display)
 * - Debug overlays: state, FPS, physics step time, tiles loaded, memory
 * - Settings: performance tier toggle
 */

import type { FDMState } from '../fdm-jsbsim/index';
import type { PerformanceTier } from '../aircraft-render/index';

export interface UIConfig {
  showHUD: boolean;
  showPFD: boolean;
  showDebug: boolean;
  hudPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

const DEFAULT_CONFIG: UIConfig = {
  showHUD: true,
  showPFD: true,
  showDebug: true,
  hudPosition: 'top-left'
};

interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  physicsTime: number;
  tilesLoaded: number;
  memoryEstimate: number;
}

export class FlightUI {
  private container: HTMLElement;
  private config: UIConfig;
  
  // UI Elements
  private hud: HTMLElement | null = null;
  private pfd: HTMLElement | null = null;
  private debug: HTMLElement | null = null;
  private settings: HTMLElement | null = null;
  
  // Performance tracking
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private fpsUpdateTime: number = 0;
  private currentFPS: number = 60;
  
  // Callbacks
  private onTierChange: ((tier: PerformanceTier['name']) => void) | null = null;

  constructor(container: HTMLElement, config: Partial<UIConfig> = {}) {
    this.container = container;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.createUIElements();
  }

  private createUIElements(): void {
    // HUD
    if (this.config.showHUD) {
      this.hud = document.createElement('div');
      this.hud.className = 'flight-hud';
      this.hud.innerHTML = `
        <div class="hud-item airspeed">
          <span class="label">IAS</span>
          <span class="value">---</span>
          <span class="unit">kts</span>
        </div>
        <div class="hud-item altitude">
          <span class="label">ALT</span>
          <span class="value">---</span>
          <span class="unit">ft</span>
        </div>
        <div class="hud-item vsi">
          <span class="label">V/S</span>
          <span class="value">---</span>
          <span class="unit">fpm</span>
        </div>
        <div class="hud-item heading">
          <span class="label">HDG</span>
          <span class="value">---</span>
          <span class="unit">°</span>
        </div>
      `;
      this.container.appendChild(this.hud);
    }

    // PFD
    if (this.config.showPFD) {
      this.pfd = document.createElement('div');
      this.pfd.className = 'flight-pfd';
      this.pfd.innerHTML = `
        <canvas class="pfd-canvas" width="300" height="300"></canvas>
      `;
      this.container.appendChild(this.pfd);
    }

    // Debug overlay
    if (this.config.showDebug) {
      this.debug = document.createElement('div');
      this.debug.className = 'flight-debug';
      this.debug.innerHTML = `
        <div class="debug-item fps">FPS: --</div>
        <div class="debug-item frame-time">Frame: --ms</div>
        <div class="debug-item physics-time">Physics: --ms</div>
        <div class="debug-item tiles">Tiles: 0</div>
        <div class="debug-item memory">Memory: --MB</div>
      `;
      this.container.appendChild(this.debug);
    }

    // Settings panel
    this.settings = document.createElement('div');
    this.settings.className = 'flight-settings';
    this.settings.innerHTML = `
      <div class="settings-title">Settings</div>
      <div class="settings-tier">
        <label>Quality:</label>
        <select class="tier-select">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high" selected>High</option>
        </select>
      </div>
      <div class="settings-controls">
        <button class="calibrate-gyro">Calibrate Gyro</button>
      </div>
    `;
    this.container.appendChild(this.settings);

    // Add event listeners
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const tierSelect = this.settings?.querySelector('.tier-select') as HTMLSelectElement;
    tierSelect?.addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value as PerformanceTier['name'];
      if (this.onTierChange) {
        this.onTierChange(value);
      }
    });

    const gyroButton = this.settings?.querySelector('.calibrate-gyro') as HTMLButtonElement;
    gyroButton?.addEventListener('click', () => {
      // Emit calibration event (handled externally)
      window.dispatchEvent(new CustomEvent('gyro-calibrate'));
    });
  }

  /**
   * Update HUD with flight state
   */
  updateFlightState(state: FDMState): void {
    if (!this.hud) return;

    // Convert units
    const iasKnots = state.airspeed * 1.94384; // m/s to knots
    const altFeet = state.altitude * 3.28084;   // m to ft
    const vsiFpm = 0; // Calculate from rate of climb
    const headingDeg = (state.heading * 180 / Math.PI + 360) % 360;

    // Update HUD elements
    this.updateHudValue('.airspeed .value', iasKnots.toFixed(0));
    this.updateHudValue('.altitude .value', altFeet.toFixed(0));
    this.updateHudValue('.vsi .value', vsiFpm.toFixed(0));
    this.updateHudValue('.heading .value', headingDeg.toFixed(0));

    // Update PFD
    this.updatePFD(state);
  }

  private updateHudValue(selector: string, value: string): void {
    const element = this.hud?.querySelector(selector);
    if (element) {
      element.textContent = value;
    }
  }

  /**
   * Update PFD canvas
   */
  private updatePFD(state: FDMState): void {
    const canvas = this.pfd?.querySelector('.pfd-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Clear
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Pitch ladder
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 1;
    
    const pitch = state.pitch * 180 / Math.PI;
    const roll = state.roll * 180 / Math.PI;
    
    // Draw pitch lines
    for (let p = -90; p <= 90; p += 10) {
      const yOffset = (pitch - p) * 3; // Scale factor
      if (Math.abs(yOffset) < 100) {
        const lineWidth = Math.abs(p) === 0 ? 60 : 40;
        ctx.beginPath();
        ctx.moveTo(centerX - lineWidth, centerY - yOffset);
        ctx.lineTo(centerX + lineWidth, centerY - yOffset);
        ctx.stroke();
        
        // Pitch label
        ctx.fillStyle = '#00ff00';
        ctx.font = '10px monospace';
        ctx.fillText(p.toString(), centerX + lineWidth + 5, centerY - yOffset + 3);
      }
    }

    // Draw roll pointer
    ctx.save();
    ctx.translate(centerX, 30);
    ctx.rotate(-roll * Math.PI / 180);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-10, -15);
    ctx.lineTo(10, -15);
    ctx.closePath();
    ctx.fillStyle = '#00ff00';
    ctx.fill();
    ctx.restore();

    // Heading indicator at bottom
    const heading = (state.heading * 180 / Math.PI + 360) % 360;
    ctx.fillStyle = '#00ff00';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`HDG ${heading.toFixed(0)}°`, centerX, height - 20);

    // Airspeed indicator on left
    const ias = state.airspeed * 1.94384;
    ctx.fillText(`${ias.toFixed(0)} kts`, 30, centerY);

    // Altitude indicator on right
    const alt = state.altitude * 3.28084;
    ctx.fillText(`${alt.toFixed(0)} ft`, width - 30, centerY);
  }

  /**
   * Update performance metrics
   */
  updatePerformance(metrics: PerformanceMetrics): void {
    if (!this.debug) return;

    this.updateDebugValue('.fps', `FPS: ${metrics.fps.toFixed(0)}`);
    this.updateDebugValue('.frame-time', `Frame: ${metrics.frameTime.toFixed(1)}ms`);
    this.updateDebugValue('.physics-time', `Physics: ${metrics.physicsTime.toFixed(1)}ms`);
    this.updateDebugValue('.tiles', `Tiles: ${metrics.tilesLoaded}`);
    this.updateDebugValue('.memory', `Memory: ${metrics.memoryEstimate.toFixed(0)}MB`);
  }

  private updateDebugValue(selector: string, value: string): void {
    const element = this.debug?.querySelector(selector);
    if (element) {
      element.textContent = value;
    }
  }

  /**
   * Calculate FPS (call each frame)
   */
  tick(): void {
    const now = performance.now();
    this.frameCount++;

    if (now - this.fpsUpdateTime >= 1000) {
      this.currentFPS = this.frameCount * 1000 / (now - this.fpsUpdateTime);
      this.frameCount = 0;
      this.fpsUpdateTime = now;
      
      // Update debug with FPS
      if (this.debug) {
        this.updatePerformance({
          fps: this.currentFPS,
          frameTime: 1000 / this.currentFPS,
          physicsTime: 0,
          tilesLoaded: 0,
          memoryEstimate: 0
        });
      }
    }

    this.lastFrameTime = now;
  }

  /**
   * Subscribe to tier changes
   */
  onTierChangeCallback(callback: (tier: PerformanceTier['name']) => void): void {
    this.onTierChange = callback;
  }

  /**
   * Show/hide UI elements
   */
  setVisible(visible: boolean): void {
    const elements = [this.hud, this.pfd, this.debug, this.settings];
    elements.forEach(el => {
      if (el) el.style.display = visible ? 'block' : 'none';
    });
  }

  /**
   * Destroy UI
   */
  destroy(): void {
    const elements = [this.hud, this.pfd, this.debug, this.settings];
    elements.forEach(el => {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
  }
}

// ============================================
// CSS Styles (injected)
// ============================================

export const UI_STYLES = `
.flight-hud {
  position: absolute;
  top: 20px;
  left: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-family: 'Courier New', monospace;
  color: #00ff00;
  background: rgba(0, 0, 0, 0.5);
  padding: 15px;
  border-radius: 8px;
}

.hud-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.hud-item .label {
  font-size: 12px;
  opacity: 0.7;
  width: 30px;
}

.hud-item .value {
  font-size: 24px;
  font-weight: bold;
  width: 60px;
  text-align: right;
}

.hud-item .unit {
  font-size: 10px;
  opacity: 0.7;
}

.flight-pfd {
  position: absolute;
  bottom: 20px;
  right: 20px;
}

.pfd-canvas {
  border-radius: 50%;
  border: 2px solid #00ff00;
}

.flight-debug {
  position: absolute;
  top: 20px;
  right: 20px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #ffff00;
  background: rgba(0, 0, 0, 0.7);
  padding: 10px;
  border-radius: 4px;
}

.debug-item {
  margin-bottom: 4px;
}

.flight-settings {
  position: absolute;
  bottom: 20px;
  left: 20px;
  font-family: sans-serif;
  color: white;
  background: rgba(0, 0, 0, 0.7);
  padding: 15px;
  border-radius: 8px;
}

.settings-title {
  font-weight: bold;
  margin-bottom: 10px;
}

.settings-tier {
  margin-bottom: 10px;
}

.settings-tier label {
  margin-right: 8px;
}

.tier-select {
  background: #333;
  color: white;
  border: 1px solid #555;
  padding: 4px 8px;
  border-radius: 4px;
}

.calibrate-gyro {
  background: #444;
  color: white;
  border: 1px solid #666;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
}

.calibrate-gyro:hover {
  background: #555;
}
`;
