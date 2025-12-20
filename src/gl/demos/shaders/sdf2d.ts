/**
 * 2D SDF Shapes Demo
 *
 * A showcase of 2D signed distance functions with various operations.
 * Features:
 * - Basic 2D SDF primitives (circle, box, star, heart)
 * - Smooth union/subtraction
 * - Domain repetition
 * - Anti-aliased rendering
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

// Fragment shader - 2D SDF shapes
const fragmentShader = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform int u_shape;
uniform bool u_repetition;
uniform float u_smoothness;
uniform bool u_animate;

const float PI = 3.14159265359;

// SDF primitives
float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdStar(vec2 p, float r, int n, float m) {
  float an = PI / float(n);
  float en = PI / m;
  vec2 acs = vec2(cos(an), sin(an));
  vec2 ecs = vec2(cos(en), sin(en));

  float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
  p = length(p) * vec2(cos(bn), abs(sin(bn)));
  p -= r * acs;
  p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
  return length(p) * sign(p.x);
}

float sdHeart(vec2 p) {
  p.x = abs(p.x);
  if (p.y + p.x > 1.0) {
    return sqrt(dot(p - vec2(0.25, 0.75), p - vec2(0.25, 0.75))) - sqrt(2.0) / 4.0;
  }
  return sqrt(min(
    dot(p - vec2(0.0, 1.0), p - vec2(0.0, 1.0)),
    dot(p - 0.5 * max(p.x + p.y, 0.0), p - 0.5 * max(p.x + p.y, 0.0))
  )) * sign(p.x - p.y);
}

// SDF operations
float opUnion(float d1, float d2) {
  return min(d1, d2);
}

float opSubtraction(float d1, float d2) {
  return max(-d1, d2);
}

float opSmoothUnion(float d1, float d2, float k) {
  float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
}

float opSmoothSubtraction(float d1, float d2, float k) {
  float h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
  return mix(d2, -d1, h) + k * h * (1.0 - h);
}

// Domain operations
vec2 opRepeat(vec2 p, vec2 s) {
  return mod(p + s * 0.5, s) - s * 0.5;
}

mat2 rotate2D(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

float getShape(vec2 p, int shape, float time) {
  // Apply animation rotation
  float rotation = u_animate ? time * 0.5 : 0.0;
  p = rotate2D(rotation) * p;

  if (shape == 0) {
    // Circle
    return sdCircle(p, 0.3);
  } else if (shape == 1) {
    // Box
    return sdBox(p, vec2(0.25));
  } else if (shape == 2) {
    // Star
    return sdStar(p, 0.35, 5, 2.5);
  } else {
    // Heart
    return sdHeart(p * 2.5) / 2.5;
  }
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;

  // Center and scale coordinates
  vec2 p = (uv - 0.5) * 2.0;
  p.x *= aspect;

  // Apply repetition if enabled
  if (u_repetition) {
    p = opRepeat(p, vec2(1.0));
  }

  // Mouse interaction - create a small circle at mouse position
  vec2 mousePos = (u_mouse - 0.5) * 2.0;
  mousePos.x *= aspect;

  // Get main shape distance
  float d = getShape(p, u_shape, u_time);

  // Add mouse-following circle with smooth union
  float mouseCircle = sdCircle(p - mousePos, 0.15);
  d = opSmoothUnion(d, mouseCircle, u_smoothness);

  // Add animated secondary shapes
  if (u_animate) {
    float t = u_time;
    vec2 orbit1 = vec2(cos(t * 1.2), sin(t * 1.2)) * 0.5;
    vec2 orbit2 = vec2(cos(t * 0.8 + PI), sin(t * 0.8 + PI)) * 0.5;

    float small1 = sdCircle(p - orbit1, 0.1);
    float small2 = sdCircle(p - orbit2, 0.1);

    d = opSmoothUnion(d, small1, u_smoothness);
    d = opSmoothUnion(d, small2, u_smoothness);
  }

  // Anti-aliased rendering
  float pixelSize = 2.0 / u_resolution.y;
  float alpha = 1.0 - smoothstep(-pixelSize, pixelSize, d);

  // Color based on distance
  vec3 insideColor = vec3(0.2, 0.5, 0.9);
  vec3 outsideColor = vec3(0.02, 0.02, 0.05);

  // Add gradient based on distance field
  float gradient = clamp(-d * 3.0, 0.0, 1.0);
  insideColor = mix(insideColor, vec3(0.9, 0.3, 0.5), gradient * 0.5);

  // Edge glow
  float edgeGlow = exp(-abs(d) * 20.0) * 0.8;
  vec3 glowColor = vec3(0.4, 0.7, 1.0);

  vec3 color = mix(outsideColor, insideColor, alpha);
  color += glowColor * edgeGlow;

  // Subtle distance field visualization in background
  float rings = sin(d * 50.0) * 0.5 + 0.5;
  color += vec3(rings * 0.03) * (1.0 - alpha);

  fragColor = vec4(color, 1.0);
}
`;

class SDF2DDemo implements DemoInstance {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private buffer: WebGLBuffer | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private stats: StatsTracker;
  private isPaused = false;

  // Parameters
  private shape = 2; // 0: circle, 1: box, 2: star, 3: heart
  private repetition = false;
  private smoothness = 0.1;
  private animate = true;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.stats = new StatsTracker(gl);
  }

  async init(): Promise<void> {
    const gl = this.gl;

    // Create shader program
    this.program = createProgram(gl, vertexShader, fragmentShader);
    if (!this.program) throw new Error('Failed to create SDF2D shader program');

    // Get uniform locations
    this.uniforms = getUniformLocations(gl, this.program, [
      'u_time',
      'u_resolution',
      'u_mouse',
      'u_shape',
      'u_repetition',
      'u_smoothness',
      'u_animate',
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
    gl.uniform1f(this.uniforms.u_time, ctx.reduceMotion ? ctx.time * 0.3 : ctx.time);
    gl.uniform2f(this.uniforms.u_resolution, ctx.width, ctx.height);
    gl.uniform2f(this.uniforms.u_mouse, ctx.mouseX, ctx.mouseY);
    gl.uniform1i(this.uniforms.u_shape, this.shape);
    gl.uniform1i(this.uniforms.u_repetition, this.repetition ? 1 : 0);
    gl.uniform1f(this.uniforms.u_smoothness, this.smoothness);
    gl.uniform1i(this.uniforms.u_animate, this.animate ? 1 : 0);

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
    this.shape = 2;
    this.repetition = false;
    this.smoothness = 0.1;
    this.animate = true;
  }

  setParameter(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'shape':
        const shapeMap: Record<string, number> = { circle: 0, box: 1, star: 2, heart: 3 };
        this.shape = shapeMap[value as string] ?? 2;
        break;
      case 'repetition':
        this.repetition = value as boolean;
        break;
      case 'smoothness':
        this.smoothness = value as number;
        break;
      case 'animate':
        this.animate = value as boolean;
        break;
    }
  }

  getParameters(): Record<string, number | boolean | string> {
    const shapeNames = ['circle', 'box', 'star', 'heart'];
    return {
      shape: shapeNames[this.shape],
      repetition: this.repetition,
      smoothness: this.smoothness,
      animate: this.animate,
    };
  }

  getStats(): DemoStats {
    return this.stats.getStats();
  }
}

export const factory: DemoFactory = (gl: WebGL2RenderingContext) => new SDF2DDemo(gl);
