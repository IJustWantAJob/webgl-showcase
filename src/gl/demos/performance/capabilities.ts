/**
 * WebGL2 Capabilities Demo
 *
 * Displays WebGL2 capabilities and supported extensions.
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

// Simple grid pattern
void main() {
  vec2 uv = v_uv;

  // Dark background with subtle gradient
  vec3 col = mix(vec3(0.08, 0.1, 0.15), vec3(0.05, 0.07, 0.12), uv.y);

  // Grid lines
  vec2 grid = fract(uv * 20.0);
  float line = step(0.95, grid.x) + step(0.95, grid.y);
  col += vec3(0.05) * line;

  // Animated accent
  float pulse = sin(u_time * 2.0) * 0.5 + 0.5;
  float highlight = smoothstep(0.4, 0.6, uv.x) * smoothstep(0.6, 0.4, uv.x);
  highlight *= smoothstep(0.3, 0.5, uv.y) * smoothstep(0.7, 0.5, uv.y);
  col += vec3(0.0, 0.3, 0.5) * highlight * pulse * 0.3;

  // Border glow
  float border = smoothstep(0.0, 0.1, uv.x) * smoothstep(1.0, 0.9, uv.x);
  border *= smoothstep(0.0, 0.1, uv.y) * smoothstep(1.0, 0.9, uv.y);
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
  private capabilities: Record<string, string | number | boolean> = {};

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.stats = new StatsTracker(gl);
    this.gatherCapabilities();
  }

  private gatherCapabilities(): void {
    const gl = this.gl;

    // Basic info
    this.capabilities['Vendor'] = gl.getParameter(gl.VENDOR);
    this.capabilities['Renderer'] = gl.getParameter(gl.RENDERER);
    this.capabilities['Version'] = gl.getParameter(gl.VERSION);
    this.capabilities['GLSL Version'] = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);

    // Limits
    this.capabilities['Max Texture Size'] = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this.capabilities['Max Cube Map Size'] = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
    this.capabilities['Max Render Buffer Size'] = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
    this.capabilities['Max Viewport Dims'] = gl.getParameter(gl.MAX_VIEWPORT_DIMS).join(' x ');
    this.capabilities['Max Vertex Attribs'] = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
    this.capabilities['Max Vertex Uniforms'] = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
    this.capabilities['Max Fragment Uniforms'] = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
    this.capabilities['Max Varying Vectors'] = gl.getParameter(gl.MAX_VARYING_VECTORS);
    this.capabilities['Max Texture Units'] = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
    this.capabilities['Max Combined Textures'] = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);

    // WebGL2 specific
    this.capabilities['Max 3D Texture Size'] = gl.getParameter(gl.MAX_3D_TEXTURE_SIZE);
    this.capabilities['Max Array Texture Layers'] = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS);
    this.capabilities['Max Color Attachments'] = gl.getParameter(gl.MAX_COLOR_ATTACHMENTS);
    this.capabilities['Max Draw Buffers'] = gl.getParameter(gl.MAX_DRAW_BUFFERS);
    this.capabilities['Max Samples'] = gl.getParameter(gl.MAX_SAMPLES);
    this.capabilities['Max Uniform Buffer Bindings'] = gl.getParameter(gl.MAX_UNIFORM_BUFFER_BINDINGS);
    this.capabilities['Max Transform Feedback Buffers'] = gl.getParameter(gl.MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS);

    // Extensions
    const extensions = gl.getSupportedExtensions() || [];
    this.capabilities['Extensions Count'] = extensions.length;

    // Check important extensions
    const importantExtensions = [
      'EXT_color_buffer_float',
      'OES_texture_float_linear',
      'EXT_disjoint_timer_query_webgl2',
      'WEBGL_compressed_texture_s3tc',
      'WEBGL_compressed_texture_astc',
      'OES_draw_buffers_indexed',
      'EXT_texture_filter_anisotropic',
    ];

    for (const ext of importantExtensions) {
      this.capabilities[ext] = extensions.includes(ext) ? 'Yes' : 'No';
    }

    // Log to console for user reference
    console.log('=== WebGL2 Capabilities ===');
    for (const [key, value] of Object.entries(this.capabilities)) {
      console.log(`${key}: ${value}`);
    }
    console.log('=== All Extensions ===');
    console.log(extensions.join('\n'));
  }

  async init(): Promise<void> {
    const gl = this.gl;

    this.program = createProgram(gl, vertexShader, fragmentShader);
    if (!this.program) throw new Error('Failed to create capabilities shader');

    this.uniforms = getUniformLocations(gl, this.program, ['u_time', 'u_resolution']);

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
