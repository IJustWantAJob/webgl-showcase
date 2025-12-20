/**
 * Heightfield Wave Demo
 *
 * A grid mesh displaced by noise-based heights.
 * Features:
 * - Vertex displacement in shader
 * - Normal computation from neighbors
 * - Phong-style lighting
 * - Animated wave patterns
 */

import { mat4 } from 'gl-matrix';
import { createProgram, createVao, createBuffer, getUniformLocations } from '../../core';
import { StatsTracker } from '../../core/stats';
import type { DemoInstance, DemoContext, DemoStats, DemoFactory } from '../../core/types';

// Vertex shader with displacement
const vertexShader = `#version 300 es
precision highp float;

in vec2 a_position;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_model;
uniform float u_time;
uniform float u_waveHeight;
uniform float u_waveFrequency;
uniform vec2 u_gridSize;

out vec3 v_position;
out vec3 v_normal;
out vec2 v_uv;

// Simplex noise for height
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

float getHeight(vec2 p, float time) {
  float h = 0.0;
  h += snoise(p * u_waveFrequency + time * 0.5) * 0.5;
  h += snoise(p * u_waveFrequency * 2.0 - time * 0.3) * 0.25;
  h += snoise(p * u_waveFrequency * 4.0 + time * 0.2) * 0.125;
  return h * u_waveHeight;
}

void main() {
  vec2 uv = a_position;
  v_uv = uv;

  // Map to world space
  vec3 pos = vec3(
    (uv.x - 0.5) * u_gridSize.x,
    0.0,
    (uv.y - 0.5) * u_gridSize.y
  );

  // Get height
  pos.y = getHeight(pos.xz * 0.1, u_time);

  // Compute normal using finite differences
  float eps = 0.1;
  float hL = getHeight((pos.xz + vec2(-eps, 0.0)) * 0.1, u_time);
  float hR = getHeight((pos.xz + vec2(eps, 0.0)) * 0.1, u_time);
  float hD = getHeight((pos.xz + vec2(0.0, -eps)) * 0.1, u_time);
  float hU = getHeight((pos.xz + vec2(0.0, eps)) * 0.1, u_time);

  vec3 normal = normalize(vec3(hL - hR, 2.0 * eps, hD - hU));

  v_position = (u_model * vec4(pos, 1.0)).xyz;
  v_normal = mat3(u_model) * normal;

  gl_Position = u_projection * u_view * u_model * vec4(pos, 1.0);
}
`;

// Fragment shader with lighting
const fragmentShader = `#version 300 es
precision highp float;

in vec3 v_position;
in vec3 v_normal;
in vec2 v_uv;

out vec4 fragColor;

uniform vec3 u_lightPos;
uniform vec3 u_viewPos;
uniform bool u_wireframe;
uniform float u_time;

void main() {
  vec3 normal = normalize(v_normal);

  // Light direction
  vec3 lightDir = normalize(u_lightPos - v_position);
  vec3 viewDir = normalize(u_viewPos - v_position);

  // Diffuse
  float diff = max(dot(normal, lightDir), 0.0);

  // Specular
  vec3 reflectDir = reflect(-lightDir, normal);
  float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);

  // Color based on height and normal
  vec3 baseColor = vec3(0.2, 0.5, 0.9);
  vec3 highlightColor = vec3(0.9, 0.4, 0.6);

  // Mix colors based on height (encoded in position)
  float heightFactor = v_position.y * 0.3 + 0.5;
  vec3 surfaceColor = mix(baseColor, highlightColor, clamp(heightFactor, 0.0, 1.0));

  // Combine lighting
  vec3 ambient = 0.2 * surfaceColor;
  vec3 diffuse = diff * surfaceColor;
  vec3 specular = spec * vec3(0.5);

  vec3 color = ambient + diffuse + specular;

  // Wireframe overlay
  if (u_wireframe) {
    vec2 grid = fract(v_uv * 50.0);
    float line = min(
      min(smoothstep(0.0, 0.03, grid.x), smoothstep(1.0, 0.97, grid.x)),
      min(smoothstep(0.0, 0.03, grid.y), smoothstep(1.0, 0.97, grid.y))
    );
    color = mix(vec3(0.0, 1.0, 0.5), color, line);
  }

  fragColor = vec4(color, 1.0);
}
`;

class HeightfieldDemo implements DemoInstance {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private vertexBuffer: WebGLBuffer | null = null;
  private indexBuffer: WebGLBuffer | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private stats: StatsTracker;
  private isPaused = false;

  private projectionMatrix = mat4.create();
  private viewMatrix = mat4.create();
  private modelMatrix = mat4.create();

  private indexCount = 0;
  private currentGridSize = 100;

  // Parameters
  private gridSize = 100;
  private waveHeight = 1.0;
  private waveFrequency = 2.0;
  private wireframe = false;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.stats = new StatsTracker(gl);
  }

  async init(): Promise<void> {
    const gl = this.gl;

    // Create shader program
    this.program = createProgram(gl, vertexShader, fragmentShader);
    if (!this.program) throw new Error('Failed to create heightfield shader program');

    // Get uniform locations
    this.uniforms = getUniformLocations(gl, this.program, [
      'u_projection',
      'u_view',
      'u_model',
      'u_time',
      'u_waveHeight',
      'u_waveFrequency',
      'u_gridSize',
      'u_lightPos',
      'u_viewPos',
      'u_wireframe',
    ]);

    this.createGrid();
  }

  private createGrid(): void {
    const gl = this.gl;
    const size = this.gridSize;

    // Clean up old resources
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.vertexBuffer) gl.deleteBuffer(this.vertexBuffer);
    if (this.indexBuffer) gl.deleteBuffer(this.indexBuffer);

    // Generate grid vertices
    const vertices: number[] = [];
    for (let y = 0; y <= size; y++) {
      for (let x = 0; x <= size; x++) {
        vertices.push(x / size, y / size);
      }
    }

    // Generate indices for triangle strip
    const indices: number[] = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * (size + 1) + x;
        indices.push(i, i + 1, i + size + 1);
        indices.push(i + 1, i + size + 2, i + size + 1);
      }
    }

    this.indexCount = indices.length;
    this.currentGridSize = size;

    // Create VAO
    this.vao = createVao(gl);
    gl.bindVertexArray(this.vao);

    // Create vertex buffer
    this.vertexBuffer = createBuffer(gl, new Float32Array(vertices));
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

    const positionLoc = gl.getAttribLocation(this.program!, 'a_position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Create index buffer
    this.indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);

    gl.bindVertexArray(null);
  }

  destroy(): void {
    const gl = this.gl;
    if (this.program) gl.deleteProgram(this.program);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.vertexBuffer) gl.deleteBuffer(this.vertexBuffer);
    if (this.indexBuffer) gl.deleteBuffer(this.indexBuffer);
    this.stats.destroy();
  }

  render(ctx: DemoContext): void {
    if (this.isPaused || !this.program || !this.vao) return;

    const gl = this.gl;
    this.stats.beginFrame();

    // Recreate grid if size changed
    if (this.gridSize !== this.currentGridSize) {
      this.createGrid();
    }

    // Clear
    gl.viewport(0, 0, ctx.width, ctx.height);
    gl.clearColor(0.02, 0.02, 0.05, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    const aspect = ctx.width / ctx.height;
    mat4.perspective(this.projectionMatrix, Math.PI / 4, aspect, 0.1, 100.0);

    const time = ctx.reduceMotion ? ctx.time * 0.3 : ctx.time;
    const camRadius = 15;
    const camX = Math.sin(time * 0.2) * camRadius;
    const camZ = Math.cos(time * 0.2) * camRadius;
    const camY = 8 + Math.sin(time * 0.1) * 2;

    mat4.lookAt(this.viewMatrix, [camX, camY, camZ], [0, 0, 0], [0, 1, 0]);
    mat4.identity(this.modelMatrix);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.uniformMatrix4fv(this.uniforms.u_projection, false, this.projectionMatrix);
    gl.uniformMatrix4fv(this.uniforms.u_view, false, this.viewMatrix);
    gl.uniformMatrix4fv(this.uniforms.u_model, false, this.modelMatrix);
    gl.uniform1f(this.uniforms.u_time, time);
    gl.uniform1f(this.uniforms.u_waveHeight, this.waveHeight);
    gl.uniform1f(this.uniforms.u_waveFrequency, this.waveFrequency);
    gl.uniform2f(this.uniforms.u_gridSize, 10.0, 10.0);
    gl.uniform3f(this.uniforms.u_lightPos, 5.0, 10.0, 5.0);
    gl.uniform3f(this.uniforms.u_viewPos, camX, camY, camZ);
    gl.uniform1i(this.uniforms.u_wireframe, this.wireframe ? 1 : 0);

    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0);
    this.stats.recordDrawCall(this.indexCount / 3);

    gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST);

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
    this.gridSize = 100;
    this.waveHeight = 1.0;
    this.waveFrequency = 2.0;
    this.wireframe = false;
  }

  setParameter(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'gridSize':
        this.gridSize = value as number;
        break;
      case 'waveHeight':
        this.waveHeight = value as number;
        break;
      case 'waveFrequency':
        this.waveFrequency = value as number;
        break;
      case 'wireframe':
        this.wireframe = value as boolean;
        break;
    }
  }

  getParameters(): Record<string, number | boolean | string> {
    return {
      gridSize: this.gridSize,
      waveHeight: this.waveHeight,
      waveFrequency: this.waveFrequency,
      wireframe: this.wireframe,
    };
  }

  getStats(): DemoStats {
    return this.stats.getStats();
  }
}

export const factory: DemoFactory = (gl: WebGL2RenderingContext) => new HeightfieldDemo(gl);
