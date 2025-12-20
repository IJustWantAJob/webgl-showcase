/**
 * Voronoi Patterns Demo
 *
 * Animated cellular/Voronoi noise patterns with customizable palettes.
 * Features:
 * - Cellular noise algorithm
 * - Distance-based coloring
 * - Animated cell centers
 * - Multiple color palettes
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

// Fragment shader - voronoi patterns
const fragmentShader = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_cellCount;
uniform float u_speed;
uniform float u_edgeWidth;
uniform int u_palette;

// Hash function for random cell positions
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)),
           dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

// Voronoi distance calculation
// Returns (distance to nearest, distance to second nearest, cell id)
vec3 voronoi(vec2 p) {
  vec2 n = floor(p);
  vec2 f = fract(p);

  float d1 = 8.0;  // Distance to nearest
  float d2 = 8.0;  // Distance to second nearest
  vec2 id = vec2(0.0);  // Cell id

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash2(n + g);

      // Animate cell centers
      o = 0.5 + 0.5 * sin(u_time * u_speed * 0.5 + 6.2831 * o);

      vec2 r = g + o - f;
      float d = dot(r, r);

      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = n + g;
      } else if (d < d2) {
        d2 = d;
      }
    }
  }

  return vec3(sqrt(d1), sqrt(d2), hash2(id).x);
}

// Color palettes
vec3 getPaletteColor(float t, int palette) {
  // Cosmic palette (purple/cyan/pink)
  if (palette == 0) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.3, 0.2, 0.2);
    return a + b * cos(6.28318 * (c * t + d));
  }
  // Lava palette (red/orange/yellow)
  else if (palette == 1) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 0.7, 0.4);
    vec3 d = vec3(0.0, 0.15, 0.2);
    return a + b * cos(6.28318 * (c * t + d));
  }
  // Ocean palette (blue/green/white)
  else if (palette == 2) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 0.5);
    vec3 d = vec3(0.8, 0.9, 0.3);
    return a + b * cos(6.28318 * (c * t + d));
  }
  // Neon palette (bright colors)
  else {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(2.0, 1.0, 0.0);
    vec3 d = vec3(0.5, 0.2, 0.25);
    return a + b * cos(6.28318 * (c * t + d));
  }
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  uv.x *= aspect;

  // Scale by cell count
  vec2 p = uv * u_cellCount;

  // Add subtle mouse influence
  vec2 mouse = u_mouse;
  mouse.x *= aspect;
  p += (mouse - uv) * 0.5;

  // Get voronoi distances
  vec3 vor = voronoi(p);
  float d1 = vor.x;
  float d2 = vor.y;
  float cellId = vor.z;

  // Edge detection based on distance difference
  float edge = d2 - d1;
  float edgeFactor = smoothstep(u_edgeWidth, u_edgeWidth * 2.0, edge);

  // Get color based on cell id and time
  float colorOffset = cellId + u_time * u_speed * 0.1;
  vec3 cellColor = getPaletteColor(colorOffset, u_palette);

  // Apply distance-based shading
  float shade = 1.0 - d1 * 0.5;
  cellColor *= shade;

  // Mix with edge color
  vec3 edgeColor = vec3(0.02);
  vec3 finalColor = mix(edgeColor, cellColor, edgeFactor);

  // Add subtle glow based on distance
  float glow = exp(-d1 * 3.0) * 0.3;
  finalColor += cellColor * glow;

  fragColor = vec4(finalColor, 1.0);
}
`;

class VoronoiDemo implements DemoInstance {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private buffer: WebGLBuffer | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private stats: StatsTracker;
  private isPaused = false;

  // Parameters
  private cellCount = 8;
  private speed = 1;
  private edgeWidth = 0.05;
  private palette = 0; // 0: cosmic, 1: lava, 2: ocean, 3: neon

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.stats = new StatsTracker(gl);
  }

  async init(): Promise<void> {
    const gl = this.gl;

    // Create shader program
    this.program = createProgram(gl, vertexShader, fragmentShader);
    if (!this.program) throw new Error('Failed to create voronoi shader program');

    // Get uniform locations
    this.uniforms = getUniformLocations(gl, this.program, [
      'u_time',
      'u_resolution',
      'u_mouse',
      'u_cellCount',
      'u_speed',
      'u_edgeWidth',
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
    gl.uniform1f(this.uniforms.u_cellCount, this.cellCount);
    gl.uniform1f(this.uniforms.u_speed, ctx.reduceMotion ? 0.3 : this.speed);
    gl.uniform1f(this.uniforms.u_edgeWidth, this.edgeWidth);
    gl.uniform1i(this.uniforms.u_palette, this.palette);

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
    this.cellCount = 8;
    this.speed = 1;
    this.edgeWidth = 0.05;
    this.palette = 0;
  }

  setParameter(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'cellCount':
        this.cellCount = value as number;
        break;
      case 'speed':
        this.speed = value as number;
        break;
      case 'edgeWidth':
        this.edgeWidth = value as number;
        break;
      case 'palette':
        const paletteMap: Record<string, number> = { cosmic: 0, lava: 1, ocean: 2, neon: 3 };
        this.palette = paletteMap[value as string] ?? 0;
        break;
    }
  }

  getParameters(): Record<string, number | boolean | string> {
    const paletteNames = ['cosmic', 'lava', 'ocean', 'neon'];
    return {
      cellCount: this.cellCount,
      speed: this.speed,
      edgeWidth: this.edgeWidth,
      palette: paletteNames[this.palette],
    };
  }

  getStats(): DemoStats {
    return this.stats.getStats();
  }
}

export const factory: DemoFactory = (gl: WebGL2RenderingContext) => new VoronoiDemo(gl);
