/**
 * Reduce Motion Hook
 *
 * Detects and responds to the prefers-reduced-motion media query.
 * Users with vestibular disorders or motion sensitivity can enable
 * this system preference to reduce animations.
 */

import { useState, useEffect } from 'react';

/**
 * Hook to detect prefers-reduced-motion system preference
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (event: MediaQueryListEvent) => {
      setReduceMotion(event.matches);
    };

    // Modern browsers
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return reduceMotion;
}

/**
 * Get initial reduce motion preference
 * Call before hydration for SSR compatibility
 */
export function getInitialReduceMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
