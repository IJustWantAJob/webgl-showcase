/**
 * Color Grading Demo
 *
 * Film-style color grading with curves, saturation, and vignette.
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
uniform float u_saturation;
uniform float u_contrast;
uniform float u_brightness;
uniform float u_vignette;

// Hash for noise
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

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

// Apply saturation
vec3 applySaturation(vec3 col, float sat) {
  float gray = dot(col, vec3(0.299, 0.587, 0.114));
  return mix(vec3(gray), col, sat);
}

// Apply contrast
vec3 applyContrast(vec3 col, float contrast) {
  return (col - 0.5) * contrast + 0.5;
}

void main() {
  vec2 uv = v_uv;
  float time = u_time;

  vec3 col = vec3(0.0);

  // Sky gradient
  vec3 skyTop = vec3(0.2, 0.4, 0.8);
  vec3 skyBottom = vec3(0.8, 0.6, 0.4);
  col = mix(skyBottom, skyTop, uv.y);

  // Sun with glow
  vec2 sunPos = vec2(0.5 + sin(time * 0.2) * 0.2, 0.7);
  float sunDist = length(uv - sunPos);
  vec3 sunColor = vec3(1.0, 0.8, 0.4);
  col += sunColor * exp(-sunDist * 5.0) * 0.5;
  col = mix(col, sunColor, smoothstep(0.08, 0.05, sunDist));

  // Mountains
  float mountain1 = 0.35 + sin(uv.x * 3.0 + 1.0) * 0.15 + sin(uv.x * 7.0) * 0.05;
  float mountain2 = 0.25 + sin(uv.x * 4.0 + 2.0) * 0.1 + sin(uv.x * 9.0) * 0.03;

  if (uv.y < mountain1) {
    col = mix(vec3(0.3, 0.25, 0.35), vec3(0.15, 0.1, 0.2), (mountain1 - uv.y) / 0.2);
  }
  if (uv.y < mountain2) {
    col = vec3(0.1, 0.08, 0.15);
  }

  // Water with simple reflection
  if (uv.y < 0.2) {
    float waterY = 0.2 - uv.y;

    // Simple water color with distortion
    float wave = sin(uv.x * 50.0 + time * 2.0) * 0.01;
    vec3 waterBase = vec3(0.05, 0.1, 0.2);

    // Fake reflection - just sample sky color at mirrored position
    float reflectY = 0.2 + waterY + wave;
    vec3 skyReflect = mix(skyBottom, skyTop, reflectY);

    col = mix(waterBase, skyReflect * 0.4, 0.6);

    // Water sparkles
    float sparkle = noise(uv * 200.0 + time * 5.0);
    if (sparkle > 0.97) {
      col += vec3(0.5);
    }
  }

  // Apply brightness
  col += u_brightness;

  // Apply contrast
  col = applyContrast(col, u_contrast);

  // Apply saturation
  col = applySaturation(col, u_saturation);

  // Apply vignette
  float dist = length(uv - 0.5);
  float vig = 1.0 - dist * dist * u_vignette * 2.0;
  col *= vig;

  // Clamp and gamma correct
  col = clamp(col, 0.0, 1.0);
  col = pow(col, vec3(1.0 / 2.2));

  fragColor = vec4(col, 1.0);
}
`;

class ColorGradingDemo implements DemoInstance {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private buffer: WebGLBuffer | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private stats: StatsTracker;
  private isPaused = false;

  private saturation = 1.0;
  private contrast = 1.0;
  private brightness = 0.0;
  private vignette = 0.3;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.stats = new StatsTracker(gl);
  }

  async init(): Promise<void> {
    const gl = this.gl;

    this.program = createProgram(gl, vertexShader, fragmentShader);
    if (!this.program) throw new Error('Failed to create color grading shader');

    this.uniforms = getUniformLocations(gl, this.program, [
      'u_time', 'u_resolution', 'u_saturation', 'u_contrast', 'u_brightness', 'u_vignette',
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
    gl.uniform1f(this.uniforms.u_saturation, this.saturation);
    gl.uniform1f(this.uniforms.u_contrast, this.contrast);
    gl.uniform1f(this.uniforms.u_brightness, this.brightness);
    gl.uniform1f(this.uniforms.u_vignette, this.vignette);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.stats.recordDrawCall(1);

    gl.bindVertexArray(null);
    this.stats.endFrame();
  }

  resize(): void {}
  pause(): void { this.isPaused = true; }
  resume(): void { this.isPaused = false; }

  reset(): void {
    this.saturation = 1.0;
    this.contrast = 1.0;
    this.brightness = 0.0;
    this.vignette = 0.3;
  }

  setParameter(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'saturation': this.saturation = value as number; break;
      case 'contrast': this.contrast = value as number; break;
      case 'brightness': this.brightness = value as number; break;
      case 'vignette': this.vignette = value as number; break;
    }
  }

  getParameters(): Record<string, number | boolean | string> {
    return {
      saturation: this.saturation,
      contrast: this.contrast,
      brightness: this.brightness,
      vignette: this.vignette,
    };
  }

  getStats(): DemoStats { return this.stats.getStats(); }
}

export const factory: DemoFactory = (gl: WebGL2RenderingContext) => new ColorGradingDemo(gl);
