/**
 * PerformanceHUD Component
 *
 * Displays real-time performance statistics.
 */

import type { DemoStats } from '../gl/core/types';
import './PerformanceHUD.css';

interface PerformanceHUDProps {
  stats: DemoStats | null;
}

export function PerformanceHUD({ stats }: PerformanceHUDProps) {
  if (!stats) {
    return (
      <div className="perf-hud">
        <span className="perf-hud-item">Loading...</span>
      </div>
    );
  }

  return (
    <div className="perf-hud">
      <div className="perf-hud-item">
        <span className="perf-hud-label">FPS</span>
        <span className={`perf-hud-value ${getFpsClass(stats.fps)}`}>
          {stats.fps}
        </span>
      </div>

      <div className="perf-hud-item">
        <span className="perf-hud-label">Frame</span>
        <span className="perf-hud-value">{stats.frameTime}ms</span>
      </div>

      <div className="perf-hud-item">
        <span className="perf-hud-label">Draw Calls</span>
        <span className="perf-hud-value">{stats.drawCalls}</span>
      </div>

      <div className="perf-hud-item">
        <span className="perf-hud-label">Triangles</span>
        <span className="perf-hud-value">{formatNumber(stats.triangles)}</span>
      </div>

      {stats.instances !== undefined && stats.instances > 0 && (
        <div className="perf-hud-item">
          <span className="perf-hud-label">Instances</span>
          <span className="perf-hud-value">{formatNumber(stats.instances)}</span>
        </div>
      )}

      {stats.particles !== undefined && stats.particles > 0 && (
        <div className="perf-hud-item">
          <span className="perf-hud-label">Particles</span>
          <span className="perf-hud-value">{formatNumber(stats.particles)}</span>
        </div>
      )}

      {stats.gpuTime !== undefined && (
        <div className="perf-hud-item">
          <span className="perf-hud-label">GPU</span>
          <span className="perf-hud-value">{stats.gpuTime}ms</span>
        </div>
      )}
    </div>
  );
}

function getFpsClass(fps: number): string {
  if (fps >= 55) return 'good';
  if (fps >= 30) return 'ok';
  return 'bad';
}

function formatNumber(n: number): string {
  if (n >= 1000000) {
    return (n / 1000000).toFixed(1) + 'M';
  }
  if (n >= 1000) {
    return (n / 1000).toFixed(1) + 'K';
  }
  return n.toString();
}
