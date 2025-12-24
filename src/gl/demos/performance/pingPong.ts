/**
 * Ping-Pong FBO Demo
 *
 * GPGPU simulation using double-buffered framebuffers.
 * Implements a simple reaction-diffusion system.
 */

import { createProgram, createVao, createBuffer, getUniformLocations } from '../../core';
import { StatsTracker } from '../../core/stats';
import type { DemoInstance, DemoContext, DemoStats, DemoFactory } from '../../core/types';

const quadVertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// Simulation shader (Gray-Scott reaction diffusion)
const simulationShader = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_state;
uniform vec2 u_resolution;
uniform float u_feed;
uniform float u_kill;
uniform float u_speed;
uniform bool u_isGameOfLife;

void main() {
  vec2 texel = 1.0 / u_resolution;

  if (u_isGameOfLife) {
    // Game of Life
    float self = texture(u_state, v_uv).r;

    float neighbors = 0.0;
    neighbors += texture(u_state, v_uv + vec2(-1.0, -1.0) * texel).r;
    neighbors += texture(u_state, v_uv + vec2(0.0, -1.0) * texel).r;
    neighbors += texture(u_state, v_uv + vec2(1.0, -1.0) * texel).r;
    neighbors += texture(u_state, v_uv + vec2(-1.0, 0.0) * texel).r;
    neighbors += texture(u_state, v_uv + vec2(1.0, 0.0) * texel).r;
    neighbors += texture(u_state, v_uv + vec2(-1.0, 1.0) * texel).r;
    neighbors += texture(u_state, v_uv + vec2(0.0, 1.0) * texel).r;
    neighbors += texture(u_state, v_uv + vec2(1.0, 1.0) * texel).r;

    float next = 0.0;
    if (self > 0.5) {
      // Alive - survives with 2 or 3 neighbors
      if (neighbors >= 1.5 && neighbors <= 3.5) next = 1.0;
    } else {
      // Dead - born with exactly 3 neighbors
      if (neighbors >= 2.5 && neighbors <= 3.5) next = 1.0;
    }

    fragColor = vec4(next, next, next, 1.0);
  } else {
    // Gray-Scott Reaction-Diffusion
    vec4 state = texture(u_state, v_uv);
    float a = state.r;
    float b = state.g;

    // Laplacian using 3x3 kernel
    vec4 left = texture(u_state, v_uv + vec2(-1.0, 0.0) * texel);
    vec4 right = texture(u_state, v_uv + vec2(1.0, 0.0) * texel);
    vec4 up = texture(u_state, v_uv + vec2(0.0, 1.0) * texel);
    vec4 down = texture(u_state, v_uv + vec2(0.0, -1.0) * texel);

    float laplacianA = left.r + right.r + up.r + down.r - 4.0 * a;
    float laplacianB = left.g + right.g + up.g + down.g - 4.0 * b;

    // Gray-Scott equations
    float dA = 1.0;  // Diffusion rate A
    float dB = 0.5;  // Diffusion rate B
    float feed = u_feed;
    float kill = u_kill;

    float reaction = a * b * b;
    float newA = a + (dA * laplacianA - reaction + feed * (1.0 - a)) * u_speed;
    float newB = b + (dB * laplacianB + reaction - (kill + feed) * b) * u_speed;

    fragColor = vec4(clamp(newA, 0.0, 1.0), clamp(newB, 0.0, 1.0), 0.0, 1.0);
  }
}
`;

// Render shader
const renderShader = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_state;
uniform bool u_isGameOfLife;

void main() {
  vec4 state = texture(u_state, v_uv);

  vec3 col;
  if (u_isGameOfLife) {
    // Add some color to game of life
    col = mix(vec3(0.05, 0.05, 0.15), vec3(0.2, 0.9, 0.4), state.r);
  } else {
    // Reaction-diffusion coloring
    float a = state.r;
    float b = state.g;

    vec3 col1 = vec3(0.1, 0.1, 0.3);
    vec3 col2 = vec3(0.9, 0.4, 0.2);
    vec3 col3 = vec3(0.1, 0.6, 0.9);

    col = mix(col1, col2, b);
    col = mix(col, col3, a * 0.3);
  }

  fragColor = vec4(col, 1.0);
}
`;

interface FBO {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
}

class PingPongDemo implements DemoInstance {
  private gl: WebGL2RenderingContext;
  private simProgram: WebGLProgram | null = null;
  private renderProgram: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private buffer: WebGLBuffer | null = null;
  private fbo1: FBO | null = null;
  private fbo2: FBO | null = null;
  private currentFbo = 0;
  private simUniforms: Record<string, WebGLUniformLocation | null> = {};
  private renderUniforms: Record<string, WebGLUniformLocation | null> = {};
  private stats: StatsTracker;
  private isPaused = false;

  private simWidth = 256;
  private simHeight = 256;

  private simulation = 'reaction-diffusion';
  private speed = 1.0;
  private shouldReset = false;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.stats = new StatsTracker(gl);
  }

  async init(): Promise<void> {
    const gl = this.gl;

    // Enable float texture rendering if available
    gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');

    this.simProgram = createProgram(gl, quadVertexShader, simulationShader);
    this.renderProgram = createProgram(gl, quadVertexShader, renderShader);

    if (!this.simProgram || !this.renderProgram) {
      throw new Error('Failed to create ping-pong shaders');
    }

    this.simUniforms = getUniformLocations(gl, this.simProgram, [
      'u_state', 'u_resolution', 'u_feed', 'u_kill', 'u_speed', 'u_isGameOfLife',
    ]);

    this.renderUniforms = getUniformLocations(gl, this.renderProgram, [
      'u_state', 'u_isGameOfLife',
    ]);

    const positions = new Float32Array([-1, -1, 3, -1, -1, 3]);

    this.vao = createVao(gl);
    gl.bindVertexArray(this.vao);

    this.buffer = createBuffer(gl, positions);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);

    const posLoc = gl.getAttribLocation(this.simProgram, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);

    this.initFBOs();
  }

  private createFBO(width: number, height: number, data: Uint8Array | null): FBO {
    const gl = this.gl;

    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Use RGBA8 for compatibility (works everywhere)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    const framebuffer = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return { framebuffer, texture };
  }

  private initFBOs(): void {
    const gl = this.gl;

    // Clean up existing
    if (this.fbo1) {
      gl.deleteFramebuffer(this.fbo1.framebuffer);
      gl.deleteTexture(this.fbo1.texture);
    }
    if (this.fbo2) {
      gl.deleteFramebuffer(this.fbo2.framebuffer);
      gl.deleteTexture(this.fbo2.texture);
    }

    // Initialize with random state (using Uint8 for RGBA8)
    const data = new Uint8Array(this.simWidth * this.simHeight * 4);

    if (this.simulation === 'game-of-life') {
      for (let i = 0; i < this.simWidth * this.simHeight; i++) {
        const alive = Math.random() > 0.7 ? 255 : 0;
        data[i * 4] = alive;
        data[i * 4 + 1] = alive;
        data[i * 4 + 2] = alive;
        data[i * 4 + 3] = 255;
      }
    } else {
      // Reaction-diffusion: start with A=1, B=0, with some B seeds
      for (let i = 0; i < this.simWidth * this.simHeight; i++) {
        const x = i % this.simWidth;
        const y = Math.floor(i / this.simWidth);
        const cx = this.simWidth / 2;
        const cy = this.simHeight / 2;
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

        data[i * 4] = 255;  // A = 1
        data[i * 4 + 1] = (dist < 20 || Math.random() > 0.98) ? 255 : 0;  // B
        data[i * 4 + 2] = 0;
        data[i * 4 + 3] = 255;
      }
    }

    this.fbo1 = this.createFBO(this.simWidth, this.simHeight, data);
    this.fbo2 = this.createFBO(this.simWidth, this.simHeight, null);
    this.currentFbo = 0;
  }

  destroy(): void {
    const gl = this.gl;
    if (this.simProgram) gl.deleteProgram(this.simProgram);
    if (this.renderProgram) gl.deleteProgram(this.renderProgram);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.buffer) gl.deleteBuffer(this.buffer);
    if (this.fbo1) {
      gl.deleteFramebuffer(this.fbo1.framebuffer);
      gl.deleteTexture(this.fbo1.texture);
    }
    if (this.fbo2) {
      gl.deleteFramebuffer(this.fbo2.framebuffer);
      gl.deleteTexture(this.fbo2.texture);
    }
    this.stats.destroy();
  }

  render(ctx: DemoContext): void {
    if (this.isPaused || !this.simProgram || !this.renderProgram || !this.vao) return;
    if (!this.fbo1 || !this.fbo2) return;

    if (this.shouldReset) {
      this.initFBOs();
      this.shouldReset = false;
    }

    const gl = this.gl;
    this.stats.beginFrame();

    const isGameOfLife = this.simulation === 'game-of-life';
    const iterations = isGameOfLife ? 1 : 4;

    // Simulation passes
    gl.useProgram(this.simProgram);
    gl.bindVertexArray(this.vao);

    for (let i = 0; i < iterations; i++) {
      const readFbo = this.currentFbo === 0 ? this.fbo1 : this.fbo2;
      const writeFbo = this.currentFbo === 0 ? this.fbo2 : this.fbo1;

      gl.bindFramebuffer(gl.FRAMEBUFFER, writeFbo.framebuffer);
      gl.viewport(0, 0, this.simWidth, this.simHeight);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, readFbo.texture);
      gl.uniform1i(this.simUniforms.u_state, 0);
      gl.uniform2f(this.simUniforms.u_resolution, this.simWidth, this.simHeight);
      gl.uniform1f(this.simUniforms.u_feed, 0.055);
      gl.uniform1f(this.simUniforms.u_kill, 0.062);
      gl.uniform1f(this.simUniforms.u_speed, this.speed * 0.5);
      gl.uniform1i(this.simUniforms.u_isGameOfLife, isGameOfLife ? 1 : 0);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.currentFbo = 1 - this.currentFbo;
    }

    // Render to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, ctx.width, ctx.height);

    gl.useProgram(this.renderProgram);

    const displayFbo = this.currentFbo === 0 ? this.fbo1 : this.fbo2;
    gl.bindTexture(gl.TEXTURE_2D, displayFbo.texture);
    gl.uniform1i(this.renderUniforms.u_state, 0);
    gl.uniform1i(this.renderUniforms.u_isGameOfLife, isGameOfLife ? 1 : 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.stats.recordDrawCall(iterations + 1);

    gl.bindVertexArray(null);
    this.stats.endFrame();
  }

  resize(): void {}
  pause(): void { this.isPaused = true; }
  resume(): void { this.isPaused = false; }

  reset(): void {
    this.simulation = 'reaction-diffusion';
    this.speed = 1.0;
    this.shouldReset = true;
  }

  setParameter(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'simulation':
        if (value !== this.simulation) {
          this.simulation = value as string;
          this.shouldReset = true;
        }
        break;
      case 'speed': this.speed = value as number; break;
      case 'reset':
        if (value) this.shouldReset = true;
        break;
    }
  }

  getParameters(): Record<string, number | boolean | string> {
    return { simulation: this.simulation, speed: this.speed, reset: false };
  }

  getStats(): DemoStats { return this.stats.getStats(); }
}

export const factory: DemoFactory = (gl: WebGL2RenderingContext) => new PingPongDemo(gl);
