/**
 * TopBar Component
 *
 * Global controls: Play/Pause, Reset, Screenshot, Quality, Reduce Motion
 */

import { usePlayground } from '../context/PlaygroundContext';
import { getQualityLevels } from '../gl/core/qualityPresets';
import type { QualityLevel } from '../gl/core/types';
import './TopBar.css';

interface TopBarProps {
  onReset: () => void;
  onScreenshot: () => void;
  demoName: string;
}

export function TopBar({ onReset, onScreenshot, demoName }: TopBarProps) {
  const { state, togglePause, setQuality, toggleReduceMotion } = usePlayground();
  const qualityLevels = getQualityLevels();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">WebGL Showcase</h1>
        <span className="topbar-demo-name">{demoName}</span>
      </div>

      <div className="topbar-controls">
        {/* Playback Controls */}
        <div className="topbar-group">
          <button
            className={`topbar-btn ${state.isPaused ? 'paused' : ''}`}
            onClick={togglePause}
            title={state.isPaused ? 'Play (Space)' : 'Pause (Space)'}
          >
            {state.isPaused ? (
              <PlayIcon />
            ) : (
              <PauseIcon />
            )}
          </button>
          <button
            className="topbar-btn"
            onClick={onReset}
            title="Reset (R)"
          >
            <ResetIcon />
          </button>
          <button
            className="topbar-btn"
            onClick={onScreenshot}
            title="Screenshot"
          >
            <CameraIcon />
          </button>
        </div>

        {/* Quality Selector */}
        <div className="topbar-group">
          <label className="topbar-label">Quality</label>
          <select
            className="topbar-select"
            value={state.quality}
            onChange={(e) => setQuality(e.target.value as QualityLevel)}
          >
            {qualityLevels.map((level) => (
              <option key={level} value={level}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Reduce Motion Toggle */}
        <div className="topbar-group">
          <label className="topbar-checkbox">
            <input
              type="checkbox"
              checked={state.reduceMotion}
              onChange={toggleReduceMotion}
            />
            <span>Reduce Motion</span>
          </label>
        </div>
      </div>
    </header>
  );
}

// Simple SVG icons
function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 2l10 6-10 6V2z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="3" y="2" width="4" height="12" />
      <rect x="9" y="2" width="4" height="12" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 2a6 6 0 0 0-6 6h2a4 4 0 1 1 4 4v2a6 6 0 0 0 0-12z" />
      <path d="M2 4v4h4L2 4z" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M5 3l-1 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2l-1-2H5z" />
      <circle cx="8" cy="9" r="3" fill="var(--bg-primary)" />
    </svg>
  );
}
