/**
 * DemoCanvas Component
 *
 * WebGL2 canvas that renders the active demo.
 * Handles canvas resizing, DPR, and demo lifecycle.
 */

import React, {
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { usePlayground } from '../../context/PlaygroundContext';
import { loadDemo } from '../../gl/demoRegistry';
import { getResolutionMultiplier } from '../../gl/core/qualityPresets';
import type { DemoInstance, DemoContext, DemoStats } from '../../gl/core/types';

export interface DemoCanvasHandle {
  reset: () => void;
  getScreenshot: () => string | null;
  getStats: () => DemoStats | null;
  setParameter: (key: string, value: number | boolean | string) => void;
}

interface DemoCanvasProps {
  onStatsUpdate?: (stats: DemoStats) => void;
}

export const DemoCanvas = forwardRef<DemoCanvasHandle, DemoCanvasProps>(
  function DemoCanvas({ onStatsUpdate }, ref) {
    const { state } = usePlayground();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const demoRef = useRef<DemoInstance | null>(null);
    const glRef = useRef<WebGL2RenderingContext | null>(null);
    const rafRef = useRef<number>(0);
    const startTimeRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);
    const mouseRef = useRef({ x: 0.5, y: 0.5, down: false });
    const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });

    // Expose imperative methods
    useImperativeHandle(ref, () => ({
      reset: () => {
        demoRef.current?.reset();
      },
      getScreenshot: () => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        return canvas.toDataURL('image/png');
      },
      getStats: () => {
        return demoRef.current?.getStats() || null;
      },
      setParameter: (key: string, value: number | boolean | string) => {
        demoRef.current?.setParameter(key, value);
      },
    }));

    // Render loop
    const renderLoop = useCallback(() => {
      if (!demoRef.current || !glRef.current || !canvasRef.current) return;

      const now = performance.now();
      const time = (now - startTimeRef.current) / 1000;
      const deltaTime = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      // Build context
      const ctx: DemoContext = {
        gl: glRef.current,
        canvas: canvasRef.current,
        width: sizeRef.current.width,
        height: sizeRef.current.height,
        dpr: sizeRef.current.dpr,
        time,
        deltaTime: Math.min(deltaTime, 0.1), // Cap delta to avoid jumps
        mouseX: mouseRef.current.x,
        mouseY: mouseRef.current.y,
        mouseDown: mouseRef.current.down,
        quality: state.quality,
        reduceMotion: state.reduceMotion,
      };

      // Render
      if (!state.isPaused) {
        demoRef.current.render(ctx);
      }

      // Update stats
      if (onStatsUpdate) {
        onStatsUpdate(demoRef.current.getStats());
      }

      rafRef.current = requestAnimationFrame(renderLoop);
    }, [state.isPaused, state.quality, state.reduceMotion, onStatsUpdate]);

    // Handle resize
    const handleResize = useCallback(() => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      const gl = glRef.current;
      if (!container || !canvas || !gl) return;

      const rect = container.getBoundingClientRect();
      const resolutionMult = getResolutionMultiplier(state.quality);
      const dpr = Math.min(resolutionMult, window.devicePixelRatio);

      const width = Math.floor(rect.width * dpr);
      const height = Math.floor(rect.height * dpr);

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;

        sizeRef.current = { width, height, dpr };
        gl.viewport(0, 0, width, height);
        demoRef.current?.resize(width, height, dpr);
      }
    }, [state.quality]);

    // Load and initialize demo
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Get WebGL2 context
      const gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });

      if (!gl) {
        console.error('WebGL2 not supported');
        return;
      }

      glRef.current = gl;

      // Load demo
      let cancelled = false;

      async function initDemo() {
        // Clean up previous demo
        if (demoRef.current) {
          demoRef.current.destroy();
          demoRef.current = null;
        }

        const entry = await loadDemo(state.activeDemoId);
        if (cancelled || !entry || !glRef.current) return;

        try {
          const demo = entry.factory(glRef.current);
          await demo.init();
          if (cancelled) {
            demo.destroy();
            return;
          }

          demoRef.current = demo;
          startTimeRef.current = performance.now();
          lastTimeRef.current = startTimeRef.current;

          // Initial resize
          handleResize();

          // Start render loop
          rafRef.current = requestAnimationFrame(renderLoop);
        } catch (err) {
          console.error('Failed to initialize demo:', err);
        }
      }

      initDemo();

      return () => {
        cancelled = true;
        cancelAnimationFrame(rafRef.current);
        if (demoRef.current) {
          demoRef.current.destroy();
          demoRef.current = null;
        }
      };
    }, [state.activeDemoId, handleResize, renderLoop]);

    // Resize observer
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const observer = new ResizeObserver(handleResize);
      observer.observe(container);

      return () => observer.disconnect();
    }, [handleResize]);

    // Mouse events
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = (e.clientX - rect.left) / rect.width;
      mouseRef.current.y = 1 - (e.clientY - rect.top) / rect.height;
    }, []);

    const handleMouseDown = useCallback(() => {
      mouseRef.current.down = true;
    }, []);

    const handleMouseUp = useCallback(() => {
      mouseRef.current.down = false;
    }, []);

    const handleMouseLeave = useCallback(() => {
      mouseRef.current.down = false;
    }, []);

    return (
      <div ref={containerRef} className="demo-canvas-container">
        <canvas
          ref={canvasRef}
          className="demo-canvas"
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
        {state.isPaused && (
          <div className="demo-canvas-paused">
            <span>PAUSED</span>
          </div>
        )}
      </div>
    );
  }
);
