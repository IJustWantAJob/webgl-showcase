/**
 * ControlsPanel Component
 *
 * Renders parameter controls for the active demo.
 */

import { useState, useEffect, useCallback } from 'react';
import { usePlayground } from '../../context/PlaygroundContext';
import { getDemoById } from '../../gl/demoRegistry';
import { Slider, Toggle, Select } from '../ui';
import type { ParameterDefinition } from '../../gl/core/types';

interface ControlsPanelProps {
  onParameterChange?: (key: string, value: number | boolean | string) => void;
}

export function ControlsPanel({ onParameterChange }: ControlsPanelProps) {
  const { state } = usePlayground();
  const [parameters, setParameters] = useState<Record<string, number | boolean | string>>({});

  // Get demo metadata
  const demo = getDemoById(state.activeDemoId);
  const paramDefs = demo?.parameters || [];

  // Initialize parameters from defaults when demo changes
  useEffect(() => {
    const defaults: Record<string, number | boolean | string> = {};
    paramDefs.forEach((param) => {
      defaults[param.key] = param.default;
    });
    setParameters(defaults);
  }, [state.activeDemoId, paramDefs]);

  // Handle parameter changes
  const handleChange = useCallback(
    (key: string, value: number | boolean | string) => {
      setParameters((prev) => ({ ...prev, [key]: value }));
      if (onParameterChange) {
        onParameterChange(key, value);
      }
    },
    [onParameterChange]
  );

  if (paramDefs.length === 0) {
    return (
      <div className="controls-panel empty">
        <span className="controls-empty-text">No parameters for this demo</span>
      </div>
    );
  }

  return (
    <div className="controls-panel">
      <h3 className="controls-title">Parameters</h3>
      <div className="controls-grid">
        {paramDefs.map((param) => (
          <ParameterControl
            key={param.key}
            definition={param}
            value={parameters[param.key]}
            onChange={(value) => handleChange(param.key, value)}
          />
        ))}
      </div>
    </div>
  );
}

interface ParameterControlProps {
  definition: ParameterDefinition;
  value: number | boolean | string | undefined;
  onChange: (value: number | boolean | string) => void;
}

function ParameterControl({ definition, value, onChange }: ParameterControlProps) {
  switch (definition.type) {
    case 'slider':
      return (
        <Slider
          label={definition.label}
          value={typeof value === 'number' ? value : definition.default}
          min={definition.min}
          max={definition.max}
          step={definition.step}
          onChange={onChange}
        />
      );

    case 'toggle':
      return (
        <Toggle
          label={definition.label}
          checked={typeof value === 'boolean' ? value : definition.default}
          onChange={onChange}
        />
      );

    case 'select':
      return (
        <Select
          label={definition.label}
          value={typeof value === 'string' ? value : definition.default}
          options={definition.options}
          onChange={onChange}
        />
      );

    case 'color':
      return (
        <div className="color-control">
          <label className="color-label">{definition.label}</label>
          <input
            type="color"
            className="color-input"
            value={typeof value === 'string' ? value : definition.default}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    default:
      return null;
  }
}
