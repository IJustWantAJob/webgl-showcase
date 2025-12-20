/**
 * Dithering/Posterize Demo
 *
 * Stylized rendering with color quantization and dithering.
 */

import { createProgram, createVao, createBuffer, getUniformLocations } from '../../core';
import { StatsTracker } from '../../core/stats';
import type { DemoInstance, DemoContext, DemoStats, DemoFactory } from '../../core/types';

const vertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fragmentShader = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_colorLevels;
uniform int u_ditherType; // 0: none, 1: bayer, 2: blue noise approx
uniform float u_ditherStrength;

// Bayer 4x4 matrix
float bayer4x4(vec2 pos) {
  int x = int(mod(pos.x, 4.0));
  int y = int(mod(pos.y, 4.0));

  int bayer[16] = int[16](
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5
  );

  return float(bayer[y * 4 + x]) / 16.0;
}

// Simple hash for blue noise approximation
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Generate animated scene
vec3 scene(vec2 uv, float time) {
  vec3 col = vec3(0.0);

  // Gradient background
  col = mix(vec3(0.8, 0.4, 0.1), vec3(0.1, 0.3, 0.6), uv.y);
  col = mix(col, vec3(0.9, 0.7, 0.3), uv.x * 0.5);

  // Sun
  vec2 sunPos = vec2(0.7, 0.7);
  float sunDist = length(uv - sunPos);
  col = mix(col, vec3(1.0, 0.9, 0.5), smoothstep(0.15, 0.0, sunDist));

  // Hills
  float hill1 = 0.3 + sin(uv.x * 5.0) * 0.1;
  float hill2 = 0.25 + sin(uv.x * 8.0 + 2.0) * 0.08;

  if (uv.y < hill1) {
    col = mix(vec3(0.1, 0.4, 0.2), vec3(0.05, 0.2, 0.1), uv.y / hill1);
  }
  if (uv.y < hill2) {
    col = vec3(0.02, 0.15, 0.05);
  }

  // Animated clouds
  float cloud = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 cloudPos = vec2(
      mod(uv.x + time * 0.02 * (fi + 1.0), 1.5) - 0.25,
      0.6 + fi * 0.1
    );
    float d = length((uv - cloudPos) * vec2(1.0, 3.0));
    cloud += smoothstep(0.15, 0.0, d) * 0.5;
  }
  col = mix(col, vec3(1.0), cloud);

  return col;
}

// Quantize color to limited palette
vec3 quantize(vec3 col, float levels) {
  return floor(col * levels + 0.5) / levels;
}

void main() {
  vec2 uv = v_uv;
  float time = u_time;

  // Get scene color
  vec3 col = scene(uv, time);

  // Apply dithering before quantization
  float dither = 0.0;
  vec2 pixelPos = uv * u_resolution;

  if (u_ditherType == 1) {
    // Bayer dithering
    dither = (bayer4x4(pixelPos) - 0.5) * u_ditherStrength / u_colorLevels;
  } else if (u_ditherType == 2) {
    // Blue noise approximation
    dither = (hash(pixelPos + fract(time)) - 0.5) * u_ditherStrength / u_colorLevels;
  }

  col += dither;

  // Quantize colors
  col = quantize(col, u_colorLevels);

  fragColor = vec4(col, 1.0);
}
`;

class DitheringDemo implements DemoInstance {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private buffer: WebGLBuffer | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private stats: StatsTracker;
  private isPaused = false;

  private colorLevels = 8;
  private ditherType = 'bayer';
  private ditherStrength = 1.0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.stats = new StatsTracker(gl);
  }

  async init(): Promise<void> {
    const gl = this.gl;

    this.program = createProgram(gl, vertexShader, fragmentShader);
    if (!this.program) throw new Error('Failed to create dithering shader');

    this.uniforms = getUniformLocations(gl, this.program, [
      'u_time', 'u_resolution', 'u_colorLevels', 'u_ditherType', 'u_ditherStrength',
    ]);

    const positions = new Float32Array([-1, -1, 3, -1, -1, 3]);

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

    gl.viewport(0, 0, ctx.width, ctx.height);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    const ditherTypeMap: Record<string, number> = { none: 0, bayer: 1, blue: 2 };

    gl.uniform1f(this.uniforms.u_time, ctx.reduceMotion ? ctx.time * 0.3 : ctx.time);
    gl.uniform2f(this.uniforms.u_resolution, ctx.width, ctx.height);
    gl.uniform1f(this.uniforms.u_colorLevels, this.colorLevels);
    gl.uniform1i(this.uniforms.u_ditherType, ditherTypeMap[this.ditherType] ?? 1);
    gl.uniform1f(this.uniforms.u_ditherStrength, this.ditherStrength);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.stats.recordDrawCall(1);

    gl.bindVertexArray(null);
    this.stats.endFrame();
  }

  resize(): void {}
  pause(): void { this.isPaused = true; }
  resume(): void { this.isPaused = false; }

  reset(): void {
    this.colorLevels = 8;
    this.ditherType = 'bayer';
    this.ditherStrength = 1.0;
  }

  setParameter(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'colorLevels': this.colorLevels = value as number; break;
      case 'ditherType': this.ditherType = value as string; break;
      case 'ditherStrength': this.ditherStrength = value as number; break;
    }
  }

  getParameters(): Record<string, number | boolean | string> {
    return {
      colorLevels: this.colorLevels,
      ditherType: this.ditherType,
      ditherStrength: this.ditherStrength,
    };
  }

  getStats(): DemoStats { return this.stats.getStats(); }
}

export const factory: DemoFactory = (gl: WebGL2RenderingContext) => new DitheringDemo(gl);
