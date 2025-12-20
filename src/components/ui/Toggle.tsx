/**
 * Toggle Component
 *
 * A styled checkbox toggle switch.
 */

import React from 'react';
import './ui.css';

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
}: ToggleProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };

  return (
    <label className={`toggle-container ${disabled ? 'disabled' : ''}`}>
      <span className="toggle-label">{label}</span>
      <div className="toggle-switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
        />
        <span className="toggle-slider" />
      </div>
    </label>
  );
}
