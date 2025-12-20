/**
 * Instanced Geometry Field Demo
 *
 * Renders thousands of instanced geometric shapes using WebGL2 instancing.
 * Features:
 * - drawArraysInstanced for efficient batch rendering
 * - Per-instance attributes (position, rotation, scale, color)
 * - GPU-driven animation via vertex shader
 * - Smooth wave-like motion patterns
 */

import { mat4 } from 'gl-matrix';
import { createProgram, createVao, createBuffer, getUniformLocations } from '../../core';
import { StatsTracker } from '../../core/stats';
import { getScaledInstanceCount } from '../../core/qualityPresets';
import type { DemoInstance, DemoContext, DemoStats, DemoFactory, QualityLevel } from '../../core/types';

// Vertex shader with per-instance attributes
const vertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
in vec3 a_instancePosition;
in vec4 a_instanceColor;
in float a_instanceScale;
in float a_instanceRotation;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform float u_time;
uniform float u_speed;

out vec4 v_color;
out vec2 v_localPos;

mat2 rotate2D(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

void main() {
  float instanceId = float(gl_InstanceID);
  float phase = instanceId * 0.01;

  float t = u_time * u_speed;

  // Wave-like animation
  float waveX = sin(t * 0.5 + a_instancePosition.x * 2.0 + phase) * 0.3;
  float waveY = cos(t * 0.7 + a_instancePosition.y * 2.0 + phase) * 0.2;
  float waveZ = sin(t * 0.3 + instanceId * 0.001) * 0.5;

  // Animated rotation
  float animRotation = a_instanceRotation + t * (0.2 + sin(instanceId * 0.1) * 0.3);

  // Animated scale with pulsing
  float animScale = a_instanceScale * (0.8 + 0.2 * sin(t * 2.0 + phase * 10.0));

  vec2 rotatedPos = rotate2D(animRotation) * a_position * animScale;

  vec3 worldPos = a_instancePosition + vec3(rotatedPos, 0.0);
  worldPos.x += waveX;
  worldPos.y += waveY;
  worldPos.z += waveZ;

  gl_Position = u_projection * u_view * vec4(worldPos, 1.0);

  v_color = a_instanceColor;
  float brightness = 0.7 + 0.3 * sin(t + phase);
  v_color.rgb *= brightness;

  v_localPos = a_position;
}
`;

// Fragment shader
const fragmentShader = `#version 300 es
precision highp float;

in vec4 v_color;
in vec2 v_localPos;

out vec4 fragColor;

void main() {
  vec2 p = v_localPos;

  // Hexagon SDF
  vec2 q = abs(p);
  float hex = max(q.x * 0.866025 + q.y * 0.5, q.y) - 0.5;

  float alpha = 1.0 - smoothstep(0.0, 0.05, hex);
  float glow = exp(-hex * 8.0) * 0.3;

  vec4 color = v_color;
  color.a *= alpha;
  color.rgb += glow;

  if (color.a < 0.01) discard;

  fragColor = color;
}
`;

const BASE_INSTANCE_COUNT = 5000;
const GRID_SIZE = 70;

class InstancedDemo implements DemoInstance {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private buffers: WebGLBuffer[] = [];
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private stats: StatsTracker;
  private isPaused = false;

  private projectionMatrix = mat4.create();
  private viewMatrix = mat4.create();

  private instanceCount = BASE_INSTANCE_COUNT;
  private currentQuality: QualityLevel = 'high';

  // Parameters
  private speed = 1.0;
  private cameraSpeed = 1.0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.stats = new StatsTracker(gl);
  }

  init(): void {
    const gl = this.gl;

    this.program = createProgram(gl, vertexShader, fragmentShader);

    this.uniforms = getUniformLocations(gl, this.program, [
      'u_projection',
      'u_view',
      'u_time',
      'u_speed',
    ]);

    this.createGeometry();
  }

  private createGeometry(): void {
    const gl = this.gl;

    // Clean up old buffers
    this.buffers.forEach(buf => gl.deleteBuffer(buf));
    this.buffers = [];
    if (this.vao) gl.deleteVertexArray(this.vao);

    // Create hexagon geometry
    const hexagonVertices: number[] = [];
    const numSides = 6;
    for (let i = 0; i < numSides; i++) {
      const angle1 = (i / numSides) * Math.PI * 2;
      const angle2 = ((i + 1) / numSides) * Math.PI * 2;
      hexagonVertices.push(0, 0);
      hexagonVertices.push(Math.cos(angle1) * 0.5, Math.sin(angle1) * 0.5);
      hexagonVertices.push(Math.cos(angle2) * 0.5, Math.sin(angle2) * 0.5);
    }
    const vertexData = new Float32Array(hexagonVertices);

    // Generate instance data
    const instancePositions = new Float32Array(this.instanceCount * 3);
    const instanceColors = new Float32Array(this.instanceCount * 4);
    const instanceScales = new Float32Array(this.instanceCount);
    const instanceRotations = new Float32Array(this.instanceCount);

    // Color palette
    const palette = [
      [0.0, 0.8, 1.0],   // Cyan
      [1.0, 0.2, 0.6],   // Magenta
      [0.4, 0.0, 1.0],   // Purple
      [0.0, 1.0, 0.6],   // Teal
      [1.0, 0.6, 0.0],   // Orange
    ];

    for (let i = 0; i < this.instanceCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.pow(Math.random(), 0.5) * GRID_SIZE;

      instancePositions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      instancePositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      instancePositions[i * 3 + 2] = (Math.random() - 0.5) * GRID_SIZE * 0.5;

      const colorIdx = Math.floor(Math.random() * palette.length);
      const baseColor = palette[colorIdx];
      instanceColors[i * 4 + 0] = baseColor[0] + (Math.random() - 0.5) * 0.2;
      instanceColors[i * 4 + 1] = baseColor[1] + (Math.random() - 0.5) * 0.2;
      instanceColors[i * 4 + 2] = baseColor[2] + (Math.random() - 0.5) * 0.2;
      instanceColors[i * 4 + 3] = 0.6 + Math.random() * 0.4;

      instanceScales[i] = 0.3 + Math.random() * 0.7;
      instanceRotations[i] = Math.random() * Math.PI * 2;
    }

    // Create VAO and buffers
    this.vao = createVao(gl);
    gl.bindVertexArray(this.vao);

    const vertexBuffer = createBuffer(gl, vertexData);
    this.buffers.push(vertexBuffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    const posLoc = gl.getAttribLocation(this.program!, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const instancePosBuffer = createBuffer(gl, instancePositions);
    this.buffers.push(instancePosBuffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, instancePosBuffer);
    const instancePosLoc = gl.getAttribLocation(this.program!, 'a_instancePosition');
    gl.enableVertexAttribArray(instancePosLoc);
    gl.vertexAttribPointer(instancePosLoc, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(instancePosLoc, 1);

    const instanceColorBuffer = createBuffer(gl, instanceColors);
    this.buffers.push(instanceColorBuffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceColorBuffer);
    const instanceColorLoc = gl.getAttribLocation(this.program!, 'a_instanceColor');
    gl.enableVertexAttribArray(instanceColorLoc);
    gl.vertexAttribPointer(instanceColorLoc, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(instanceColorLoc, 1);

    const instanceScaleBuffer = createBuffer(gl, instanceScales);
    this.buffers.push(instanceScaleBuffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceScaleBuffer);
    const instanceScaleLoc = gl.getAttribLocation(this.program!, 'a_instanceScale');
    gl.enableVertexAttribArray(instanceScaleLoc);
    gl.vertexAttribPointer(instanceScaleLoc, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(instanceScaleLoc, 1);

    const instanceRotBuffer = createBuffer(gl, instanceRotations);
    this.buffers.push(instanceRotBuffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceRotBuffer);
    const instanceRotLoc = gl.getAttribLocation(this.program!, 'a_instanceRotation');
    gl.enableVertexAttribArray(instanceRotLoc);
    gl.vertexAttribPointer(instanceRotLoc, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(instanceRotLoc, 1);

    gl.bindVertexArray(null);
  }

  destroy(): void {
    const gl = this.gl;
    if (this.program) gl.deleteProgram(this.program);
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.buffers.forEach(buf => gl.deleteBuffer(buf));
    this.stats.destroy();
  }

  render(ctx: DemoContext): void {
    if (this.isPaused) return;

    const gl = this.gl;

    // Check if quality changed
    if (ctx.quality !== this.currentQuality) {
      this.currentQuality = ctx.quality;
      this.instanceCount = getScaledInstanceCount(BASE_INSTANCE_COUNT, ctx.quality);
      this.createGeometry();
    }

    this.stats.beginFrame();

    // Clear the canvas
    gl.viewport(0, 0, ctx.width, ctx.height);
    gl.clearColor(0.02, 0.02, 0.05, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = ctx.width / ctx.height;
    mat4.perspective(this.projectionMatrix, Math.PI / 4, aspect, 0.1, 200.0);

    const time = ctx.reduceMotion ? ctx.time * 0.3 : ctx.time;
    const camRadius = 80;
    const camX = Math.sin(time * 0.2 * this.cameraSpeed) * camRadius;
    const camZ = Math.cos(time * 0.2 * this.cameraSpeed) * camRadius;
    const camY = Math.sin(time * 0.15 * this.cameraSpeed) * 20;

    mat4.lookAt(this.viewMatrix, [camX, camY, camZ], [0, 0, 0], [0, 1, 0]);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.uniformMatrix4fv(this.uniforms.u_projection, false, this.projectionMatrix);
    gl.uniformMatrix4fv(this.uniforms.u_view, false, this.viewMatrix);
    gl.uniform1f(this.uniforms.u_time, time);
    gl.uniform1f(this.uniforms.u_speed, this.speed);

    gl.drawArraysInstanced(gl.TRIANGLES, 0, 18, this.instanceCount);
    this.stats.recordDrawCall(6, this.instanceCount); // 6 triangles

    // Cleanup state
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);

    this.stats.endFrame();
  }

  resize(_width: number, _height: number, _dpr: number): void {
    // Resolution handled via context
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  reset(): void {
    this.speed = 1.0;
    this.cameraSpeed = 1.0;
  }

  setParameter(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'speed':
        this.speed = value as number;
        break;
      case 'cameraSpeed':
        this.cameraSpeed = value as number;
        break;
    }
  }

  getParameters(): Record<string, number | boolean | string> {
    return {
      speed: this.speed,
      cameraSpeed: this.cameraSpeed,
    };
  }

  getStats(): DemoStats {
    const stats = this.stats.getStats();
    return {
      ...stats,
      instances: this.instanceCount,
    };
  }
}

export const factory: DemoFactory = (gl: WebGL2RenderingContext) => new InstancedDemo(gl);
