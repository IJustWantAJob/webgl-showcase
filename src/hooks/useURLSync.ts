/**
 * URL Sync Hook
 *
 * Synchronizes the active demo with the URL query parameter.
 * - Reads ?demo=xxx on mount to set initial demo
 * - Updates URL when demo changes
 */

import { useEffect, useRef } from 'react';
import { usePlayground } from '../context/PlaygroundContext';
import { getDemoById } from '../gl/demoRegistry';

export function useURLSync() {
  const { state, setActiveDemo } = usePlayground();
  const isInitialMount = useRef(true);

  // Read URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const demoId = params.get('demo');

    if (demoId) {
      // Verify demo exists
      const demo = getDemoById(demoId);
      if (demo) {
        setActiveDemo(demoId);
      }
    }
  }, [setActiveDemo]);

  // Update URL when demo changes
  useEffect(() => {
    // Skip initial mount to avoid duplicate URL update
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('demo', state.activeDemoId);

    // Use replaceState to avoid creating history entries on every demo switch
    window.history.replaceState({}, '', url.toString());
  }, [state.activeDemoId]);
}

/**
 * Get initial demo ID from URL
 * Call this before rendering PlaygroundProvider to get initial state
 */
export function getInitialDemoFromURL(): string | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const demoId = params.get('demo');

  if (demoId) {
    const demo = getDemoById(demoId);
    if (demo) {
      return demoId;
    }
  }

  return null;
}
