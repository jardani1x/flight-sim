/**
 * world-cesium - Cesium Viewer Setup
 * 
 * Uses Cesium from global CDN
 */

import type { Vector3, Quaternion } from '../sim-core/index';

interface CesiumViewer {
  scene: any;
  camera: any;
  entities: any;
  clock: any;
  destroy(): void;
}

interface CesiumConfig {
  ionToken?: string;
  terrainProvider?: string;
  imageryProvider?: string;
  enable3DTiles?: boolean;
  tilesetUrl?: string;
}

interface CameraMode {
  type: 'chase' | 'cockpit' | 'free';
  offset?: Vector3;
  distance?: number;
  fov?: number;
}

const DEFAULT_CONFIG: CesiumConfig = {
  terrainProvider: 'default',
  imageryProvider: 'bing',
  enable3DTiles: false
};

export class CesiumWorld {
  private viewer: CesiumViewer | null = null;
  private aircraftEntity: any = null;
  private cameraMode: CameraMode = { type: 'cockpit' };
  private aircraftPosition: Vector3 = { x: 0, y: 0, z: 0 };
  private aircraftOrientation: Quaternion = { x: 0, y: 0, z: 0, w: 1 };

  async initialize(container: HTMLElement, config: CesiumConfig = {}): Promise<void> {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const Cesium = (window as any).Cesium;
    
    if (!Cesium) {
      throw new Error('Cesium not loaded. Add Cesium CDN script to HTML.');
    }

    if (cfg.ionToken) {
      Cesium.Ion.defaultAccessToken = cfg.ionToken;
    }

    this.viewer = new Cesium.Viewer(container, {
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
  }

  setAircraftModel(url: string): void {
    if (!this.viewer) return;
    const Cesium = (window as any).Cesium;

    this.aircraftEntity = this.viewer.entities.add({
      position: Cesium.Cartesian3.ZERO,
      model: {
        uri: url,
        scale: 1.0,
        minimumPixelSize: 64,
        maximumScale: 50000
      }
    });
  }

  updateAircraft(position: Vector3, orientation: Quaternion): void {
    if (!this.viewer || !this.aircraftEntity) return;
    const Cesium = (window as any).Cesium;

    const cesiumPos = Cesium.Cartesian3.fromElements(position.x, position.y, position.z);
    const hpr = this.quaternionToHeadingPitchRoll(orientation);
    
    this.aircraftEntity.position = cesiumPos;
    this.aircraftEntity.orientation = Cesium.Transforms.headingPitchRollQuaternion(
      cesiumPos,
      new Cesium.HeadingPitchRoll(hpr.heading, hpr.pitch, hpr.roll)
    );

    this.aircraftPosition = position;
    this.aircraftOrientation = orientation;
  }

  private quaternionToHeadingPitchRoll(q: Quaternion): { heading: number; pitch: number; roll: number } {
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

  setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
  }

  flyTo(longitude: number, latitude: number, height: number): void {
    if (!this.viewer) return;
    const Cesium = (window as any).Cesium;
    
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
      duration: 2
    });
  }

  getViewer(): CesiumViewer | null {
    return this.viewer;
  }

  destroy(): void {
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
    }
  }
}
