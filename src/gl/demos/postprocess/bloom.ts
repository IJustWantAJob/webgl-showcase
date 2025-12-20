/**
 * Bloom Effect Demo
 *
 * A multi-pass bloom effect that extracts bright areas and applies gaussian blur.
 * Features:
 * - Bright-pass threshold extraction
 * - Separable gaussian blur (2 passes)
 * - Additive blending with original
 * - Render-to-texture pipeline
 */

import { createProgram, createVao, createBuffer, getUniformLocations } from '../../core';
import { StatsTracker } from '../../core/stats';
import type { DemoInstance, DemoContext, DemoStats, DemoFactory } from '../../core/types';

// Vertex shader - fullscreen quad
const quadVertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// Fragment shader - scene with emissive elements
const sceneFragmentShader = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform float u_time;
uniform vec2 u_resolution;

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

  vec3 color = vec3(0.02, 0.02, 0.05);

  // Create some glowing orbs
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float angle = u_time * (0.3 + fi * 0.1) + fi * 1.257;
    float radius = 0.2 + fi * 0.08;
    vec2 orbPos = vec2(cos(angle), sin(angle)) * radius;

    float dist = length(p - orbPos);
    float glow = 0.02 / (dist * dist + 0.01);

    // Color varies by orb
    vec3 orbColor;
    if (i == 0) orbColor = vec3(1.0, 0.3, 0.1);
    else if (i == 1) orbColor = vec3(0.1, 0.5, 1.0);
    else if (i == 2) orbColor = vec3(0.3, 1.0, 0.5);
    else if (i == 3) orbColor = vec3(1.0, 0.8, 0.2);
    else orbColor = vec3(0.8, 0.2, 1.0);

    color += orbColor * glow;
  }

  // Central pulsing sphere
  float centerDist = length(p);
  float pulse = sin(u_time * 2.0) * 0.5 + 0.5;
  float centerGlow = (0.05 + pulse * 0.03) / (centerDist * centerDist + 0.02);
  color += vec3(0.5, 0.7, 1.0) * centerGlow;

  // Background gradient
  color += vec3(0.05, 0.02, 0.1) * (1.0 - length(p) * 0.5);

  fragColor = vec4(color, 1.0);
}
`;

// Fragment shader - bright pass extraction
const brightPassShader = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_texture;
uniform float u_threshold;

void main() {
  vec4 color = texture(u_texture, v_uv);

  // Calculate luminance
  float luminance = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));

  // Extract bright areas
  float brightness = max(luminance - u_threshold, 0.0);
  vec3 bright = color.rgb * (brightness / (luminance + 0.0001));

  fragColor = vec4(bright, 1.0);
}
`;

// Fragment shader - gaussian blur
const blurFragmentShader = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_texture;
uniform vec2 u_direction;
uniform vec2 u_resolution;
uniform float u_radius;

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec3 result = vec3(0.0);

  // 9-tap gaussian blur
  float weights[5];
  weights[0] = 0.227027;
  weights[1] = 0.1945946;
  weights[2] = 0.1216216;
  weights[3] = 0.054054;
  weights[4] = 0.016216;

  result += texture(u_texture, v_uv).rgb * weights[0];

  for (int i = 1; i < 5; i++) {
    vec2 offset = u_direction * texelSize * float(i) * u_radius;
    result += texture(u_texture, v_uv + offset).rgb * weights[i];
    result += texture(u_texture, v_uv - offset).rgb * weights[i];
  }

  fragColor = vec4(result, 1.0);
}
`;

// Fragment shader - combine
const combineFragmentShader = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform float u_intensity;

void main() {
  vec3 scene = texture(u_scene, v_uv).rgb;
  vec3 bloom = texture(u_bloom, v_uv).rgb;

  // Additive blending
  vec3 color = scene + bloom * u_intensity;

  // Tone mapping (simple Reinhard)
  color = color / (color + vec3(1.0));

  // Gamma correction
  color = pow(color, vec3(1.0 / 2.2));

  fragColor = vec4(color, 1.0);
}
`;

interface Framebuffer {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

function createFramebuffer(gl: WebGL2RenderingContext, width: number, height: number): Framebuffer {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const framebuffer = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return { framebuffer, texture, width, height };
}

class BloomDemo implements DemoInstance {
  private gl: WebGL2RenderingContext;
  private sceneProgram: WebGLProgram | null = null;
  private brightPassProgram: WebGLProgram | null = null;
  private blurProgram: WebGLProgram | null = null;
  private combineProgram: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private buffer: WebGLBuffer | null = null;

  private sceneUniforms: Record<string, WebGLUniformLocation | null> = {};
  private brightPassUniforms: Record<string, WebGLUniformLocation | null> = {};
  private blurUniforms: Record<string, WebGLUniformLocation | null> = {};
  private combineUniforms: Record<string, WebGLUniformLocation | null> = {};

  private sceneFbo: Framebuffer | null = null;
  private brightFbo: Framebuffer | null = null;
  private blurFbo1: Framebuffer | null = null;
  private blurFbo2: Framebuffer | null = null;

  private stats: StatsTracker;
  private isPaused = false;
  private currentSize = { width: 0, height: 0 };

  // Parameters
  private threshold = 0.5;
  private intensity = 1.0;
  private radius = 4;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.stats = new StatsTracker(gl);
  }

  async init(): Promise<void> {
    const gl = this.gl;

    // Enable float textures
    gl.getExtension('EXT_color_buffer_float');

    // Create shader programs
    this.sceneProgram = createProgram(gl, quadVertexShader, sceneFragmentShader);
    this.brightPassProgram = createProgram(gl, quadVertexShader, brightPassShader);
    this.blurProgram = createProgram(gl, quadVertexShader, blurFragmentShader);
    this.combineProgram = createProgram(gl, quadVertexShader, combineFragmentShader);

    if (!this.sceneProgram || !this.brightPassProgram || !this.blurProgram || !this.combineProgram) {
      throw new Error('Failed to create bloom shader programs');
    }

    // Get uniform locations
    this.sceneUniforms = getUniformLocations(gl, this.sceneProgram, ['u_time', 'u_resolution']);
    this.brightPassUniforms = getUniformLocations(gl, this.brightPassProgram, ['u_texture', 'u_threshold']);
    this.blurUniforms = getUniformLocations(gl, this.blurProgram, ['u_texture', 'u_direction', 'u_resolution', 'u_radius']);
    this.combineUniforms = getUniformLocations(gl, this.combineProgram, ['u_scene', 'u_bloom', 'u_intensity']);

    // Create fullscreen quad VAO
    const positions = new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1,  1,  1, -1,   1, 1,
    ]);

    this.vao = createVao(gl);
    gl.bindVertexArray(this.vao);

    this.buffer = createBuffer(gl, positions);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);

    const positionLoc = gl.getAttribLocation(this.sceneProgram, 'a_position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  private setupFramebuffers(width: number, height: number): void {
    const gl = this.gl;

    // Cleanup old framebuffers
    if (this.sceneFbo) {
      gl.deleteFramebuffer(this.sceneFbo.framebuffer);
      gl.deleteTexture(this.sceneFbo.texture);
    }
    if (this.brightFbo) {
      gl.deleteFramebuffer(this.brightFbo.framebuffer);
      gl.deleteTexture(this.brightFbo.texture);
    }
    if (this.blurFbo1) {
      gl.deleteFramebuffer(this.blurFbo1.framebuffer);
      gl.deleteTexture(this.blurFbo1.texture);
    }
    if (this.blurFbo2) {
      gl.deleteFramebuffer(this.blurFbo2.framebuffer);
      gl.deleteTexture(this.blurFbo2.texture);
    }

    // Create new framebuffers (blur at half resolution for performance)
    this.sceneFbo = createFramebuffer(gl, width, height);
    this.brightFbo = createFramebuffer(gl, width / 2, height / 2);
    this.blurFbo1 = createFramebuffer(gl, width / 2, height / 2);
    this.blurFbo2 = createFramebuffer(gl, width / 2, height / 2);

    this.currentSize = { width, height };
  }

  destroy(): void {
    const gl = this.gl;
    if (this.sceneProgram) gl.deleteProgram(this.sceneProgram);
    if (this.brightPassProgram) gl.deleteProgram(this.brightPassProgram);
    if (this.blurProgram) gl.deleteProgram(this.blurProgram);
    if (this.combineProgram) gl.deleteProgram(this.combineProgram);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.buffer) gl.deleteBuffer(this.buffer);
    if (this.sceneFbo) {
      gl.deleteFramebuffer(this.sceneFbo.framebuffer);
      gl.deleteTexture(this.sceneFbo.texture);
    }
    if (this.brightFbo) {
      gl.deleteFramebuffer(this.brightFbo.framebuffer);
      gl.deleteTexture(this.brightFbo.texture);
    }
    if (this.blurFbo1) {
      gl.deleteFramebuffer(this.blurFbo1.framebuffer);
      gl.deleteTexture(this.blurFbo1.texture);
    }
    if (this.blurFbo2) {
      gl.deleteFramebuffer(this.blurFbo2.framebuffer);
      gl.deleteTexture(this.blurFbo2.texture);
    }
    this.stats.destroy();
  }

  render(ctx: DemoContext): void {
    if (this.isPaused) return;

    const gl = this.gl;
    this.stats.beginFrame();

    // Setup framebuffers if needed
    if (this.currentSize.width !== ctx.width || this.currentSize.height !== ctx.height) {
      this.setupFramebuffers(ctx.width, ctx.height);
    }

    if (!this.sceneFbo || !this.brightFbo || !this.blurFbo1 || !this.blurFbo2) return;

    const time = ctx.reduceMotion ? ctx.time * 0.3 : ctx.time;

    gl.bindVertexArray(this.vao);

    // Pass 1: Render scene to FBO
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFbo.framebuffer);
    gl.viewport(0, 0, this.sceneFbo.width, this.sceneFbo.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.sceneProgram);
    gl.uniform1f(this.sceneUniforms.u_time, time);
    gl.uniform2f(this.sceneUniforms.u_resolution, this.sceneFbo.width, this.sceneFbo.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Pass 2: Bright pass extraction
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.brightFbo.framebuffer);
    gl.viewport(0, 0, this.brightFbo.width, this.brightFbo.height);

    gl.useProgram(this.brightPassProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneFbo.texture);
    gl.uniform1i(this.brightPassUniforms.u_texture, 0);
    gl.uniform1f(this.brightPassUniforms.u_threshold, this.threshold);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Pass 3: Horizontal blur
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFbo1.framebuffer);
    gl.viewport(0, 0, this.blurFbo1.width, this.blurFbo1.height);

    gl.useProgram(this.blurProgram);
    gl.bindTexture(gl.TEXTURE_2D, this.brightFbo.texture);
    gl.uniform1i(this.blurUniforms.u_texture, 0);
    gl.uniform2f(this.blurUniforms.u_direction, 1.0, 0.0);
    gl.uniform2f(this.blurUniforms.u_resolution, this.blurFbo1.width, this.blurFbo1.height);
    gl.uniform1f(this.blurUniforms.u_radius, this.radius);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Pass 4: Vertical blur
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFbo2.framebuffer);

    gl.bindTexture(gl.TEXTURE_2D, this.blurFbo1.texture);
    gl.uniform2f(this.blurUniforms.u_direction, 0.0, 1.0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Pass 5: Combine
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, ctx.width, ctx.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.combineProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneFbo.texture);
    gl.uniform1i(this.combineUniforms.u_scene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.blurFbo2.texture);
    gl.uniform1i(this.combineUniforms.u_bloom, 1);
    gl.uniform1f(this.combineUniforms.u_intensity, this.intensity);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindVertexArray(null);
    this.stats.recordDrawCall(2); // simplified count

    this.stats.endFrame();
  }

  resize(_width: number, _height: number, _dpr: number): void {
    // Framebuffers recreated in render
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  reset(): void {
    this.threshold = 0.5;
    this.intensity = 1.0;
    this.radius = 4;
  }

  setParameter(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'threshold':
        this.threshold = value as number;
        break;
      case 'intensity':
        this.intensity = value as number;
        break;
      case 'radius':
        this.radius = value as number;
        break;
    }
  }

  getParameters(): Record<string, number | boolean | string> {
    return {
      threshold: this.threshold,
      intensity: this.intensity,
      radius: this.radius,
    };
  }

  getStats(): DemoStats {
    return this.stats.getStats();
  }
}

export const factory: DemoFactory = (gl: WebGL2RenderingContext) => new BloomDemo(gl);
