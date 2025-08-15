
import * as THREE from 'three';
import type { PlyData } from '../types';

/**
 * Loads and parses a .ply file from a local File object.
 * Supports both classic (red, green, blue) and Gaussian Splatting (f_dc_0, f_dc_1, f_dc_2) color properties.
 * Also parses scale and rotation for true splat rendering.
 *
 * @param source The source of the .ply file as a File object.
 * @param onProgress A callback function to report loading progress (0 to 1).
 * @returns A promise that resolves with the parsed PlyData.
 */
export const loadPly = async (source: File, onProgress: (progress: number) => void): Promise<PlyData> => {
  const buffer: ArrayBuffer = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = (e) => reject(new Error('Failed to read local file.'));
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
          onProgress(e.loaded / e.total);
      }
    };
    reader.readAsArrayBuffer(source);
  });

  const decoder = new TextDecoder();
  const headerText = decoder.decode(new Uint8Array(buffer, 0, 1024 * 10));
  const headerEnd = headerText.indexOf('end_header') + 'end_header'.length + 1;
  const headerLines = headerText.substring(0, headerEnd).split('\n');
  
  let pointCount = 0;
  let isBinary = false;
  let properties: {name: string, type: string, offset: number}[] = [];
  let currentOffset = 0;

  for (const line of headerLines) {
    if (line.startsWith('element vertex')) {
      pointCount = parseInt(line.split(' ')[2]);
    } else if (line.startsWith('property')) {
      const [, type, name] = line.split(' ');
      properties.push({ type, name: name.trim(), offset: currentOffset });
      
      if (type === 'float' || type === 'int32') currentOffset += 4;
      else if (type === 'uchar') currentOffset += 1;
      else if (type === 'double') currentOffset += 8;
      else {
        // Fallback for other types, assuming 4 bytes if unknown
        currentOffset += 4;
      }

    } else if (line.startsWith('format binary_little_endian')) {
      isBinary = true;
    }
  }
  const stride = currentOffset;

  if (!isBinary) throw new Error('Only binary_little_endian PLY format is supported.');
  if (pointCount === 0) throw new Error('No vertices found in PLY file.');
  
  const propMap = new Map(properties.map(p => [p.name, p]));
  const hasPosition = ['x', 'y', 'z'].every(p => propMap.has(p));
  const hasClassicColor = ['red', 'green', 'blue'].every(p => propMap.has(p));
  const hasSHColor = ['f_dc_0', 'f_dc_1', 'f_dc_2'].every(p => propMap.has(p));
  const hasSplat = ['scale_0', 'scale_1', 'scale_2'].every(p => propMap.has(p)) && ['rot_0', 'rot_1', 'rot_2', 'rot_3'].every(p => propMap.has(p));

  if (!hasPosition) throw new Error('PLY file must contain x, y, z properties.');
  if (!hasClassicColor && !hasSHColor) throw new Error(`PLY file must contain color properties. Found: ${properties.map(p => p.name).join(', ')}`);

  const useSHColor = hasSHColor;

  const positions = new Float32Array(pointCount * 3);
  const colors = new Float32Array(pointCount * 3);
  const elevations = new Float32Array(pointCount);
  const scales = hasSplat ? new Float32Array(pointCount * 3) : undefined;
  const rotations = hasSplat ? new Float32Array(pointCount * 4) : undefined;
  const boundingBox = new THREE.Box3();
  const dataView = new DataView(buffer, headerEnd);
  
  let minY = Infinity, maxY = -Infinity;
  const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

  for (let i = 0; i < pointCount; i++) {
    const byteOffset = i * stride;

    const x = dataView.getFloat32(byteOffset + propMap.get('x')!.offset, true);
    const y = dataView.getFloat32(byteOffset + propMap.get('y')!.offset, true);
    const z = dataView.getFloat32(byteOffset + propMap.get('z')!.offset, true);
    const posIdx = i * 3;
    positions[posIdx] = x;
    positions[posIdx + 1] = y;
    positions[posIdx + 2] = z;

    if (useSHColor) {
      const r_sh = dataView.getFloat32(byteOffset + propMap.get('f_dc_0')!.offset, true);
      const g_sh = dataView.getFloat32(byteOffset + propMap.get('f_dc_1')!.offset, true);
      const b_sh = dataView.getFloat32(byteOffset + propMap.get('f_dc_2')!.offset, true);
      colors[posIdx] = sigmoid(r_sh);
      colors[posIdx + 1] = sigmoid(g_sh);
      colors[posIdx + 2] = sigmoid(b_sh);
    } else { 
      colors[posIdx] = dataView.getUint8(byteOffset + propMap.get('red')!.offset) / 255.0;
      colors[posIdx + 1] = dataView.getUint8(byteOffset + propMap.get('green')!.offset) / 255.0;
      colors[posIdx + 2] = dataView.getUint8(byteOffset + propMap.get('blue')!.offset) / 255.0;
    }
    
    if (hasSplat) {
      const scaleIdx = i * 3;
      scales![scaleIdx] = Math.exp(dataView.getFloat32(byteOffset + propMap.get('scale_0')!.offset, true));
      scales![scaleIdx + 1] = Math.exp(dataView.getFloat32(byteOffset + propMap.get('scale_1')!.offset, true));
      scales![scaleIdx + 2] = Math.exp(dataView.getFloat32(byteOffset + propMap.get('scale_2')!.offset, true));

      const rotIdx = i * 4;
      // Normalize quaternion
      let qx = dataView.getFloat32(byteOffset + propMap.get('rot_0')!.offset, true);
      let qy = dataView.getFloat32(byteOffset + propMap.get('rot_1')!.offset, true);
      let qz = dataView.getFloat32(byteOffset + propMap.get('rot_2')!.offset, true);
      let qw = dataView.getFloat32(byteOffset + propMap.get('rot_3')!.offset, true);
      const L = Math.sqrt(qx*qx + qy*qy + qz*qz + qw*qw);
      rotations![rotIdx] = qw / L; // Store as WXYZ for THREE.js convention if needed, but GLSL wants XYZW
      rotations![rotIdx + 1] = qx / L;
      rotations![rotIdx + 2] = qy / L;
      rotations![rotIdx + 3] = qz / L;
    }

    elevations[i] = y;
    if(y < minY) minY = y;
    if(y > maxY) maxY = y;
    boundingBox.expandByPoint(new THREE.Vector3(x, y, z));
  }

  const yRange = maxY - minY;
  if (yRange > 1e-6) {
    for(let i=0; i<pointCount; i++) {
      elevations[i] = (elevations[i] - minY) / yRange;
    }
  } else {
    elevations.fill(0.5);
  }

  return { positions, colors, elevations, scales, rotations, boundingBox, pointCount };
};