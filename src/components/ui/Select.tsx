/**
 * Select Component
 *
 * A styled dropdown select.
 */

import React from 'react';
import './ui.css';

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function Select({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: SelectProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={`select-container ${disabled ? 'disabled' : ''}`}>
      <label className="select-label">{label}</label>
      <select
        className="select-input"
        value={value}
        onChange={handleChange}
        disabled={disabled}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
