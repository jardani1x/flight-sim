/**
 * aircraft-render - Aircraft GLB Loading & Rendering
 * 
 * Responsibilities:
 * - Load aircraft GLB as Cesium glTF Model
 * - Apply position/orientation from sim state
 * - LOD switching strategy (distance + performance tier)
 */

import { Cesium, Model, Cartesian3, Quaternion as CesiumQuaternion, Transforms } from 'cesium';
import type { Vector3, Quaternion } from '../sim-core/index';

export interface AircraftModelConfig {
  url: string;
  scale: number;
  minimumPixelSize: number;
  maximumScale: number;
}

export interface LODConfig {
  highDistance: number;    // Distance to switch to high quality
  mediumDistance: number;  // Distance to switch to medium
  lowDistance: number;     // Distance to switch to low
}

export interface PerformanceTier {
  name: 'low' | 'medium' | 'high';
  maxTriangles: number;
  maxTextureSize: number;
  modelScale: number;
}

const DEFAULT_LOD_CONFIG: LODConfig = {
  highDistance: 500,
  mediumDistance: 2000,
  lowDistance: 10000
};

const PERFORMANCE_TIERS: Record<string, PerformanceTier> = {
  low: { name: 'low', maxTriangles: 50000, maxTextureSize: 512, modelScale: 0.8 },
  medium: { name: 'medium', maxTriangles: 150000, maxTextureSize: 1024, modelScale: 1.0 },
  high: { name: 'high', maxTriangles: 500000, maxTextureSize: 4096, modelScale: 1.0 }
};

export class AircraftRenderer {
  private model: Model | null = null;
  private config: AircraftModelConfig;
  private lodConfig: LODConfig;
  private currentTier: PerformanceTier;
  private currentLOD: 'high' | 'medium' | 'low' = 'high';
  private position: Vector3 = { x: 0, y: 0, z: 0 };
  private orientation: Quaternion = { x: 0, y: 0, z: 0, w: 1 };

  constructor(
    config: Partial<AircraftModelConfig> = {},
    lodConfig: Partial<LODConfig> = {}
  ) {
    this.config = {
      url: config.url || '',
      scale: config.scale || 1.0,
      minimumPixelSize: config.minimumPixelSize || 64,
      maximumScale: config.maximumScale || 50000,
      ...config
    };

    this.lodConfig = { ...DEFAULT_LOD_CONFIG, ...lodConfig };
    this.currentTier = PERFORMANCE_TIERS['high'];
  }

  /**
   * Load the aircraft model
   */
  async load(cesiumModelCollection: Cesium.ModelCollection): Promise<void> {
    if (!this.config.url) {
      throw new Error('No model URL provided');
    }

    // Create model from GLB
    const model = Cesium.Model.fromGltf({
      url: this.config.url,
      scale: this.config.scale * this.currentTier.modelScale,
      minimumPixelSize: this.config.minimumPixelSize,
      maximumScale: this.config.maximumScale,
      incrementallyLoadTextures: true,
      maximumMemoryUsage: 512 // MB
    });

    await model.readyPromise;
    this.model = model;
    cesiumModelCollection.add(model);
  }

  /**
   * Update aircraft position and orientation
   */
  update(position: Vector3, orientation: Quaternion): void {
    this.position = position;
    this.orientation = orientation;

    if (!this.model) return;

    // Convert ECEF to Cartesian3
    const cartesian = Cartesian3.fromElements(position.x, position.y, position.z);
    
    // Convert quaternion to Cesium orientation
    const q = orientation;
    const cesiumOrientation = CesiumQuaternion.fromComponents(q.x, q.y, q.z, q.w);
    
    // Update model transform
    this.model.modelMatrix = Transforms.headingPitchRollQuaternion(
      cartesian,
      new Cesium.HeadingPitchRoll(0, 0, 0) // Orientation handled separately
    );
    
    // Set position and orientation
    this.model.position = cartesian;
    this.model.orientation = cesiumOrientation;
  }

  /**
   * Set performance tier
   */
  setTier(tierName: 'low' | 'medium' | 'high'): void {
    const newTier = PERFORMANCE_TIERS[tierName];
    if (!newTier || newTier.name === this.currentTier.name) return;

    this.currentTier = newTier;
    
    if (this.model) {
      this.model.scale = this.config.scale * newTier.modelScale;
    }
  }

  /**
   * Update LOD based on camera distance
   */
  updateLOD(cameraDistance: number): void {
    let newLOD: 'high' | 'medium' | 'low';

    if (cameraDistance < this.lodConfig.highDistance) {
      newLOD = 'high';
    } else if (cameraDistance < this.lodConfig.mediumDistance) {
      newLOD = 'medium';
    } else {
      newLOD = 'low';
    }

    if (newLOD !== this.currentLOD) {
      this.currentLOD = newLOD;
      this.applyLOD();
    }
  }

  private applyLOD(): void {
    if (!this.model) return;

    // Adjust model quality based on LOD
    switch (this.currentLOD) {
      case 'high':
        this.model.maximumMemoryUsage = 512;
        this.model.minimumPixelSize = this.config.minimumPixelSize;
        break;
      case 'medium':
        this.model.maximumMemoryUsage = 256;
        this.model.minimumPixelSize = this.config.minimumPixelSize * 0.8;
        break;
      case 'low':
        this.model.maximumMemoryUsage = 128;
        this.model.minimumPixelSize = this.config.minimumPixelSize * 0.5;
        break;
    }
  }

  /**
   * Get current model
   */
  getModel(): Model | null {
    return this.model;
  }

  /**
   * Check if model is loaded
   */
  isLoaded(): boolean {
    return this.model !== null;
  }

  /**
   * Get memory usage estimate (MB)
   */
  getMemoryUsage(): number {
    if (!this.model) return 0;
    // Rough estimate based on current LOD
    switch (this.currentLOD) {
      case 'high': return 256;
      case 'medium': return 128;
      case 'low': return 64;
    }
  }

  /**
   * Destroy model
   */
  destroy(): void {
    if (this.model) {
      this.model.destroy();
      this.model = null;
    }
  }
}

// ============================================
// A380 Model Paths (placeholder - user must provide)
// ============================================

export const A380_MODELS = {
  high: '/assets/a380-high.glb',
  medium: '/assets/a380-medium.glb',
  low: '/assets/a380-low.glb'
};

/**
 * Get model URL based on tier
 */
export function getModelForTier(tier: 'low' | 'medium' | 'high'): string {
  return A380_MODELS[tier];
}
