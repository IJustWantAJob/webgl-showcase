/**
 * Page Visibility Hook
 *
 * Pauses the demo when the page/tab is hidden and resumes when visible.
 * This saves resources when the user switches tabs.
 */

import { useEffect, useRef } from 'react';
import { usePlayground } from '../context/PlaygroundContext';

export function usePageVisibility() {
  const { state, setPaused } = usePlayground();
  const wasManuallyPaused = useRef(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab became hidden - remember if we were already paused
        wasManuallyPaused.current = state.isPaused;
        if (!state.isPaused) {
          setPaused(true);
        }
      } else {
        // Tab became visible - only resume if we weren't manually paused
        if (!wasManuallyPaused.current) {
          setPaused(false);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.isPaused, setPaused]);
}

/**
 * Simple visibility check hook
 */
export function useIsPageVisible(): boolean {
  return !document.hidden;
}
