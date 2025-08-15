
import React, { useId } from 'react';

interface SliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  unit?: string;
}

export const Slider: React.FC<SliderProps> = ({ label, min, max, step, value, onChange, unit }) => {
  const id = useId();
  return (
    <div className="flex flex-col space-y-1">
      <div className="flex justify-between items-center">
        <label htmlFor={id} className="text-sm font-medium text-gray-300">
          {label}
        </label>
        <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded">
          {value.toFixed(2)}{unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-cyan-500"
      />
    </div>
  );
};