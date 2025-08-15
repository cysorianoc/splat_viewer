
import { useState, useRef, useCallback, useEffect } from 'react';

export const useFps = (): number => {
  const [fps, setFps] = useState(0);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const animationFrameId = useRef(0);

  const loop = useCallback(() => {
    frameCount.current++;
    const now = performance.now();
    if (now - lastTime.current >= 1000) {
      setFps(frameCount.current);
      frameCount.current = 0;
      lastTime.current = now;
    }
    animationFrameId.current = requestAnimationFrame(loop);
  }, []);
  
  useEffect(() => {
    animationFrameId.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId.current);
  }, [loop]);


  return fps;
};

// Note: This hook runs its own animation loop. For perfect sync,
// it's better to integrate the FPS calculation directly into the
// Three.js render loop. This is a simplified version for modularity.