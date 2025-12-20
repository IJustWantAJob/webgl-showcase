/**
 * Playground Context
 *
 * Global state management for the WebGL Showcase Playground.
 * Uses useReducer for predictable state updates.
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import type {
  PlaygroundState,
  PlaygroundAction,
  QualityLevel,
  DemoCategory,
} from '../gl/core/types';

// ============================================================================
// Initial State
// ============================================================================

const initialState: PlaygroundState = {
  activeDemoId: 'nebula',
  isPaused: false,
  isFullscreen: false,
  quality: 'high',
  reduceMotion: false,
  searchQuery: '',
  categoryFilter: null,
};

// ============================================================================
// Reducer
// ============================================================================

function playgroundReducer(
  state: PlaygroundState,
  action: PlaygroundAction
): PlaygroundState {
  switch (action.type) {
    case 'SET_ACTIVE_DEMO':
      return { ...state, activeDemoId: action.demoId };
    case 'TOGGLE_PAUSE':
      return { ...state, isPaused: !state.isPaused };
    case 'SET_PAUSED':
      return { ...state, isPaused: action.isPaused };
    case 'TOGGLE_FULLSCREEN':
      return { ...state, isFullscreen: !state.isFullscreen };
    case 'SET_QUALITY':
      return { ...state, quality: action.quality };
    case 'TOGGLE_REDUCE_MOTION':
      return { ...state, reduceMotion: !state.reduceMotion };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.query };
    case 'SET_CATEGORY_FILTER':
      return { ...state, categoryFilter: action.category };
    case 'RESET':
      return { ...initialState, activeDemoId: state.activeDemoId };
    default:
      return state;
  }
}

// ============================================================================
// Context Types
// ============================================================================

interface PlaygroundContextValue {
  state: PlaygroundState;
  dispatch: React.Dispatch<PlaygroundAction>;
  // Convenience actions
  setActiveDemo: (demoId: string) => void;
  togglePause: () => void;
  setPaused: (isPaused: boolean) => void;
  toggleFullscreen: () => void;
  setQuality: (quality: QualityLevel) => void;
  toggleReduceMotion: () => void;
  setSearchQuery: (query: string) => void;
  setCategoryFilter: (category: DemoCategory | null) => void;
  resetDemo: () => void;
}

// ============================================================================
// Context
// ============================================================================

const PlaygroundContext = createContext<PlaygroundContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface PlaygroundProviderProps {
  children: ReactNode;
  initialDemoId?: string;
}

export function PlaygroundProvider({
  children,
  initialDemoId,
}: PlaygroundProviderProps) {
  const [state, dispatch] = useReducer(playgroundReducer, {
    ...initialState,
    activeDemoId: initialDemoId || initialState.activeDemoId,
  });

  // Convenience action creators
  const setActiveDemo = useCallback((demoId: string) => {
    dispatch({ type: 'SET_ACTIVE_DEMO', demoId });
  }, []);

  const togglePause = useCallback(() => {
    dispatch({ type: 'TOGGLE_PAUSE' });
  }, []);

  const setPaused = useCallback((isPaused: boolean) => {
    dispatch({ type: 'SET_PAUSED', isPaused });
  }, []);

  const toggleFullscreen = useCallback(() => {
    dispatch({ type: 'TOGGLE_FULLSCREEN' });
  }, []);

  const setQuality = useCallback((quality: QualityLevel) => {
    dispatch({ type: 'SET_QUALITY', quality });
  }, []);

  const toggleReduceMotion = useCallback(() => {
    dispatch({ type: 'TOGGLE_REDUCE_MOTION' });
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', query });
  }, []);

  const setCategoryFilter = useCallback((category: DemoCategory | null) => {
    dispatch({ type: 'SET_CATEGORY_FILTER', category });
  }, []);

  const resetDemo = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // Detect prefers-reduced-motion on mount
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      dispatch({ type: 'TOGGLE_REDUCE_MOTION' });
    }
  }, []);

  const value: PlaygroundContextValue = {
    state,
    dispatch,
    setActiveDemo,
    togglePause,
    setPaused,
    toggleFullscreen,
    setQuality,
    toggleReduceMotion,
    setSearchQuery,
    setCategoryFilter,
    resetDemo,
  };

  return (
    <PlaygroundContext.Provider value={value}>
      {children}
    </PlaygroundContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function usePlayground(): PlaygroundContextValue {
  const context = useContext(PlaygroundContext);
  if (!context) {
    throw new Error('usePlayground must be used within a PlaygroundProvider');
  }
  return context;
}

// ============================================================================
// Selector Hooks (for optimized re-renders)
// ============================================================================

export function useActiveDemoId(): string {
  const { state } = usePlayground();
  return state.activeDemoId;
}

export function useIsPaused(): boolean {
  const { state } = usePlayground();
  return state.isPaused;
}

export function useQuality(): QualityLevel {
  const { state } = usePlayground();
  return state.quality;
}

export function useReduceMotionPref(): boolean {
  const { state } = usePlayground();
  return state.reduceMotion;
}

export function useSearchQuery(): string {
  const { state } = usePlayground();
  return state.searchQuery;
}

export function useCategoryFilter(): DemoCategory | null {
  const { state } = usePlayground();
  return state.categoryFilter;
}
