
import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { PlyData, Transformations, CropSettings, AppearanceSettings, RenderMode, HelperSettings } from '../types';
import { IconButton } from './ui/IconButton';
import { ResetIcon } from './icons/ResetIcon';

interface ViewerProps {
  plyData: PlyData | null;
  transformations: Transformations;
  crop: CropSettings;
  appearance: AppearanceSettings;
  renderMode: RenderMode;
  helpers: HelperSettings;
  onFpsUpdate: (fps: number) => void;
  onResetControls: () => void;
}

// --- GLSL Shaders for Gaussian Splat Rendering ---

const vertexShader = `
  // Attributes from BufferGeometry
  attribute vec3 color;
  attribute float elevation;
  attribute vec3 a_scale;
  attribute vec4 a_rotation; // xyzw

  // Uniforms passed from React/Three.js
  uniform float u_point_size;
  uniform float u_scale;
  uniform float u_splat_scale;
  uniform vec3 u_crop_min;
  uniform vec3 u_crop_max;
  uniform bool u_crop_enabled;
  uniform int u_render_mode; // 0: original, 1: colormap, 2: splat
  uniform vec2 u_focal; // Camera focal length (fx, fy)

  // Varyings passed to Fragment Shader
  varying vec3 v_color;
  varying float v_discard;
  varying vec2 v_conic;
  varying vec3 v_cov_a;
  varying vec3 v_cov_b;
  varying float v_radius; // Pass splat radius to fragment shader


  // Viridis colormap function
  vec3 viridis( float t ) {
    vec3 c = vec3(t);
    c.x = -3.916112 * c.x * c.x * c.x + 5.646949 * c.x * c.x + -1.385481 * c.x + 0.222733;
    c.y = -2.253683 * c.y * c.y * c.y + 3.093823 * c.y * c.y + 0.117286 * c.y + 0.024924;
    c.z = 2.875323 * c.z * c.z * c.z + -3.489865 * c.z * c.z + 1.297495 * c.z + 0.203291;
    return c;
  }

  void main() {
    v_discard = 0.0;
    // Cropping
    if (u_crop_enabled) {
      if (position.x < u_crop_min.x || position.x > u_crop_max.x ||
          position.y < u_crop_min.y || position.y > u_crop_max.y ||
          position.z < u_crop_min.z || position.z > u_crop_max.z) {
        v_discard = 1.0;
      }
    }

    // Color
    if (u_render_mode == 0 || u_render_mode == 2) { // Original or Splat
      v_color = color;
    } else { // Colormap
      v_color = viridis(elevation);
    }
    
    vec4 cam_pos = modelViewMatrix * vec4(position, 1.0);
    vec4 pos_hom = projectionMatrix * cam_pos;
    float P = 1.0 / pos_hom.w; // Perspective factor
    
    if (u_render_mode == 2) { // Advanced Splat rendering
        // Normalize quaternion
        vec4 q = normalize(vec4(a_rotation.yzw, a_rotation.x)); // convert from xyzw to wxyz for math
        
        // Construct rotation matrix from quaternion
        mat3 R = mat3(
            1.0 - 2.0 * (q.y * q.y + q.z * q.z), 2.0 * (q.x * q.y - q.z * q.w), 2.0 * (q.x * q.z + q.y * q.w),
            2.0 * (q.x * q.y + q.z * q.w), 1.0 - 2.0 * (q.x * q.x + q.z * q.z), 2.0 * (q.y * q.z - q.x * q.w),
            2.0 * (q.x * q.z - q.y * q.w), 2.0 * (q.y * q.z + q.x * q.w), 1.0 - 2.0 * (q.x * q.x + q.y * q.y)
        );

        // Construct scaling matrix
        mat3 S = mat3(
            a_scale.x, 0.0, 0.0,
            0.0, a_scale.y, 0.0,
            0.0, 0.0, a_scale.z
        );

        // 3D covariance matrix
        mat3 V = R * S * transpose(S) * transpose(R);
        
        // Viewing transformation matrix
        mat3 T = mat3(
            1.0, 0.0, 0.0,
            0.0, 1.0, 0.0,
            -cam_pos.x / cam_pos.z, -cam_pos.y / cam_pos.z, 0.0
        );
        mat3 J = mat3(
            u_focal.x / cam_pos.z, 0.0, 0.0,
            0.0, u_focal.y / cam_pos.z, 0.0,
            0.0, 0.0, 0.0
        );
        mat3 W = transpose(mat3(modelViewMatrix));
        
        // 2D projected covariance
        mat3 cov = transpose(J * W * V * transpose(W) * transpose(J));
        
        // Calculate point size from eigenvalues of projected covariance
        float d = cov[0][0] * cov[1][1] - cov[0][1] * cov[0][1];
        if (d <= 0.0) { v_discard = 1.0; }
        float mid = 0.5 * (cov[0][0] + cov[1][1]);
        float lambda1 = mid + sqrt(max(0.01, mid*mid - d));
        float lambda2 = mid - sqrt(max(0.01, mid*mid - d));
        float radius = 3.0 * sqrt(max(lambda1, lambda2));

        v_radius = radius * u_splat_scale;
        gl_PointSize = v_radius;
        
        v_cov_a = vec3(cov[0][0], cov[0][1], cov[1][1]);
        v_cov_b = vec3(cam_pos.z, d, 0.0);

    } else { // Simple point rendering
        gl_PointSize = u_point_size * (200.0 / -cam_pos.z);
    }
    
    gl_Position = pos_hom;
  }
`;

const fragmentShader = `
  uniform float u_opacity;
  uniform int u_render_mode;

  varying vec3 v_color;
  varying float v_discard;
  varying vec3 v_cov_a;
  varying vec3 v_cov_b;
  varying float v_radius;

  void main() {
    if (v_discard > 0.5) {
      discard;
    }
    
    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
    
    if (u_render_mode == 2) { // Splat
      vec2 scaled_cxy = cxy * (v_radius / 2.0);

      float det = v_cov_b.y;
      if (det <= 0.0) { discard; }

      mat2 inv_cov = mat2(v_cov_a.z, -v_cov_a.y, -v_cov_a.y, v_cov_a.x) / det;
      float D = dot(scaled_cxy, inv_cov * scaled_cxy);
      
      // The "cube" artifact comes from the square shape of gl_PointCoord.
      // By discarding fragments far from the splat's center, we clip 
      // the corners of the point sprite, which fixes the artifact. A value
      // of 4.0 corresponds to a 2-sigma cutoff.
      if (D > 4.0) {
        discard;
      }
      
      float alpha = u_opacity * exp(-0.5 * D);
      gl_FragColor = vec4(v_color, alpha);

    } else { // Simple point
      float r_squared = dot(cxy, cxy);
      if (r_squared > 1.0) {
        discard;
      }
      float alpha = u_opacity * exp(-4.0 * r_squared);
      gl_FragColor = vec4(v_color, alpha);
    }
  }
`;

export const Viewer: React.FC<ViewerProps> = ({ plyData, transformations, crop, appearance, renderMode, helpers, onFpsUpdate, onResetControls }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const axesHelperRef = useRef<THREE.AxesHelper | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  
  const frameCount = useRef(0);
  const lastFpsTime = useRef(performance.now());
  
  const resetCamera = useCallback(() => {
    if (controlsRef.current && plyData && cameraRef.current) {
      controlsRef.current.reset();
      const center = new THREE.Vector3();
      plyData.boundingBox.getCenter(center);
      const size = new THREE.Vector3();
      plyData.boundingBox.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = cameraRef.current!.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
      cameraZ *= 1.5;
      
      cameraRef.current!.position.copy(center);
      cameraRef.current!.position.z = center.z + cameraZ;
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    }
  }, [plyData]);

  // Initialize Scene
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.z = 5;
    cameraRef.current = camera;
    
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controlsRef.current = controls;

    // --- Helpers ---
    const axesHelper = new THREE.AxesHelper(1);
    axesHelperRef.current = axesHelper;
    scene.add(axesHelper);

    const gridHelper = new THREE.GridHelper(10, 10);
    gridHelperRef.current = gridHelper;
    scene.add(gridHelper);

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
      
      frameCount.current++;
      const now = performance.now();
      if(now - lastFpsTime.current >= 1000) {
        onFpsUpdate(frameCount.current);
        frameCount.current = 0;
        lastFpsTime.current = now;
      }
    };
    animate();

    const handleResize = () => {
      if(mount && cameraRef.current && rendererRef.current) {
        const cam = cameraRef.current;
        const rend = rendererRef.current;
        cam.aspect = mount.clientWidth / mount.clientHeight;
        cam.updateProjectionMatrix();
        rend.setSize(mount.clientWidth, mount.clientHeight);
        
        // Update focal length uniform on resize
        if (pointsRef.current) {
             const material = pointsRef.current.material as THREE.ShaderMaterial;
             const fov_y = cam.fov * Math.PI / 180.0;
             const focal_y = mount.clientHeight / (2.0 * Math.tan(fov_y / 2.0));
             const focal_x = focal_y * cam.aspect;
             material.uniforms.u_focal.value = new THREE.Vector2(focal_x, focal_y);
        }
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
      controls.dispose();
    };
  }, [onFpsUpdate]);

  // Update background and helpers
  useEffect(() => {
    if (rendererRef.current) rendererRef.current.setClearColor(appearance.backgroundColor, 1);
    if (axesHelperRef.current) axesHelperRef.current.visible = helpers.showAxes;
    if (gridHelperRef.current) gridHelperRef.current.visible = helpers.showGrid;
    if (gridHelperRef.current && plyData) {
        gridHelperRef.current.position.y = plyData.boundingBox.min.y;
    }
  }, [appearance.backgroundColor, helpers, plyData]);

  // Handle new PLY data
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !plyData) return;

    if (pointsRef.current) {
      scene.remove(pointsRef.current);
      pointsRef.current.geometry.dispose();
      (pointsRef.current.material as THREE.ShaderMaterial).dispose();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(plyData.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(plyData.colors, 3));
    geometry.setAttribute('elevation', new THREE.BufferAttribute(plyData.elevations, 1));
    if (plyData.scales && plyData.rotations) {
        geometry.setAttribute('a_scale', new THREE.BufferAttribute(plyData.scales, 3));
        geometry.setAttribute('a_rotation', new THREE.BufferAttribute(plyData.rotations, 4));
    }
    geometry.boundingBox = plyData.boundingBox.clone();
    
    const fov_y = cameraRef.current!.fov * Math.PI / 180.0;
    const focal_y = mountRef.current!.clientHeight / (2.0 * Math.tan(fov_y / 2.0));
    const focal_x = focal_y * cameraRef.current!.aspect;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        u_point_size: { value: appearance.pointSize },
        u_opacity: { value: appearance.opacity },
        u_splat_scale: { value: appearance.splatScale },
        u_render_mode: { value: renderMode },
        u_crop_min: { value: crop.min },
        u_crop_max: { value: crop.max },
        u_crop_enabled: { value: crop.enabled },
        u_focal: { value: new THREE.Vector2(focal_x, focal_y) },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    const points = new THREE.Points(geometry, material);
    pointsRef.current = points;
    scene.add(points);
    
    resetCamera();

  }, [plyData, resetCamera]);

  // Update shader uniforms and object transforms
  useEffect(() => {
    const points = pointsRef.current;
    if (!points) return;
    
    points.position.copy(transformations.position);
    points.rotation.copy(transformations.rotation);
    points.scale.setScalar(transformations.scale);

    const material = points.material as THREE.ShaderMaterial;
    material.uniforms.u_point_size.value = appearance.pointSize;
    material.uniforms.u_opacity.value = appearance.opacity;
    material.uniforms.u_splat_scale.value = appearance.splatScale;
    material.uniforms.u_render_mode.value = renderMode;
    material.uniforms.u_crop_min.value = crop.min;
    material.uniforms.u_crop_max.value = crop.max;
    material.uniforms.u_crop_enabled.value = crop.enabled;

  }, [transformations, appearance, renderMode, crop]);
  
  const handleResetClick = () => {
    resetCamera();
    onResetControls();
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" />
      <div className="absolute top-4 right-4">
        <IconButton tooltip="Reset View" onClick={handleResetClick}>
            <ResetIcon />
        </IconButton>
      </div>
    </div>
  );
};
