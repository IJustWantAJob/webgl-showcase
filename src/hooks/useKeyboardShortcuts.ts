/**
 * Keyboard Shortcuts Hook
 *
 * Handles global keyboard shortcuts for the playground:
 * - J: Next demo
 * - K: Previous demo
 * - Space: Toggle pause
 * - R: Reset demo
 * - F: Toggle fullscreen
 */

import { useEffect, useCallback } from 'react';
import { usePlayground } from '../context/PlaygroundContext';
import { getAllDemos } from '../gl/demoRegistry';

interface UseKeyboardShortcutsOptions {
  onReset?: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { onReset, enabled = true } = options;
  const { state, setActiveDemo, togglePause, toggleFullscreen } = usePlayground();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Get all demos for navigation
      const allDemos = getAllDemos();
      const currentIndex = allDemos.findIndex(
        (d) => d.id === state.activeDemoId
      );

      switch (event.key.toLowerCase()) {
        case 'j':
          // Next demo
          if (currentIndex < allDemos.length - 1) {
            setActiveDemo(allDemos[currentIndex + 1].id);
          } else {
            // Wrap to first
            setActiveDemo(allDemos[0].id);
          }
          event.preventDefault();
          break;

        case 'k':
          // Previous demo
          if (currentIndex > 0) {
            setActiveDemo(allDemos[currentIndex - 1].id);
          } else {
            // Wrap to last
            setActiveDemo(allDemos[allDemos.length - 1].id);
          }
          event.preventDefault();
          break;

        case ' ':
          // Toggle pause
          togglePause();
          event.preventDefault();
          break;

        case 'r':
          // Reset demo
          if (onReset) {
            onReset();
          }
          event.preventDefault();
          break;

        case 'f':
          // Toggle fullscreen
          toggleFullscreen();
          event.preventDefault();
          break;

        default:
          break;
      }
    },
    [state.activeDemoId, setActiveDemo, togglePause, toggleFullscreen, onReset]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
}
