/**
 * Slider Component
 *
 * A styled range input for parameter controls.
 */

import React from 'react';
import './ui.css';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  disabled = false,
}: SliderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value));
  };

  // Calculate percentage for gradient fill
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={`slider-container ${disabled ? 'disabled' : ''}`}>
      <div className="slider-header">
        <label className="slider-label">{label}</label>
        <span className="slider-value">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        className="slider-input"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={handleChange}
        disabled={disabled}
        style={{
          background: `linear-gradient(to right, var(--accent-color) 0%, var(--accent-color) ${percentage}%, var(--input-bg) ${percentage}%, var(--input-bg) 100%)`,
        }}
      />
    </div>
  );
}
