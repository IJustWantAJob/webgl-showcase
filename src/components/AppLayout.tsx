/**
 * AppLayout Component
 *
 * Main layout wrapper using CSS Grid.
 */

import { useCallback, useState } from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { MainPanel } from './MainPanel';
import { usePlayground } from '../context/PlaygroundContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useURLSync } from '../hooks/useURLSync';
import { usePageVisibility } from '../hooks/usePageVisibility';
import { getDemoById } from '../gl/demoRegistry';
import './AppLayout.css';

export function AppLayout() {
  const { state } = usePlayground();
  const [_toast, setToast] = useState<string | null>(null);

  // Get current demo name
  const demo = getDemoById(state.activeDemoId);
  const demoName = demo?.name || 'Unknown Demo';

  // Handle reset
  const handleReset = useCallback(() => {
    // Find the reset button in MainPanel and trigger it
    const resetBtn = document.querySelector('[data-action="reset"]') as HTMLButtonElement & {
      _handler?: () => void;
    };
    if (resetBtn?._handler) {
      resetBtn._handler();
    }
  }, []);

  // Handle screenshot
  const handleScreenshot = useCallback(() => {
    const screenshotBtn = document.querySelector(
      '[data-action="screenshot"]'
    ) as HTMLButtonElement & { _handler?: () => void };
    if (screenshotBtn?._handler) {
      screenshotBtn._handler();
    }
  }, []);

  // Handle screenshot data
  const handleScreenshotData = useCallback((dataUrl: string) => {
    // Create download link
    const link = document.createElement('a');
    link.download = `webgl-${state.activeDemoId}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();

    setToast('Screenshot saved!');
    setTimeout(() => setToast(null), 2000);
  }, [state.activeDemoId]);

  // Custom hooks
  useKeyboardShortcuts({ onReset: handleReset });
  useURLSync();
  usePageVisibility();

  return (
    <div className={`app-layout ${state.isFullscreen ? 'fullscreen' : ''}`}>
      <TopBar
        onReset={handleReset}
        onScreenshot={handleScreenshot}
        demoName={demoName}
      />
      <div className="app-content">
        {!state.isFullscreen && <Sidebar />}
        <MainPanel
          onScreenshot={handleScreenshotData}
        />
      </div>
    </div>
  );
}
