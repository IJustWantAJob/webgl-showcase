/**
 * Procedural Nebula Demo
 *
 * A full-canvas animated procedural nebula/flow field effect.
 * Features:
 * - Simplex noise-based flow field
 * - Mouse interaction (subtle displacement)
 * - Domain warping for organic flow
 * - Multiple noise layers for depth
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

// Fragment shader - procedural nebula effect
const fragmentShader = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_speed;
uniform float u_complexity;
uniform float u_mouseInfluence;
uniform bool u_grain;
uniform int u_palette;

// Simplex noise functions
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                   + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                          dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Fractional Brownian Motion
float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < octaves; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(p * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return value;
}

// Domain warping for more organic flow
vec2 warp(vec2 p, float time) {
  vec2 q = vec2(
    fbm(p + vec2(0.0, 0.0), 4),
    fbm(p + vec2(5.2, 1.3), 4)
  );

  vec2 r = vec2(
    fbm(p + 4.0 * q + vec2(1.7 + 0.1 * time, 9.2 + 0.05 * time), 4),
    fbm(p + 4.0 * q + vec2(8.3 - 0.08 * time, 2.8 + 0.12 * time), 4)
  );

  return r;
}

// Color palettes
vec3 getPaletteColor(int palette, float t) {
  if (palette == 0) {
    // Nebula - purple/blue/orange
    vec3 c1 = vec3(0.05, 0.02, 0.15);
    vec3 c2 = vec3(0.15, 0.05, 0.25);
    vec3 c3 = vec3(0.4, 0.1, 0.5);
    vec3 c4 = vec3(0.1, 0.3, 0.6);
    vec3 c5 = vec3(0.9, 0.4, 0.3);
    float t1 = smoothstep(-0.8, -0.2, t);
    float t2 = smoothstep(-0.2, 0.2, t);
    float t3 = smoothstep(0.2, 0.6, t);
    float t4 = smoothstep(0.6, 1.0, t);
    vec3 col = mix(c1, c2, t1);
    col = mix(col, c3, t2);
    col = mix(col, c4, t3);
    col = mix(col, c5, t4 * 0.5);
    return col;
  } else if (palette == 1) {
    // Ocean - deep blue/teal/cyan
    vec3 c1 = vec3(0.0, 0.02, 0.08);
    vec3 c2 = vec3(0.0, 0.05, 0.15);
    vec3 c3 = vec3(0.0, 0.15, 0.3);
    vec3 c4 = vec3(0.1, 0.4, 0.5);
    vec3 c5 = vec3(0.2, 0.8, 0.9);
    float t1 = smoothstep(-0.8, -0.2, t);
    float t2 = smoothstep(-0.2, 0.2, t);
    float t3 = smoothstep(0.2, 0.6, t);
    float t4 = smoothstep(0.6, 1.0, t);
    vec3 col = mix(c1, c2, t1);
    col = mix(col, c3, t2);
    col = mix(col, c4, t3);
    col = mix(col, c5, t4 * 0.5);
    return col;
  } else {
    // Fire - black/red/orange/yellow
    vec3 c1 = vec3(0.05, 0.01, 0.0);
    vec3 c2 = vec3(0.2, 0.02, 0.0);
    vec3 c3 = vec3(0.6, 0.1, 0.0);
    vec3 c4 = vec3(0.9, 0.4, 0.1);
    vec3 c5 = vec3(1.0, 0.9, 0.4);
    float t1 = smoothstep(-0.8, -0.2, t);
    float t2 = smoothstep(-0.2, 0.2, t);
    float t3 = smoothstep(0.2, 0.6, t);
    float t4 = smoothstep(0.6, 1.0, t);
    vec3 col = mix(c1, c2, t1);
    col = mix(col, c3, t2);
    col = mix(col, c4, t3);
    col = mix(col, c5, t4 * 0.5);
    return col;
  }
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;

  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

  // Mouse influence
  vec2 mousePos = (u_mouse - 0.5) * vec2(aspect, 1.0);
  float mouseDist = length(p - mousePos);
  float mouseInf = smoothstep(0.8, 0.0, mouseDist) * u_mouseInfluence;
  p += normalize(p - mousePos + 0.001) * mouseInf;

  // Time-based animation
  float t = u_time * 0.15 * u_speed;

  // Apply domain warping
  vec2 warpedCoord = warp(p * 1.5, t);

  // Multiple noise layers - complexity controls octaves
  int octaves = int(u_complexity);
  float n1 = fbm(p * 2.0 + warpedCoord * 2.0, octaves);
  float n2 = fbm(p * 3.0 - warpedCoord + t * 0.3, max(octaves - 1, 2));
  float n3 = fbm(p * 5.0 + vec2(t * 0.2, -t * 0.1), max(octaves - 2, 2));

  float pattern = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

  // Get color from palette
  vec3 color = getPaletteColor(u_palette, pattern);

  // Add stars
  float stars = pow(snoise(p * 50.0), 20.0) * 0.5;
  stars += pow(snoise(p * 80.0 + 100.0), 25.0) * 0.3;
  color += vec3(stars);

  // Subtle vignette
  float vignette = 1.0 - length(uv - 0.5) * 0.8;
  vignette = smoothstep(0.0, 1.0, vignette);
  color *= vignette;

  // Film grain
  if (u_grain) {
    float grain = (snoise(uv * u_resolution * 0.5 + u_time * 100.0) * 0.5 + 0.5) * 0.03;
    color += grain - 0.015;
  }

  color = clamp(color, 0.0, 1.0);

  fragColor = vec4(color, 1.0);
}
`;

class NebulaDemo implements DemoInstance {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private buffer: WebGLBuffer | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private stats: StatsTracker;
  private isPaused = false;

  // Parameters
  private speed = 1.0;
  private complexity = 5;
  private mouseInfluence = 0.15;
  private grain = true;
  private palette = 0; // 0: nebula, 1: ocean, 2: fire

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.stats = new StatsTracker(gl);
  }

  init(): void {
    const gl = this.gl;

    // Create shader program
    this.program = createProgram(gl, vertexShader, fragmentShader);

    // Get uniform locations
    this.uniforms = getUniformLocations(gl, this.program, [
      'u_time',
      'u_resolution',
      'u_mouse',
      'u_speed',
      'u_complexity',
      'u_mouseInfluence',
      'u_grain',
      'u_palette',
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
    if (this.isPaused) return;

    const gl = this.gl;

    this.stats.beginFrame();

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    // Set uniforms
    gl.uniform1f(this.uniforms.u_time, ctx.time);
    gl.uniform2f(this.uniforms.u_resolution, ctx.width, ctx.height);
    gl.uniform2f(this.uniforms.u_mouse, ctx.mouseX, ctx.mouseY);
    gl.uniform1f(this.uniforms.u_speed, ctx.reduceMotion ? 0.3 : this.speed);
    gl.uniform1f(this.uniforms.u_complexity, this.complexity);
    gl.uniform1f(this.uniforms.u_mouseInfluence, this.mouseInfluence);
    gl.uniform1i(this.uniforms.u_grain, this.grain ? 1 : 0);
    gl.uniform1i(this.uniforms.u_palette, this.palette);

    // Draw fullscreen triangle
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.stats.recordDrawCall(1);

    gl.bindVertexArray(null);

    this.stats.endFrame();
  }

  resize(_width: number, _height: number, _dpr: number): void {
    // No special handling needed - resolution passed via context
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  reset(): void {
    this.speed = 1.0;
    this.complexity = 5;
    this.mouseInfluence = 0.15;
    this.grain = true;
    this.palette = 0;
  }

  setParameter(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'speed':
        this.speed = value as number;
        break;
      case 'complexity':
        this.complexity = value as number;
        break;
      case 'mouseInfluence':
        this.mouseInfluence = value as number;
        break;
      case 'grain':
        this.grain = value as boolean;
        break;
      case 'palette':
        const paletteMap: Record<string, number> = { nebula: 0, ocean: 1, fire: 2 };
        this.palette = paletteMap[value as string] ?? 0;
        break;
    }
  }

  getParameters(): Record<string, number | boolean | string> {
    const paletteNames = ['nebula', 'ocean', 'fire'];
    return {
      speed: this.speed,
      complexity: this.complexity,
      mouseInfluence: this.mouseInfluence,
      grain: this.grain,
      palette: paletteNames[this.palette],
    };
  }

  getStats(): DemoStats {
    return this.stats.getStats();
  }
}

export const factory: DemoFactory = (gl: WebGL2RenderingContext) => new NebulaDemo(gl);
