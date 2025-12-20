/**
 * Metaballs 2D Demo
 *
 * Classic metaballs effect where circular fields blend together.
 * Features:
 * - Inverse distance field calculation
 * - Threshold-based surface extraction
 * - Multiple animated blobs
 * - Smooth color gradients
 */

import { createProgram, createVao, createBuffer, getUniformLocations } from '../../core';
import { StatsTracker } from '../../core/stats';
import type { DemoInstance, DemoContext, DemoStats, DemoFactory } from '../../core/types';

// Vertex shader - simple fullscreen triangle
const vertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// Fragment shader - metaballs effect
const fragmentShader = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform int u_blobCount;
uniform float u_threshold;
uniform float u_speed;
uniform bool u_colorful;

#define MAX_BLOBS 12

// Hash for pseudo-random blob properties
float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

// Get blob position based on index and time
vec2 getBlobPosition(int i, float time) {
  float fi = float(i);
  float angle = time * u_speed * (0.5 + hash(fi * 17.0) * 0.5);
  float radius = 0.3 + hash(fi * 23.0) * 0.15;

  // Lissajous-like motion
  float freqX = 1.0 + hash(fi * 31.0) * 2.0;
  float freqY = 1.0 + hash(fi * 47.0) * 2.0;
  float phaseX = hash(fi * 53.0) * 6.28;
  float phaseY = hash(fi * 67.0) * 6.28;

  return vec2(
    0.5 + radius * sin(angle * freqX + phaseX),
    0.5 + radius * cos(angle * freqY + phaseY)
  );
}

// Get blob radius based on index
float getBlobRadius(int i) {
  return 0.08 + hash(float(i) * 73.0) * 0.06;
}

// Get blob color
vec3 getBlobColor(int i, float time) {
  float fi = float(i);
  float hue = hash(fi * 89.0) + time * 0.05;

  // HSV to RGB
  vec3 c = vec3(hue, 0.8, 0.9);
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;

  // Correct for aspect ratio
  vec2 p = uv;
  p.x *= aspect;

  // Calculate metaball field
  float field = 0.0;
  vec3 colorSum = vec3(0.0);
  float colorWeight = 0.0;

  for (int i = 0; i < MAX_BLOBS; i++) {
    if (i >= u_blobCount) break;

    vec2 blobPos = getBlobPosition(i, u_time);
    blobPos.x *= aspect;

    float radius = getBlobRadius(i);
    float dist = length(p - blobPos);

    // Inverse distance falloff (classic metaball formula)
    float contribution = radius * radius / (dist * dist + 0.0001);
    field += contribution;

    // Accumulate color weighted by contribution
    if (u_colorful) {
      vec3 blobColor = getBlobColor(i, u_time);
      colorSum += blobColor * contribution;
      colorWeight += contribution;
    }
  }

  // Add mouse blob
  vec2 mousePos = u_mouse;
  mousePos.x *= aspect;
  float mouseDist = length(p - mousePos);
  float mouseContrib = 0.05 / (mouseDist * mouseDist + 0.0001);
  field += mouseContrib;

  // Apply threshold to create the metaball surface
  float surface = smoothstep(u_threshold - 0.2, u_threshold, field);

  // Calculate gradient for lighting effect
  vec2 e = vec2(0.01, 0.0);
  float fx = 0.0, fy = 0.0;

  // Sample for gradient (simplified - just approximate)
  for (int i = 0; i < MAX_BLOBS; i++) {
    if (i >= u_blobCount) break;
    vec2 blobPos = getBlobPosition(i, u_time);
    blobPos.x *= aspect;
    float radius = getBlobRadius(i);

    vec2 toBlob = p - blobPos;
    float dist2 = dot(toBlob, toBlob) + 0.0001;
    fx += -2.0 * radius * radius * toBlob.x / (dist2 * dist2);
    fy += -2.0 * radius * radius * toBlob.y / (dist2 * dist2);
  }

  vec3 normal = normalize(vec3(fx, fy, 0.5));
  float lighting = dot(normal, normalize(vec3(0.5, 0.5, 1.0)));
  lighting = 0.5 + 0.5 * lighting;

  // Determine color
  vec3 surfaceColor;
  if (u_colorful && colorWeight > 0.0) {
    surfaceColor = colorSum / colorWeight;
  } else {
    // Gradient based on field value
    vec3 color1 = vec3(0.1, 0.4, 0.8);
    vec3 color2 = vec3(0.9, 0.2, 0.5);
    surfaceColor = mix(color1, color2, clamp(field / u_threshold - 0.5, 0.0, 1.0));
  }

  // Apply lighting
  surfaceColor *= lighting;

  // Add rim lighting
  float rim = 1.0 - smoothstep(u_threshold, u_threshold + 0.3, field);
  surfaceColor += vec3(0.5) * rim * surface;

  // Background
  vec3 bgColor = vec3(0.02, 0.02, 0.05);

  // Final blend
  vec3 finalColor = mix(bgColor, surfaceColor, surface);

  // Add glow outside surface
  float glow = smoothstep(u_threshold - 0.5, u_threshold - 0.1, field);
  glow *= (1.0 - surface);
  finalColor += surfaceColor * glow * 0.3;

  fragColor = vec4(finalColor, 1.0);
}
`;

class MetaballsDemo implements DemoInstance {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private buffer: WebGLBuffer | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private stats: StatsTracker;
  private isPaused = false;

  // Parameters
  private blobCount = 5;
  private threshold = 1.0;
  private speed = 1;
  private colorful = true;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.stats = new StatsTracker(gl);
  }

  async init(): Promise<void> {
    const gl = this.gl;

    // Create shader program
    this.program = createProgram(gl, vertexShader, fragmentShader);
    if (!this.program) throw new Error('Failed to create metaballs shader program');

    // Get uniform locations
    this.uniforms = getUniformLocations(gl, this.program, [
      'u_time',
      'u_resolution',
      'u_mouse',
      'u_blobCount',
      'u_threshold',
      'u_speed',
      'u_colorful',
    ]);

    // Create fullscreen triangle
    const positions = new Float32Array([
      -1, -1,
       3, -1,
      -1,  3,
    ]);

    this.vao = createVao(gl);
    gl.bindVertexArray(this.vao);

    this.buffer = createBuffer(gl, positions);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);

    const positionLoc = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  destroy(): void {
    const gl = this.gl;
    if (this.program) gl.deleteProgram(this.program);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.buffer) gl.deleteBuffer(this.buffer);
    this.stats.destroy();
  }

  render(ctx: DemoContext): void {
    if (this.isPaused || !this.program || !this.vao) return;

    const gl = this.gl;
    this.stats.beginFrame();

    // Clear
    gl.viewport(0, 0, ctx.width, ctx.height);
    gl.clearColor(0.02, 0.02, 0.05, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Use program
    gl.useProgram(this.program);

    // Set uniforms
    gl.uniform1f(this.uniforms.u_time, ctx.time);
    gl.uniform2f(this.uniforms.u_resolution, ctx.width, ctx.height);
    gl.uniform2f(this.uniforms.u_mouse, ctx.mouseX, ctx.mouseY);
    gl.uniform1i(this.uniforms.u_blobCount, this.blobCount);
    gl.uniform1f(this.uniforms.u_threshold, this.threshold);
    gl.uniform1f(this.uniforms.u_speed, ctx.reduceMotion ? 0.3 : this.speed);
    gl.uniform1i(this.uniforms.u_colorful, this.colorful ? 1 : 0);

    // Draw fullscreen triangle
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.stats.recordDrawCall(1);
    gl.bindVertexArray(null);

    this.stats.endFrame();
  }

  resize(_width: number, _height: number, _dpr: number): void {
    // No special handling needed
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  reset(): void {
    this.blobCount = 5;
    this.threshold = 1.0;
    this.speed = 1;
    this.colorful = true;
  }

  setParameter(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'blobCount':
        this.blobCount = value as number;
        break;
      case 'threshold':
        this.threshold = value as number;
        break;
      case 'speed':
        this.speed = value as number;
        break;
      case 'colorful':
        this.colorful = value as boolean;
        break;
    }
  }

  getParameters(): Record<string, number | boolean | string> {
    return {
      blobCount: this.blobCount,
      threshold: this.threshold,
      speed: this.speed,
      colorful: this.colorful,
    };
  }

  getStats(): DemoStats {
    return this.stats.getStats();
  }
}

export const factory: DemoFactory = (gl: WebGL2RenderingContext) => new MetaballsDemo(gl);
