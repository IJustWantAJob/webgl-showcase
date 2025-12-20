/**
 * Performance Statistics Tracker
 *
 * Tracks FPS, frame time, draw calls, and optionally GPU time
 * using EXT_disjoint_timer_query_webgl2 extension.
 */

import type { DemoStats } from './types';

export class StatsTracker {
  private gl: WebGL2RenderingContext;
  private fps = 60;
  private frameTime = 16.67;
  private lastFrameTime = 0;
  private drawCalls = 0;
  private triangles = 0;
  private instances = 0;
  private particles = 0;

  // GPU timer query (optional)
  private timerExt: unknown = null;
  private gpuQuery: WebGLQuery | null = null;
  private gpuTime = 0;
  private queryInProgress = false;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    // Try to get timer query extension
    this.timerExt = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (this.timerExt) {
      this.gpuQuery = gl.createQuery();
    }
  }

  /** Call at the start of each frame */
  beginFrame(): void {
    this.drawCalls = 0;
    this.triangles = 0;
    this.instances = 0;
    this.particles = 0;

    // Start GPU timer if available and no query in progress
    if (this.timerExt && this.gpuQuery && !this.queryInProgress) {
      const ext = this.timerExt as { TIME_ELAPSED_EXT: number };
      this.gl.beginQuery(ext.TIME_ELAPSED_EXT, this.gpuQuery);
      this.queryInProgress = true;
    }
  }

  /** Call at the end of each frame */
  endFrame(): void {
    // Calculate FPS
    const currentTime = performance.now();
    const delta = currentTime - this.lastFrameTime;
    if (delta > 0) {
      const instantFps = 1000 / delta;
      // Exponential moving average for smooth FPS display
      this.fps = this.fps * 0.95 + instantFps * 0.05;
      this.frameTime = this.frameTime * 0.95 + delta * 0.05;
    }
    this.lastFrameTime = currentTime;

    // End GPU timer query
    if (this.timerExt && this.queryInProgress) {
      const ext = this.timerExt as { TIME_ELAPSED_EXT: number };
      this.gl.endQuery(ext.TIME_ELAPSED_EXT);
      this.queryInProgress = false;

      // Check if previous query result is available
      if (this.gpuQuery) {
        const available = this.gl.getQueryParameter(
          this.gpuQuery,
          this.gl.QUERY_RESULT_AVAILABLE
        );
        if (available) {
          // Check for disjoint (GPU was reset)
          const disjoint = this.gl.getParameter(
            (this.timerExt as { GPU_DISJOINT_EXT: number }).GPU_DISJOINT_EXT
          );
          if (!disjoint) {
            const timeElapsed = this.gl.getQueryParameter(
              this.gpuQuery,
              this.gl.QUERY_RESULT
            );
            // Convert nanoseconds to milliseconds
            this.gpuTime = this.gpuTime * 0.95 + (timeElapsed / 1000000) * 0.05;
          }
        }
      }
    }
  }

  /** Record a draw call */
  recordDrawCall(triangleCount: number, instanceCount: number = 1): void {
    this.drawCalls++;
    this.triangles += triangleCount * instanceCount;
    if (instanceCount > 1) {
      this.instances += instanceCount;
    }
  }

  /** Record particle count */
  recordParticles(count: number): void {
    this.particles = count;
  }

  /** Get current stats */
  getStats(): DemoStats {
    return {
      fps: Math.round(this.fps),
      frameTime: Math.round(this.frameTime * 100) / 100,
      drawCalls: this.drawCalls,
      triangles: this.triangles,
      instances: this.instances > 0 ? this.instances : undefined,
      particles: this.particles > 0 ? this.particles : undefined,
      gpuTime: this.timerExt ? Math.round(this.gpuTime * 100) / 100 : undefined,
    };
  }

  /** Check if GPU timer is available */
  hasGpuTimer(): boolean {
    return this.timerExt !== null;
  }

  /** Clean up resources */
  destroy(): void {
    if (this.gpuQuery) {
      this.gl.deleteQuery(this.gpuQuery);
      this.gpuQuery = null;
    }
  }
}

/**
 * Simple FPS counter without GPU timing (lighter weight)
 */
export class SimpleFpsCounter {
  private fps = 60;
  private frameTime = 16.67;
  private lastFrameTime = 0;

  update(): void {
    const currentTime = performance.now();
    const delta = currentTime - this.lastFrameTime;
    if (delta > 0) {
      const instantFps = 1000 / delta;
      this.fps = this.fps * 0.95 + instantFps * 0.05;
      this.frameTime = this.frameTime * 0.95 + delta * 0.05;
    }
    this.lastFrameTime = currentTime;
  }

  getFps(): number {
    return Math.round(this.fps);
  }

  getFrameTime(): number {
    return Math.round(this.frameTime * 100) / 100;
  }
}
