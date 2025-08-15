
import React, { useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { Viewer } from './components/Viewer';
import { Controls } from './components/Controls';
import { loadPly } from './services/plyLoader';
import { RenderMode } from './types';
import type { PlyData, Transformations, CropSettings, AppearanceSettings, HelperSettings, PerformanceStats } from './types';

const App: React.FC = () => {
  const [plyData, setPlyData] = useState<PlyData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [splatDataAvailable, setSplatDataAvailable] = useState(false);

  const defaultTransformations: Transformations = {
    position: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: 1,
  };

  const [transformations, setTransformations] = useState<Transformations>(defaultTransformations);

  const [crop, setCrop] = useState<CropSettings>({
    min: new THREE.Vector3(),
    max: new THREE.Vector3(),
    enabled: false,
  });

  const [appearance, setAppearance] = useState<AppearanceSettings>({
    pointSize: 5.0,
    opacity: 1.0,
    backgroundColor: '#1a202c', // gray-900
    splatScale: 1.0,
  });

  const [helpers, setHelpers] = useState<HelperSettings>({
      showAxes: true,
      showGrid: true,
  });
  
  const [renderMode, setRenderMode] = useState<RenderMode>(RenderMode.ORIGINAL);

  const [stats, setStats] = useState<PerformanceStats>({ fps: 0, pointCount: 0 });

  const handleFpsUpdate = useCallback((fps: number) => {
    setStats(s => ({ ...s, fps }));
  }, []);

  const resetControls = useCallback(() => {
    setTransformations(defaultTransformations);
    if(plyData) {
      setCrop({
        min: plyData.boundingBox.min.clone(),
        max: plyData.boundingBox.max.clone(),
        enabled: false,
      })
    }
  }, [plyData]);

  const handleLoad = async (source: File) => {
    setIsLoading(true);
    setError(null);
    setLoadingProgress(0);
    setSplatDataAvailable(false);
    
    setRenderMode(RenderMode.ORIGINAL);
    
    try {
      const data = await loadPly(source, setLoadingProgress);
      setPlyData(data);
      setStats(s => ({ ...s, pointCount: data.pointCount }));
      
      const hasSplatData = !!(data.scales && data.rotations);
      setSplatDataAvailable(hasSplatData);
      // Automatically switch to splat mode if available and not already set
      if(hasSplatData) {
          setRenderMode(RenderMode.SPLAT);
      } else {
          setRenderMode(RenderMode.ORIGINAL);
      }

      setCrop({
        min: data.boundingBox.min.clone(),
        max: data.boundingBox.max.clone(),
        enabled: false,
      })
      setTransformations(defaultTransformations);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'An unknown error occurred while loading the model.');
      setPlyData(null);
      setStats(s => ({ ...s, pointCount: 0 }));
    } finally {
      setIsLoading(false);
      setLoadingProgress(0);
    }
  };

  const handleFileChange = (file: File) => {
    handleLoad(file);
  };

  return (
    <div className="w-screen h-screen flex bg-gray-900 overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 bg-black/70 flex flex-col justify-center items-center z-50">
            <div className="w-16 h-16 border-4 border-t-cyan-500 border-gray-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-white text-lg">Loading Model...</p>
            {loadingProgress > 0 && loadingProgress < 1 && (
                <div className="w-64 mt-2 bg-gray-600 rounded-full h-2.5">
                    <div className="bg-cyan-500 h-2.5 rounded-full" style={{ width: `${loadingProgress * 100}%` }}></div>
                </div>
            )}
        </div>
      )}
      <main className="flex-grow h-full relative">
        <Viewer 
          plyData={plyData} 
          transformations={transformations}
          crop={crop}
          appearance={appearance}
          renderMode={renderMode}
          helpers={helpers}
          onFpsUpdate={handleFpsUpdate}
          onResetControls={resetControls}
        />
      </main>
      <aside className="flex-shrink-0 h-full">
        <Controls 
          onFileChange={handleFileChange}
          isLoading={isLoading}
          error={error}
          transformations={transformations}
          setTransformations={setTransformations}
          crop={crop}
          setCrop={setCrop}
          appearance={appearance}
          setAppearance={setAppearance}
          helpers={helpers}
          setHelpers={setHelpers}
          renderMode={renderMode}
          setRenderMode={setRenderMode}
          splatDataAvailable={splatDataAvailable}
          stats={stats}
          dataBounds={plyData?.boundingBox || null}
        />
      </aside>
    </div>
  );
};

export default App;