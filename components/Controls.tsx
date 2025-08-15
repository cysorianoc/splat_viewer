
import React, { useState, useRef } from 'react';
import * as THREE from 'three';
import { Transformations, CropSettings, AppearanceSettings, RenderMode, PerformanceStats, HelperSettings } from '../types';
import { Slider } from './ui/Slider';

interface ControlsProps {
  onFileChange: (file: File) => void;
  isLoading: boolean;
  error: string | null;
  transformations: Transformations;
  setTransformations: React.Dispatch<React.SetStateAction<Transformations>>;
  crop: CropSettings;
  setCrop: React.Dispatch<React.SetStateAction<CropSettings>>;
  appearance: AppearanceSettings;
  setAppearance: React.Dispatch<React.SetStateAction<AppearanceSettings>>;
  helpers: HelperSettings;
  setHelpers: React.Dispatch<React.SetStateAction<HelperSettings>>;
  renderMode: RenderMode;
  setRenderMode: React.Dispatch<React.SetStateAction<RenderMode>>;
  splatDataAvailable: boolean;
  stats: PerformanceStats;
  dataBounds: { min: THREE.Vector3; max: THREE.Vector3 } | null;
}

const ControlSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="bg-gray-800/50 rounded-lg">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full text-left p-3 font-semibold text-gray-200 hover:bg-gray-700/50 rounded-t-lg flex justify-between items-center">
        {title}
        <svg className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>
      {isOpen && <div className="p-3 border-t border-gray-700">{children}</div>}
    </div>
  );
};

const Toggle: React.FC<{ label: string; checked: boolean; onChange: () => void; }> = ({ label, checked, onChange }) => (
    <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-300">{label}</label>
        <button onClick={onChange} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-cyan-500' : 'bg-gray-600'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}/>
        </button>
    </div>
);


export const Controls: React.FC<ControlsProps> = ({
  onFileChange,
  isLoading,
  error,
  transformations,
  setTransformations,
  crop,
  setCrop,
  appearance,
  setAppearance,
  helpers,
  setHelpers,
  renderMode,
  setRenderMode,
  splatDataAvailable,
  stats,
  dataBounds
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileChange(e.target.files[0]);
    }
  };

  return (
    <div className="w-96 h-full bg-gray-900/80 backdrop-blur-sm text-gray-200 flex flex-col p-4 shadow-2xl">
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-bold text-white mb-1">Gaussian Splat Viewer</h1>
        <div className="flex justify-between items-center bg-gray-800 p-2 rounded-md mb-4">
            <div className="text-sm">FPS: <span className="font-mono text-cyan-400">{stats.fps}</span></div>
            <div className="text-sm">Points: <span className="font-mono text-cyan-400">{(stats.pointCount / 1e6).toFixed(2)}M</span></div>
        </div>
      </div>
      
      <div className="flex-grow overflow-y-auto space-y-4 pr-2 custom-scrollbar">
        <ControlSection title="Load Model" defaultOpen={true}>
          <div className="space-y-3">
             <button
              onClick={handleFileButtonClick}
              className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md font-semibold text-white transition-colors disabled:bg-gray-500"
              disabled={isLoading}
            >
              Load from Disk
            </button>
            <input type="file" ref={fileInputRef} onChange={handleLocalFileChange} className="hidden" accept=".ply" />
            {error && <div className="text-red-400 text-sm p-2 bg-red-900/50 rounded">{error}</div>}
          </div>
        </ControlSection>

        <ControlSection title="Appearance" defaultOpen={true}>
          <div className="space-y-4">
            {renderMode === RenderMode.SPLAT && splatDataAvailable ? (
                <Slider label="Splat Scale" min={0.1} max={2} step={0.01} value={appearance.splatScale} onChange={(e) => setAppearance(s => ({ ...s, splatScale: +e.target.value }))} />
            ) : (
                <Slider label="Point Size" min={0.1} max={20} step={0.1} value={appearance.pointSize} onChange={(e) => setAppearance(s => ({ ...s, pointSize: +e.target.value }))} />
            )}
            <Slider label="Opacity" min={0} max={1} step={0.01} value={appearance.opacity} onChange={(e) => setAppearance(s => ({ ...s, opacity: +e.target.value }))} />
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1 block">Render Mode</label>
              <select 
                value={renderMode} 
                onChange={e => setRenderMode(Number(e.target.value))}
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                  <option value={0}>Original Colors</option>
                  <option value={1}>Elevation Colormap</option>
                  {splatDataAvailable && <option value={2}>Splat</option>}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1 block">Background</label>
              <input type="color" value={appearance.backgroundColor} onChange={(e) => setAppearance(s => ({ ...s, backgroundColor: e.target.value }))} className="w-full h-8 p-0 border-none rounded-md cursor-pointer" />
            </div>
          </div>
        </ControlSection>
        
        <ControlSection title="Helpers" defaultOpen={true}>
            <div className="space-y-3">
                <Toggle label="Show Axes" checked={helpers.showAxes} onChange={() => setHelpers(h => ({...h, showAxes: !h.showAxes}))} />
                <Toggle label="Show Grid" checked={helpers.showGrid} onChange={() => setHelpers(h => ({...h, showGrid: !h.showGrid}))} />
            </div>
        </ControlSection>

        <ControlSection title="Transform">
            <div className="space-y-4">
                <Slider label="Scale" min={0.1} max={5} step={0.01} value={transformations.scale} onChange={e => setTransformations(t => ({...t, scale: +e.target.value}))} />
                <Slider label="Rotate X" min={-180} max={180} step={1} unit="°" value={THREE.MathUtils.radToDeg(transformations.rotation.x)} onChange={e => setTransformations(t => ({...t, rotation: t.rotation.clone().set(THREE.MathUtils.degToRad(+e.target.value), t.rotation.y, t.rotation.z)}))} />
                <Slider label="Rotate Y" min={-180} max={180} step={1} unit="°" value={THREE.MathUtils.radToDeg(transformations.rotation.y)} onChange={e => setTransformations(t => ({...t, rotation: t.rotation.clone().set(t.rotation.x, THREE.MathUtils.degToRad(+e.target.value), t.rotation.z)}))} />
                <Slider label="Rotate Z" min={-180} max={180} step={1} unit="°" value={THREE.MathUtils.radToDeg(transformations.rotation.z)} onChange={e => setTransformations(t => ({...t, rotation: t.rotation.clone().set(t.rotation.x, t.rotation.y, THREE.MathUtils.degToRad(+e.target.value))}))} />
                <Slider label="Translate X" min={-5} max={5} step={0.01} value={transformations.position.x} onChange={e => setTransformations(t => ({...t, position: t.position.clone().setX(+e.target.value)}))} />
                <Slider label="Translate Y" min={-5} max={5} step={0.01} value={transformations.position.y} onChange={e => setTransformations(t => ({...t, position: t.position.clone().setY(+e.target.value)}))} />
                <Slider label="Translate Z" min={-5} max={5} step={0.01} value={transformations.position.z} onChange={e => setTransformations(t => ({...t, position: t.position.clone().setZ(+e.target.value)}))} />
            </div>
        </ControlSection>

        <ControlSection title="Cropping">
            <div className="space-y-4">
                <Toggle label="Enable Cropping" checked={crop.enabled} onChange={() => setCrop(c => ({...c, enabled: !c.enabled}))} />
                {dataBounds && crop.enabled && (
                    <>
                        <Slider label="X Min" min={dataBounds.min.x} max={dataBounds.max.x} step={0.01} value={crop.min.x} onChange={e => setCrop(c => ({...c, min: c.min.clone().setX(+e.target.value)}))} />
                        <Slider label="X Max" min={dataBounds.min.x} max={dataBounds.max.x} step={0.01} value={crop.max.x} onChange={e => setCrop(c => ({...c, max: c.max.clone().setX(+e.target.value)}))} />
                        <Slider label="Y Min" min={dataBounds.min.y} max={dataBounds.max.y} step={0.01} value={crop.min.y} onChange={e => setCrop(c => ({...c, min: c.min.clone().setY(+e.target.value)}))} />
                        <Slider label="Y Max" min={dataBounds.min.y} max={dataBounds.max.y} step={0.01} value={crop.max.y} onChange={e => setCrop(c => ({...c, max: c.max.clone().setY(+e.target.value)}))} />
                        <Slider label="Z Min" min={dataBounds.min.z} max={dataBounds.max.z} step={0.01} value={crop.min.z} onChange={e => setCrop(c => ({...c, min: c.min.clone().setZ(+e.target.value)}))} />
                        <Slider label="Z Max" min={dataBounds.min.z} max={dataBounds.max.z} step={0.01} value={crop.max.z} onChange={e => setCrop(c => ({...c, max: c.max.clone().setZ(+e.target.value)}))} />
                    </>
                )}
            </div>
        </ControlSection>

      </div>
    </div>
  );
};
