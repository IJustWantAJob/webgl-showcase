/**
 * Glitch Effects Demo
 *
 * Collection of glitch effects: chromatic aberration, scan lines, block displacement.
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
uniform float u_chromaticStrength;
uniform bool u_scanlines;
uniform bool u_blockGlitch;
uniform float u_intensity;

// Hash function
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Noise
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Generate base scene (colorful gradient with shapes)
vec3 scene(vec2 uv, float time) {
  vec3 col = vec3(0.0);

  // Animated gradient background
  col = mix(vec3(0.1, 0.0, 0.2), vec3(0.0, 0.1, 0.3), uv.y);

  // Animated circles
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 center = vec2(
      0.5 + sin(time * 0.5 + fi) * 0.3,
      0.5 + cos(time * 0.7 + fi * 1.5) * 0.3
    );
    float d = length(uv - center);
    float r = 0.1 + sin(time + fi) * 0.05;

    vec3 circleCol = vec3(
      0.5 + 0.5 * sin(fi * 1.0),
      0.5 + 0.5 * sin(fi * 1.5 + 2.0),
      0.5 + 0.5 * sin(fi * 2.0 + 4.0)
    );

    col = mix(col, circleCol, smoothstep(r, r - 0.02, d));
  }

  return col;
}

void main() {
  vec2 uv = v_uv;
  float time = u_time;

  // Random glitch timing
  float glitchTime = floor(time * 10.0);
  float glitchRandom = hash(vec2(glitchTime, 0.0));
  bool doGlitch = glitchRandom > (1.0 - u_intensity * 0.3);

  // Block glitch displacement
  vec2 blockUV = uv;
  if (u_blockGlitch && doGlitch) {
    float blockY = floor(uv.y * 20.0) / 20.0;
    float blockRandom = hash(vec2(blockY, glitchTime));
    if (blockRandom > 0.8) {
      blockUV.x += (hash(vec2(blockY, glitchTime + 1.0)) - 0.5) * 0.1 * u_intensity;
    }
  }

  // Chromatic aberration
  vec3 col;
  float aberration = u_chromaticStrength * (doGlitch ? 2.0 : 1.0);
  col.r = scene(blockUV + vec2(aberration, 0.0), time).r;
  col.g = scene(blockUV, time).g;
  col.b = scene(blockUV - vec2(aberration, 0.0), time).b;

  // Scanlines
  if (u_scanlines) {
    float scanline = sin(uv.y * u_resolution.y * 0.5) * 0.5 + 0.5;
    scanline = pow(scanline, 1.5);
    col *= 0.8 + 0.2 * scanline;

    // Horizontal sync noise
    if (doGlitch) {
      float syncNoise = noise(vec2(time * 100.0, uv.y * 10.0));
      if (syncNoise > 0.97) {
        col = vec3(1.0);
      }
    }
  }

  // Random color noise
  if (doGlitch && u_intensity > 0.5) {
    float colorNoise = hash(uv * u_resolution + time);
    if (colorNoise > 0.99) {
      col = vec3(hash(uv + time), hash(uv + time + 1.0), hash(uv + time + 2.0));
    }
  }

  // Vignette
  float vignette = 1.0 - length(uv - 0.5) * 0.5;
  col *= vignette;

  fragColor = vec4(col, 1.0);
}
`;

class GlitchDemo implements DemoInstance {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private buffer: WebGLBuffer | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private stats: StatsTracker;
  private isPaused = false;

  private chromaticStrength = 0.01;
  private scanlines = true;
  private blockGlitch = false;
  private intensity = 0.5;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.stats = new StatsTracker(gl);
  }

  async init(): Promise<void> {
    const gl = this.gl;

    this.program = createProgram(gl, vertexShader, fragmentShader);
    if (!this.program) throw new Error('Failed to create glitch shader');

    this.uniforms = getUniformLocations(gl, this.program, [
      'u_time', 'u_resolution', 'u_chromaticStrength', 'u_scanlines', 'u_blockGlitch', 'u_intensity',
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

    gl.uniform1f(this.uniforms.u_time, ctx.reduceMotion ? ctx.time * 0.3 : ctx.time);
    gl.uniform2f(this.uniforms.u_resolution, ctx.width, ctx.height);
    gl.uniform1f(this.uniforms.u_chromaticStrength, this.chromaticStrength);
    gl.uniform1i(this.uniforms.u_scanlines, this.scanlines ? 1 : 0);
    gl.uniform1i(this.uniforms.u_blockGlitch, this.blockGlitch ? 1 : 0);
    gl.uniform1f(this.uniforms.u_intensity, this.intensity);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.stats.recordDrawCall(1);

    gl.bindVertexArray(null);
    this.stats.endFrame();
  }

  resize(): void {}
  pause(): void { this.isPaused = true; }
  resume(): void { this.isPaused = false; }

  reset(): void {
    this.chromaticStrength = 0.01;
    this.scanlines = true;
    this.blockGlitch = false;
    this.intensity = 0.5;
  }

  setParameter(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'chromaticStrength': this.chromaticStrength = value as number; break;
      case 'scanlines': this.scanlines = value as boolean; break;
      case 'blockGlitch': this.blockGlitch = value as boolean; break;
      case 'intensity': this.intensity = value as number; break;
    }
  }

  getParameters(): Record<string, number | boolean | string> {
    return {
      chromaticStrength: this.chromaticStrength,
      scanlines: this.scanlines,
      blockGlitch: this.blockGlitch,
      intensity: this.intensity,
    };
  }

  getStats(): DemoStats { return this.stats.getStats(); }
}

export const factory: DemoFactory = (gl: WebGL2RenderingContext) => new GlitchDemo(gl);
