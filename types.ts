
import type * as THREE from 'three';

export enum RenderMode {
  ORIGINAL = 0,
  COLORMAP = 1,
  SPLAT = 2,
}

export interface PlyData {
  positions: Float32Array;
  colors: Float32Array;
  elevations: Float32Array;
  scales?: Float32Array;
  rotations?: Float32Array;
  boundingBox: THREE.Box3;
  pointCount: number;
}

export interface Transformations {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: number;
}

export interface CropSettings {
  min: THREE.Vector3;
  max: THREE.Vector3;
  enabled: boolean;
}

export interface AppearanceSettings {
  pointSize: number;
  opacity: number;
  backgroundColor: string;
  splatScale: number;
}

export interface HelperSettings {
    showAxes: boolean;
    showGrid: boolean;
}

export interface PerformanceStats {
  fps: number;
  pointCount: number;
}