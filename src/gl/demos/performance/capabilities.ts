/**
 * WebGL2 Capabilities Demo
 *
 * Displays WebGL2 capabilities and supported extensions on screen.
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

// Display capabilities as visual bars
uniform float u_maxTextureSize;
uniform float u_maxViewportDim;
uniform float u_maxVertexAttribs;
uniform float u_maxTextureUnits;
uniform float u_maxDrawBuffers;
uniform float u_extensionCount;

float drawBar(vec2 uv, float row, float value, float maxVal) {
  float rowHeight = 0.08;
  float rowY = 0.85 - row * (rowHeight + 0.02);

  if (uv.y > rowY - rowHeight && uv.y < rowY) {
    float barWidth = 0.6;
    float barStart = 0.35;

    if (uv.x > barStart && uv.x < barStart + barWidth) {
      float fill = (uv.x - barStart) / barWidth;
      float normalized = value / maxVal;

      if (fill < normalized) {
        return 1.0;
      }
    }
  }
  return 0.0;
}

float drawLabel(vec2 uv, float row) {
  float rowHeight = 0.08;
  float rowY = 0.85 - row * (rowHeight + 0.02);

  if (uv.y > rowY - rowHeight && uv.y < rowY && uv.x < 0.33) {
    return 0.3;
  }
  return 0.0;
}

void main() {
  vec2 uv = v_uv;

  // Dark background with grid
  vec3 col = vec3(0.05, 0.07, 0.12);

  // Subtle grid
  vec2 grid = fract(uv * 30.0);
  float gridLine = step(0.96, grid.x) + step(0.96, grid.y);
  col += vec3(0.02) * gridLine;

  // Title area glow
  if (uv.y > 0.88) {
    col = mix(col, vec3(0.0, 0.3, 0.5), 0.3);
  }

  // Draw capability bars
  vec3 barColor = vec3(0.2, 0.7, 0.9);
  vec3 labelColor = vec3(0.4, 0.4, 0.5);

  // Row 0: Max Texture Size
  col += barColor * drawBar(uv, 0.0, u_maxTextureSize, 16384.0);
  col += labelColor * drawLabel(uv, 0.0);

  // Row 1: Max Viewport
  col += barColor * drawBar(uv, 1.0, u_maxViewportDim, 16384.0);
  col += labelColor * drawLabel(uv, 1.0);

  // Row 2: Vertex Attribs
  col += vec3(0.9, 0.5, 0.2) * drawBar(uv, 2.0, u_maxVertexAttribs, 32.0);
  col += labelColor * drawLabel(uv, 2.0);

  // Row 3: Texture Units
  col += vec3(0.9, 0.5, 0.2) * drawBar(uv, 3.0, u_maxTextureUnits, 32.0);
  col += labelColor * drawLabel(uv, 3.0);

  // Row 4: Draw Buffers
  col += vec3(0.5, 0.9, 0.3) * drawBar(uv, 4.0, u_maxDrawBuffers, 16.0);
  col += labelColor * drawLabel(uv, 4.0);

  // Row 5: Extensions
  col += vec3(0.5, 0.9, 0.3) * drawBar(uv, 5.0, u_extensionCount, 50.0);
  col += labelColor * drawLabel(uv, 5.0);

  // Animated scan line
  float scanY = fract(u_time * 0.2);
  float scan = smoothstep(0.0, 0.01, abs(uv.y - scanY)) * 0.95 + 0.05;
  col *= scan + 0.3;

  // Border glow
  float border = smoothstep(0.0, 0.05, uv.x) * smoothstep(1.0, 0.95, uv.x);
  border *= smoothstep(0.0, 0.05, uv.y) * smoothstep(1.0, 0.95, uv.y);
  col = mix(vec3(0.0, 0.5, 0.8) * 0.3, col, border);

  fragColor = vec4(col, 1.0);
}
`;

class CapabilitiesDemo implements DemoInstance {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private buffer: WebGLBuffer | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private stats: StatsTracker;
  private isPaused = false;

  private maxTextureSize = 0;
  private maxViewportDim = 0;
  private maxVertexAttribs = 0;
  private maxTextureUnits = 0;
  private maxDrawBuffers = 0;
  private extensionCount = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.stats = new StatsTracker(gl);
    this.gatherCapabilities();
  }

  private gatherCapabilities(): void {
    const gl = this.gl;

    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const viewportDims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
    this.maxViewportDim = Math.max(viewportDims[0], viewportDims[1]);
    this.maxVertexAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
    this.maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
    this.maxDrawBuffers = gl.getParameter(gl.MAX_DRAW_BUFFERS);

    const extensions = gl.getSupportedExtensions() || [];
    this.extensionCount = extensions.length;

    // Log detailed info to console
    console.log('=== WebGL2 Capabilities ===');
    console.log(`Vendor: ${gl.getParameter(gl.VENDOR)}`);
    console.log(`Renderer: ${gl.getParameter(gl.RENDERER)}`);
    console.log(`Version: ${gl.getParameter(gl.VERSION)}`);
    console.log(`GLSL: ${gl.getParameter(gl.SHADING_LANGUAGE_VERSION)}`);
    console.log(`Max Texture Size: ${this.maxTextureSize}`);
    console.log(`Max Viewport: ${viewportDims[0]} x ${viewportDims[1]}`);
    console.log(`Max Vertex Attribs: ${this.maxVertexAttribs}`);
    console.log(`Max Texture Units: ${this.maxTextureUnits}`);
    console.log(`Max Draw Buffers: ${this.maxDrawBuffers}`);
    console.log(`Max 3D Texture Size: ${gl.getParameter(gl.MAX_3D_TEXTURE_SIZE)}`);
    console.log(`Max Array Layers: ${gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS)}`);
    console.log(`Extensions (${this.extensionCount}):`, extensions);
  }

  async init(): Promise<void> {
    const gl = this.gl;

    this.program = createProgram(gl, vertexShader, fragmentShader);
    if (!this.program) throw new Error('Failed to create capabilities shader');

    this.uniforms = getUniformLocations(gl, this.program, [
      'u_time', 'u_resolution',
      'u_maxTextureSize', 'u_maxViewportDim', 'u_maxVertexAttribs',
      'u_maxTextureUnits', 'u_maxDrawBuffers', 'u_extensionCount',
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

    gl.uniform1f(this.uniforms.u_time, ctx.time);
    gl.uniform2f(this.uniforms.u_resolution, ctx.width, ctx.height);
    gl.uniform1f(this.uniforms.u_maxTextureSize, this.maxTextureSize);
    gl.uniform1f(this.uniforms.u_maxViewportDim, this.maxViewportDim);
    gl.uniform1f(this.uniforms.u_maxVertexAttribs, this.maxVertexAttribs);
    gl.uniform1f(this.uniforms.u_maxTextureUnits, this.maxTextureUnits);
    gl.uniform1f(this.uniforms.u_maxDrawBuffers, this.maxDrawBuffers);
    gl.uniform1f(this.uniforms.u_extensionCount, this.extensionCount);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.stats.recordDrawCall(1);

    gl.bindVertexArray(null);
    this.stats.endFrame();
  }

  resize(): void {}
  pause(): void { this.isPaused = true; }
  resume(): void { this.isPaused = false; }
  reset(): void {}

  setParameter(_key: string, _value: number | boolean | string): void {}

  getParameters(): Record<string, number | boolean | string> {
    return {};
  }

  getStats(): DemoStats { return this.stats.getStats(); }
}

export const factory: DemoFactory = (gl: WebGL2RenderingContext) => new CapabilitiesDemo(gl);
