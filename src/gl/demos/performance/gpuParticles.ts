/**
 * GPU Particle System with Transform Feedback
 *
 * Uses WebGL2 transform feedback to update particle positions entirely on the GPU.
 * Features:
 * - Thousands of particles animated on GPU
 * - Attractor-based force field
 * - Double buffering with transform feedback
 * - Additive blending for glowing particles
 */

import { mat4 } from 'gl-matrix';
import { createProgram, getUniformLocations } from '../../core';
import { StatsTracker } from '../../core/stats';
import { getScaledParticleCount } from '../../core/qualityPresets';
import type { DemoInstance, DemoContext, DemoStats, DemoFactory, QualityLevel } from '../../core/types';

const BASE_PARTICLE_COUNT = 50000;

// Update shader with transform feedback
const updateVertexShader = `#version 300 es
precision highp float;

in vec3 a_position;
in vec3 a_velocity;
in float a_life;

out vec3 v_position;
out vec3 v_velocity;
out float v_life;

uniform float u_deltaTime;
uniform float u_time;
uniform vec3 u_attractor1;
uniform vec3 u_attractor2;
uniform vec3 u_attractor3;
uniform float u_turbulence;

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

vec3 hash3(float n) {
  return vec3(hash(n), hash(n + 1.0), hash(n + 2.0));
}

void main() {
  vec3 pos = a_position;
  vec3 vel = a_velocity;
  float life = a_life;

  life -= u_deltaTime * 0.3;

  if (life <= 0.0) {
    float seed = float(gl_VertexID) + u_time * 100.0;
    vec3 randVec = hash3(seed) * 2.0 - 1.0;
    pos = randVec * 2.0;
    vel = normalize(randVec) * (0.5 + hash(seed + 3.0) * 2.0);
    life = 0.5 + hash(seed + 4.0) * 1.5;
  } else {
    vec3 force = vec3(0.0);

    vec3 toAttr1 = u_attractor1 - pos;
    float dist1 = length(toAttr1) + 0.1;
    force += normalize(toAttr1) * 5.0 / (dist1 * dist1);

    vec3 toAttr2 = u_attractor2 - pos;
    float dist2 = length(toAttr2) + 0.1;
    force += normalize(toAttr2) * 4.0 / (dist2 * dist2);

    vec3 toAttr3 = u_attractor3 - pos;
    float dist3 = length(toAttr3) + 0.1;
    force -= normalize(toAttr3) * 3.0 / (dist3 * dist3);

    float noiseScale = 0.5;
    vec3 turbulence = vec3(
      sin(pos.y * noiseScale + u_time) * cos(pos.z * noiseScale),
      sin(pos.z * noiseScale + u_time) * cos(pos.x * noiseScale),
      sin(pos.x * noiseScale + u_time) * cos(pos.y * noiseScale)
    ) * u_turbulence;

    force += turbulence;

    vel += force * u_deltaTime;
    vel *= 0.99;

    float speed = length(vel);
    if (speed > 10.0) {
      vel = normalize(vel) * 10.0;
    }

    pos += vel * u_deltaTime;
  }

  v_position = pos;
  v_velocity = vel;
  v_life = life;
}
`;

const updateFragmentShader = `#version 300 es
precision highp float;
out vec4 fragColor;
void main() {
  fragColor = vec4(0.0);
}
`;

// Render shader
const renderVertexShader = `#version 300 es
precision highp float;

in vec3 a_position;
in vec3 a_velocity;
in float a_life;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform float u_time;
uniform float u_pointSize;

out float v_life;
out float v_speed;

void main() {
  vec4 viewPos = u_view * vec4(a_position, 1.0);
  gl_Position = u_projection * viewPos;

  float dist = length(viewPos.xyz);
  gl_PointSize = (u_pointSize + a_life * 3.0) * (20.0 / dist);
  gl_PointSize = clamp(gl_PointSize, 1.0, 20.0);

  v_life = a_life;
  v_speed = length(a_velocity);
}
`;

const renderFragmentShader = `#version 300 es
precision highp float;

in float v_life;
in float v_speed;

out vec4 fragColor;

void main() {
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);
  if (dist > 0.5) discard;

  float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
  alpha *= v_life;

  vec3 slowColor = vec3(0.2, 0.5, 1.0);
  vec3 fastColor = vec3(1.0, 0.3, 0.6);
  vec3 color = mix(slowColor, fastColor, clamp(v_speed / 5.0, 0.0, 1.0));
  color *= 1.0 + v_life * 0.5;

  fragColor = vec4(color, alpha * 0.8);
}
`;

class GPUParticlesDemo implements DemoInstance {
  private gl: WebGL2RenderingContext;
  private updateProgram: WebGLProgram | null = null;
  private renderProgram: WebGLProgram | null = null;
  private updateUniforms: Record<string, WebGLUniformLocation | null> = {};
  private renderUniforms: Record<string, WebGLUniformLocation | null> = {};
  private buffers: WebGLBuffer[] = [];
  private updateVaos: WebGLVertexArrayObject[] = [];
  private renderVaos: WebGLVertexArrayObject[] = [];
  private transformFeedback: WebGLTransformFeedback | null = null;
  private stats: StatsTracker;
  private isPaused = false;

  private projectionMatrix = mat4.create();
  private viewMatrix = mat4.create();
  private currentBuffer = 0;
  private particleCount = BASE_PARTICLE_COUNT;
  private currentQuality: QualityLevel = 'high';

  // Parameters
  private turbulence = 2.0;
  private cameraSpeed = 1.0;
  private pointSize = 5.0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.stats = new StatsTracker(gl);
  }

  init(): void {
    const gl = this.gl;

    this.updateProgram = createProgram(
      gl,
      updateVertexShader,
      updateFragmentShader,
      ['v_position', 'v_velocity', 'v_life']
    );

    this.renderProgram = createProgram(gl, renderVertexShader, renderFragmentShader);

    this.updateUniforms = getUniformLocations(gl, this.updateProgram, [
      'u_deltaTime', 'u_time', 'u_attractor1', 'u_attractor2', 'u_attractor3', 'u_turbulence'
    ]);

    this.renderUniforms = getUniformLocations(gl, this.renderProgram, [
      'u_projection', 'u_view', 'u_time', 'u_pointSize'
    ]);

    this.transformFeedback = gl.createTransformFeedback()!;

    this.createParticleSystem();
  }

  private createParticleSystem(): void {
    const gl = this.gl;

    // Clean up old resources
    this.buffers.forEach(buf => gl.deleteBuffer(buf));
    this.updateVaos.forEach(vao => gl.deleteVertexArray(vao));
    this.renderVaos.forEach(vao => gl.deleteVertexArray(vao));
    this.buffers = [];
    this.updateVaos = [];
    this.renderVaos = [];

    // Initialize particle data
    const particleData = new Float32Array(this.particleCount * 7);

    for (let i = 0; i < this.particleCount; i++) {
      const offset = i * 7;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.pow(Math.random(), 0.5) * 10;

      particleData[offset + 0] = r * Math.sin(phi) * Math.cos(theta);
      particleData[offset + 1] = r * Math.sin(phi) * Math.sin(theta);
      particleData[offset + 2] = r * Math.cos(phi);
      particleData[offset + 3] = (Math.random() - 0.5) * 2;
      particleData[offset + 4] = (Math.random() - 0.5) * 2;
      particleData[offset + 5] = (Math.random() - 0.5) * 2;
      particleData[offset + 6] = Math.random() * 2;
    }

    // Create double buffers
    this.buffers = [gl.createBuffer()!, gl.createBuffer()!];
    for (const buffer of this.buffers) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, particleData, gl.DYNAMIC_COPY);
    }

    // Create VAOs for update pass
    this.updateVaos = this.buffers.map(buffer => {
      const vao = gl.createVertexArray()!;
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

      const posLoc = gl.getAttribLocation(this.updateProgram!, 'a_position');
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 28, 0);

      const velLoc = gl.getAttribLocation(this.updateProgram!, 'a_velocity');
      gl.enableVertexAttribArray(velLoc);
      gl.vertexAttribPointer(velLoc, 3, gl.FLOAT, false, 28, 12);

      const lifeLoc = gl.getAttribLocation(this.updateProgram!, 'a_life');
      gl.enableVertexAttribArray(lifeLoc);
      gl.vertexAttribPointer(lifeLoc, 1, gl.FLOAT, false, 28, 24);

      gl.bindVertexArray(null);
      return vao;
    });

    // Create VAOs for render pass
    this.renderVaos = this.buffers.map(buffer => {
      const vao = gl.createVertexArray()!;
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

      const posLoc = gl.getAttribLocation(this.renderProgram!, 'a_position');
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 28, 0);

      const velLoc = gl.getAttribLocation(this.renderProgram!, 'a_velocity');
      gl.enableVertexAttribArray(velLoc);
      gl.vertexAttribPointer(velLoc, 3, gl.FLOAT, false, 28, 12);

      const lifeLoc = gl.getAttribLocation(this.renderProgram!, 'a_life');
      gl.enableVertexAttribArray(lifeLoc);
      gl.vertexAttribPointer(lifeLoc, 1, gl.FLOAT, false, 28, 24);

      gl.bindVertexArray(null);
      return vao;
    });
  }

  destroy(): void {
    const gl = this.gl;
    if (this.updateProgram) gl.deleteProgram(this.updateProgram);
    if (this.renderProgram) gl.deleteProgram(this.renderProgram);
    if (this.transformFeedback) gl.deleteTransformFeedback(this.transformFeedback);
    this.updateVaos.forEach(vao => gl.deleteVertexArray(vao));
    this.renderVaos.forEach(vao => gl.deleteVertexArray(vao));
    this.buffers.forEach(buf => gl.deleteBuffer(buf));
    this.stats.destroy();
  }

  render(ctx: DemoContext): void {
    if (this.isPaused) return;

    const gl = this.gl;

    // Check quality change
    if (ctx.quality !== this.currentQuality) {
      this.currentQuality = ctx.quality;
      this.particleCount = getScaledParticleCount(BASE_PARTICLE_COUNT, ctx.quality);
      this.createParticleSystem();
    }

    this.stats.beginFrame();

    // Clear the canvas
    gl.viewport(0, 0, ctx.width, ctx.height);
    gl.clearColor(0.02, 0.02, 0.05, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const dt = Math.min(ctx.deltaTime, 0.05);
    const time = ctx.reduceMotion ? ctx.time * 0.3 : ctx.time;

    // Animate attractors
    const attr1 = [
      Math.sin(time * 0.7) * 8,
      Math.cos(time * 0.5) * 5,
      Math.sin(time * 0.3) * 6
    ];
    const attr2 = [
      Math.cos(time * 0.4) * 7,
      Math.sin(time * 0.8) * 6,
      Math.cos(time * 0.6) * 5
    ];
    const attr3 = [
      Math.sin(time * 0.9) * 5,
      Math.cos(time * 0.3) * 7,
      Math.sin(time * 0.5) * 8
    ];

    // Update pass
    gl.useProgram(this.updateProgram);
    gl.uniform1f(this.updateUniforms.u_deltaTime, dt);
    gl.uniform1f(this.updateUniforms.u_time, time);
    gl.uniform3fv(this.updateUniforms.u_attractor1, attr1);
    gl.uniform3fv(this.updateUniforms.u_attractor2, attr2);
    gl.uniform3fv(this.updateUniforms.u_attractor3, attr3);
    gl.uniform1f(this.updateUniforms.u_turbulence, this.turbulence);

    gl.bindVertexArray(this.updateVaos[this.currentBuffer]);

    const nextBuffer = 1 - this.currentBuffer;
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.transformFeedback);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.buffers[nextBuffer]);

    gl.enable(gl.RASTERIZER_DISCARD);
    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, this.particleCount);
    gl.endTransformFeedback();
    gl.disable(gl.RASTERIZER_DISCARD);

    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

    // Render pass
    gl.useProgram(this.renderProgram);

    const aspect = ctx.width / ctx.height;
    mat4.perspective(this.projectionMatrix, Math.PI / 4, aspect, 0.1, 200.0);

    const camRadius = 25;
    const camX = Math.sin(time * 0.2 * this.cameraSpeed) * camRadius;
    const camZ = Math.cos(time * 0.2 * this.cameraSpeed) * camRadius;
    const camY = Math.sin(time * 0.1 * this.cameraSpeed) * 10;
    mat4.lookAt(this.viewMatrix, [camX, camY, camZ], [0, 0, 0], [0, 1, 0]);

    gl.uniformMatrix4fv(this.renderUniforms.u_projection, false, this.projectionMatrix);
    gl.uniformMatrix4fv(this.renderUniforms.u_view, false, this.viewMatrix);
    gl.uniform1f(this.renderUniforms.u_time, time);
    gl.uniform1f(this.renderUniforms.u_pointSize, this.pointSize);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.bindVertexArray(this.renderVaos[nextBuffer]);
    gl.drawArrays(gl.POINTS, 0, this.particleCount);
    this.stats.recordDrawCall(this.particleCount);
    this.stats.recordParticles(this.particleCount);

    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);

    this.currentBuffer = nextBuffer;

    this.stats.endFrame();
  }

  resize(_width: number, _height: number, _dpr: number): void {}

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  reset(): void {
    this.turbulence = 2.0;
    this.cameraSpeed = 1.0;
    this.pointSize = 5.0;
    this.createParticleSystem();
  }

  setParameter(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'turbulence':
        this.turbulence = value as number;
        break;
      case 'cameraSpeed':
        this.cameraSpeed = value as number;
        break;
      case 'pointSize':
        this.pointSize = value as number;
        break;
    }
  }

  getParameters(): Record<string, number | boolean | string> {
    return {
      turbulence: this.turbulence,
      cameraSpeed: this.cameraSpeed,
      pointSize: this.pointSize,
    };
  }

  getStats(): DemoStats {
    const stats = this.stats.getStats();
    return {
      ...stats,
      particles: this.particleCount,
    };
  }
}

export const factory: DemoFactory = (gl: WebGL2RenderingContext) => new GPUParticlesDemo(gl);
