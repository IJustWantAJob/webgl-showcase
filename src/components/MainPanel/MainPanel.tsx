/**
 * MainPanel Component
 *
 * Wrapper for canvas, controls, and description.
 */

import { useRef, useState, useCallback } from 'react';
import { DemoCanvas, type DemoCanvasHandle } from './DemoCanvas';
import { ControlsPanel } from './ControlsPanel';
import { DemoDescription } from './DemoDescription';
import { PerformanceHUD } from '../PerformanceHUD';
import type { DemoStats } from '../../gl/core/types';
import './MainPanel.css';

interface MainPanelProps {
  onScreenshot?: (dataUrl: string) => void;
}

export function MainPanel({ onScreenshot }: MainPanelProps) {
  const canvasRef = useRef<DemoCanvasHandle>(null);
  const [stats, setStats] = useState<DemoStats | null>(null);

  const handleStatsUpdate = useCallback((newStats: DemoStats) => {
    setStats(newStats);
  }, []);

  const handleReset = useCallback(() => {
    canvasRef.current?.reset();
  }, []);

  const handleScreenshot = useCallback(() => {
    const dataUrl = canvasRef.current?.getScreenshot();
    if (dataUrl && onScreenshot) {
      onScreenshot(dataUrl);
    }
  }, [onScreenshot]);

  const handleParameterChange = useCallback(
    (key: string, value: number | boolean | string) => {
      canvasRef.current?.setParameter(key, value);
    },
    []
  );

  return (
    <div className="main-panel">
      <div className="main-panel-canvas">
        <DemoCanvas ref={canvasRef} onStatsUpdate={handleStatsUpdate} />
      </div>

      <div className="main-panel-bottom">
        <div className="main-panel-info">
          <ControlsPanel onParameterChange={handleParameterChange} />
          <DemoDescription />
        </div>
        <PerformanceHUD stats={stats} />
      </div>

      {/* Hidden buttons used by TopBar through props drilling or context */}
      <button
        ref={(el) => {
          // Store reset handler for external access
          if (el) {
            (el as HTMLButtonElement & { _handler: () => void })._handler = handleReset;
          }
        }}
        style={{ display: 'none' }}
        data-action="reset"
      />
      <button
        ref={(el) => {
          if (el) {
            (el as HTMLButtonElement & { _handler: () => void })._handler = handleScreenshot;
          }
        }}
        style={{ display: 'none' }}
        data-action="screenshot"
      />
    </div>
  );
}

// Export refs for external access
export { type DemoCanvasHandle };
