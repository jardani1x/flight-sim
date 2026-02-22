/**
 * world-cesium - Cesium Viewer Setup
 * 
 * Responsibilities:
 * - Cesium Viewer initialization
 * - Terrain/imagery configuration
 * - Optional 3D Tiles streaming
 * - Camera modes: chase, cockpit, free cam
 */

import { Cartesian3, Viewer, Entity, Camera, Math as CesiumMath, HeadingPitchRange } from 'cesium';
import type { Vector3, Quaternion } from '../sim-core/index';

export interface CesiumConfig {
  ionToken?: string;                    // Cesium ion API key
  terrainProvider?: string;              // 'default' | 'ellipsoid' | custom
  imageryProvider?: string;             // 'bing' | 'sentinel' | 'openstreetmap'
  enable3DTiles?: boolean;
  tilesetUrl?: string;
}

export interface CameraMode {
  type: 'chase' | 'cockpit' | 'free';
  offset?: Vector3;                      // Relative to aircraft
  distance?: number;                     // For chase cam
  fov?: number;                          // Field of view (radians)
}

const DEFAULT_CONFIG: CesiumConfig = {
  terrainProvider: 'default',
  imageryProvider: 'bing',
  enable3DTiles: false
};

export class CesiumWorld {
  private viewer: Viewer | null = null;
  private aircraftEntity: Entity | null = null;
  private cameraMode: CameraMode = { type: 'cockpit' };
  private aircraftPosition: Vector3 = { x: 0, y: 0, z: 0 };
  private aircraftOrientation: Quaternion = { x: 0, y: 0, z: 0, w: 1 };

  async initialize(container: HTMLElement, config: CesiumConfig = {}): Promise<void> {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    
    // Set ion token if provided
    if (cfg.ionToken) {
      // Will be set before Viewer creation
    }

    this.viewer = new Viewer(container, {
      terrainProvider: cfg.terrainProvider === 'ellipsoid' 
        ? undefined 
        : await this.createTerrainProvider(cfg.terrainProvider),
      imageryProvider: await this.createImageryProvider(cfg.imageryProvider),
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      animation: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      vrButton: false,
      infoBox: false,
      shouldAnimate: true
    });

    // Configure scene
    this.viewer.scene.globe.enableLighting = true;
    this.viewer.scene.globe.depthTestAgainstTerrain = true;
    this.viewer.clock.shouldAnimate = true;
    this.viewer.clock.multiplier = 1;

    // Enable 3D Tiles if configured
    if (cfg.enable3DTiles && cfg.tilesetUrl) {
      await this.load3DTiles(cfg.tilesetUrl);
    }
  }

  private async createTerrainProvider(type: string) {
    // Cesium World Terrain requires ion token
    // Fallback to ellipsoid if no token
    return undefined;
  }

  private async createImageryProvider(type: string) {
    // Default Cesium ion imagery
    return undefined;
  }

  private async load3DTiles(url: string) {
    if (!this.viewer) return;
    
    try {
      const tileset = await this.viewer.scene.primitives.add(
        await Cesium.Cesium3DTileset.fromUrl(url)
      );
      tileset.style = new Cesium.Cesium3DTileStyle({
        pointSize: 2,
        color: 'color("white", 0.5)'
      });
    } catch (e) {
      console.warn('Failed to load 3D Tiles:', e);
    }
  }

  /**
   * Set aircraft model for rendering
   */
  setAircraftModel(url: string): void {
    if (!this.viewer) return;

    this.aircraftEntity = this.viewer.entities.add({
      position: Cartesian3.ZERO,
      orientation: undefined,
      model: {
        uri: url,
        scale: 1.0,
        minimumPixelSize: 64,
        maximumScale: 50000
      },
      label: {
        text: 'A380',
        font: '14px sans-serif',
        showBackground: true,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -50)
      }
    });
  }

  /**
   * Update aircraft position and orientation
   */
  updateAircraft(position: Vector3, orientation: Quaternion): void {
    if (!this.viewer || !this.aircraftEntity) return;

    // Convert ECEF to Cesium Cartesian3
    const cesiumPos = new Cartesian3(position.x, position.y, position.z);
    
    // Convert quaternion to Cesium heading/pitch/roll
    const hpr = this.quaternionToHeadingPitchRoll(orientation);
    
    // Update entity
    this.aircraftEntity.position = cesiumPos;
    this.aircraftEntity.orientation = Cesium.Transforms.headingPitchRollQuaternion(
      cesiumPos,
      new Cesium.HeadingPitchRoll(hpr.heading, hpr.pitch, hpr.roll)
    );

    this.aircraftPosition = position;
    this.aircraftOrientation = orientation;

    // Update camera based on mode
    this.updateCamera();
  }

  private quaternionToHeadingPitchRoll(q: Quaternion): { heading: number; pitch: number; roll: number } {
    // NED quaternion to heading/pitch/roll
    const sinr_cosp = 2 * (q.w * q.x + q.y * q.z);
    const cosr_cosp = 1 - 2 * (q.x * q.x + q.y * q.y);
    const roll = Math.atan2(sinr_cosp, cosr_cosp);

    const sinp = 2 * (q.w * q.y - q.z * q.x);
    const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp);

    const siny_cosp = 2 * (q.w * q.z + q.x * q.y);
    const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z);
    const heading = Math.atan2(siny_cosp, cosy_cosp);

    return { heading, pitch, roll };
  }

  /**
   * Set camera mode
   */
  setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    this.updateCamera();
  }

  private updateCamera(): void {
    if (!this.viewer || !this.aircraftEntity) return;

    const camera = this.viewer.camera;
    const aircraftPos = Cartesian3.fromElements(
      this.aircraftPosition.x,
      this.aircraftPosition.y,
      this.aircraftPosition.z
    );

    switch (this.cameraMode.type) {
      case 'cockpit':
        // Camera inside cockpit looking forward
        // In NED: +X is forward, so we offset slightly forward
        const offset = this.quaternionToLocalVector({ x: 5, y: 0, z: 2 }, this.aircraftOrientation);
        const cameraPos = Cartesian3.add(
          aircraftPos,
          Cartesian3.fromElements(offset.x, offset.y, offset.z),
          new Cartesian3()
        );
        
        const forward = this.quaternionToLocalVector({ x: 100, y: 0, z: 0 }, this.aircraftOrientation);
        const lookAt = Cartesian3.add(
          aircraftPos,
          Cartesian3.fromElements(forward.x, forward.y, forward.z),
          new Cartesian3()
        );
        
        camera.setView({
          destination: cameraPos,
          orientation: {
            direction: Cartesian3.normalize(
              Cartesian3.subtract(lookAt, cameraPos, new Cartesian3()),
              new Cartesian3()
            ),
            up: Cartesian3.fromElements(0, 0, 1)
          }
        });
        break;

      case 'chase':
        // Camera behind and above aircraft
        const chaseOffset = this.quaternionToLocalVector(
          { x: -50, y: 0, z: 15 },
          this.aircraftOrientation
        );
        const chasePos = Cartesian3.add(
          aircraftPos,
          Cartesian3.fromElements(chaseOffset.x, chaseOffset.y, chaseOffset.z),
          new Cartesian3()
        );
        
        camera.setView({
          destination: chasePos,
          orientation: {
            direction: Cartesian3.normalize(
              Cartesian3.subtract(aircraftPos, chasePos, new Cartesian3()),
              new Cartesian3()
            ),
            up: Cartesian3.fromElements(0, 0, 1)
          }
        });
        break;

      case 'free':
        // Free camera - user controlled
        break;
    }
  }

  private quaternionToLocalVector(local: Vector3, orientation: Quaternion): Vector3 {
    // Rotate local vector by orientation quaternion
    const q = orientation;
    const v = local;
    
    const qv = { x: q.x, y: q.y, z: q.z };
    const uv = {
      x: qv.y * v.z - qv.z * v.y,
      y: qv.z * v.x - qv.x * v.z,
      z: qv.x * v.y - qv.y * v.x
    };
    const uuv = {
      x: qv.y * uv.z - qv.z * uv.y,
      y: qv.z * uv.x - qv.x * uv.z,
      z: qv.x * uv.y - qv.y * uv.x
    };
    
    return {
      x: v.x + 2 * (q.w * uv.x + uuv.x),
      y: v.y + 2 * (q.w * uv.y + uuv.y),
      z: v.z + 2 * (q.w * uv.z + uuv.z)
    };
  }

  /**
   * Fly to a geodetic location
   */
  flyTo(longitude: number, latitude: number, height: number): void {
    if (!this.viewer) return;
    
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
      duration: 2
    });
  }

  /**
   * Get current viewer (for external use)
   */
  getViewer(): Viewer | null {
    return this.viewer;
  }

  /**
   * Enable/disable 3D Tiles based on performance tier
   */
  set3DTilesEnabled(enabled: boolean): void {
    if (!this.viewer) return;
    
    // Toggle 3D tileset visibility
    this.viewer.scene.primitives.show = true; // Adjust based on implementation
  }

  /**
   * Set terrain quality
   */
  setTerrainQuality(quality: 'low' | 'medium' | 'high'): void {
    if (!this.viewer) return;
    
    // Adjust terrain detail
    switch (quality) {
      case 'low':
        this.viewer.scene.globe.terrainExaggeration = 1;
        break;
      case 'medium':
        this.viewer.scene.globe.terrainExaggeration = 1.5;
        break;
      case 'high':
        this.viewer.scene.globe.terrainExaggeration = 2;
        break;
    }
  }

  /**
   * Destroy viewer
   */
  destroy(): void {
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
    }
  }
}
