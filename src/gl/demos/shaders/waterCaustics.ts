/**
 * Water Caustics Demo
 *
 * Simulates underwater caustic light patterns using UV distortion and animated noise.
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
uniform float u_speed;
uniform float u_distortion;
uniform float u_brightness;

// Simplex noise
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
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
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

float caustic(vec2 uv, float time) {
  float c = 0.0;

  // Layer 1
  vec2 p1 = uv * 8.0 + vec2(time * 0.3, time * 0.2);
  c += abs(snoise(p1)) * 0.5;

  // Layer 2 - different scale and direction
  vec2 p2 = uv * 12.0 + vec2(-time * 0.2, time * 0.4);
  c += abs(snoise(p2)) * 0.3;

  // Layer 3 - fine detail
  vec2 p3 = uv * 20.0 + vec2(time * 0.5, -time * 0.3);
  c += abs(snoise(p3)) * 0.2;

  return c;
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;

  float time = u_time * u_speed;

  // UV distortion for water effect
  vec2 distortedUV = uv;
  distortedUV.x += sin(uv.y * 10.0 + time * 2.0) * u_distortion;
  distortedUV.y += cos(uv.x * 10.0 + time * 1.5) * u_distortion;

  // Generate caustic pattern
  float c = caustic(distortedUV, time);

  // Sharpen the caustics
  c = pow(c, 1.5) * u_brightness;

  // Water color gradient
  vec3 deepColor = vec3(0.0, 0.1, 0.3);
  vec3 shallowColor = vec3(0.0, 0.3, 0.5);
  vec3 causticColor = vec3(0.3, 0.8, 1.0);

  // Depth based on vertical position
  float depth = 1.0 - uv.y;
  vec3 waterColor = mix(shallowColor, deepColor, depth);

  // Add caustics
  vec3 color = waterColor + causticColor * c;

  // Add subtle light rays from top
  float rays = sin(uv.x * 30.0 + time) * 0.5 + 0.5;
  rays *= (1.0 - uv.y) * 0.1;
  color += vec3(rays) * causticColor;

  // Vignette
  float vignette = 1.0 - length(uv - 0.5) * 0.8;
  color *= vignette;

  fragColor = vec4(color, 1.0);
}
`;

class WaterCausticsDemo implements DemoInstance {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private buffer: WebGLBuffer | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private stats: StatsTracker;
  private isPaused = false;

  private speed = 1.0;
  private distortion = 0.1;
  private brightness = 1.0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.stats = new StatsTracker(gl);
  }

  async init(): Promise<void> {
    const gl = this.gl;

    this.program = createProgram(gl, vertexShader, fragmentShader);
    if (!this.program) throw new Error('Failed to create water caustics shader');

    this.uniforms = getUniformLocations(gl, this.program, [
      'u_time', 'u_resolution', 'u_speed', 'u_distortion', 'u_brightness',
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
    gl.uniform1f(this.uniforms.u_speed, this.speed);
    gl.uniform1f(this.uniforms.u_distortion, this.distortion);
    gl.uniform1f(this.uniforms.u_brightness, this.brightness);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.stats.recordDrawCall(1);

    gl.bindVertexArray(null);
    this.stats.endFrame();
  }

  resize(): void {}
  pause(): void { this.isPaused = true; }
  resume(): void { this.isPaused = false; }

  reset(): void {
    this.speed = 1.0;
    this.distortion = 0.1;
    this.brightness = 1.0;
  }

  setParameter(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'speed': this.speed = value as number; break;
      case 'distortion': this.distortion = value as number; break;
      case 'brightness': this.brightness = value as number; break;
    }
  }

  getParameters(): Record<string, number | boolean | string> {
    return { speed: this.speed, distortion: this.distortion, brightness: this.brightness };
  }

  getStats(): DemoStats { return this.stats.getStats(); }
}

export const factory: DemoFactory = (gl: WebGL2RenderingContext) => new WaterCausticsDemo(gl);
