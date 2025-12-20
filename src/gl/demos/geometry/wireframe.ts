/**
 * Wireframe Look Demo
 *
 * Achieves wireframe rendering without geometry shaders using barycentric coordinates.
 * Features:
 * - Barycentric coordinates as vertex attributes
 * - Edge detection in fragment shader
 * - Adjustable edge thickness
 * - Works on any mesh
 */

import { mat4 } from 'gl-matrix';
import { createProgram, createVao, createBuffer, getUniformLocations } from '../../core';
import { StatsTracker } from '../../core/stats';
import type { DemoInstance, DemoContext, DemoStats, DemoFactory } from '../../core/types';

// Vertex shader
const vertexShader = `#version 300 es
precision highp float;

in vec3 a_position;
in vec3 a_barycentric;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_model;
uniform float u_time;
uniform bool u_animate;

out vec3 v_barycentric;
out vec3 v_position;

void main() {
  vec3 pos = a_position;

  // Optional animation - wave deformation
  if (u_animate) {
    float wave = sin(pos.x * 3.0 + u_time * 2.0) * 0.1;
    wave += cos(pos.z * 3.0 + u_time * 1.5) * 0.1;
    pos.y += wave;
  }

  v_barycentric = a_barycentric;
  v_position = pos;

  gl_Position = u_projection * u_view * u_model * vec4(pos, 1.0);
}
`;

// Fragment shader with wireframe effect
const fragmentShader = `#version 300 es
precision highp float;

in vec3 v_barycentric;
in vec3 v_position;

out vec4 fragColor;

uniform float u_edgeWidth;
uniform float u_fillOpacity;
uniform vec3 u_edgeColor;
uniform vec3 u_fillColor;
uniform float u_time;

float edgeFactor() {
  vec3 d = fwidth(v_barycentric);
  vec3 a3 = smoothstep(vec3(0.0), d * u_edgeWidth, v_barycentric);
  return min(min(a3.x, a3.y), a3.z);
}

void main() {
  float edge = edgeFactor();

  // Fill color with gradient based on position
  vec3 fill = u_fillColor;
  fill = mix(fill, fill * 1.5, v_position.y * 0.5 + 0.5);

  // Edge color with slight animation
  vec3 edgeCol = u_edgeColor;
  float pulse = sin(u_time * 2.0) * 0.2 + 0.8;
  edgeCol *= pulse;

  // Mix edge and fill
  vec3 color = mix(edgeCol, fill, edge);
  float alpha = mix(1.0, u_fillOpacity, edge);

  // Add slight glow to edges
  float glow = (1.0 - edge) * 0.3;
  color += edgeCol * glow;

  fragColor = vec4(color, alpha);
}
`;

class WireframeDemo implements DemoInstance {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private barycentricBuffer: WebGLBuffer | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private stats: StatsTracker;
  private isPaused = false;

  private projectionMatrix = mat4.create();
  private viewMatrix = mat4.create();
  private modelMatrix = mat4.create();

  private vertexCount = 0;

  // Parameters
  private edgeWidth = 1.5;
  private fillOpacity = 0.1;
  private animate = true;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.stats = new StatsTracker(gl);
  }

  async init(): Promise<void> {
    const gl = this.gl;

    // Create shader program
    this.program = createProgram(gl, vertexShader, fragmentShader);
    if (!this.program) throw new Error('Failed to create wireframe shader program');

    // Get uniform locations
    this.uniforms = getUniformLocations(gl, this.program, [
      'u_projection',
      'u_view',
      'u_model',
      'u_time',
      'u_edgeWidth',
      'u_fillOpacity',
      'u_edgeColor',
      'u_fillColor',
      'u_animate',
    ]);

    this.createMesh();
  }

  private createMesh(): void {
    const gl = this.gl;

    // Create an icosahedron mesh with barycentric coordinates
    const phi = (1 + Math.sqrt(5)) / 2;
    const scale = 1.5;

    // Icosahedron vertices
    const baseVertices = [
      [-1,  phi, 0], [ 1,  phi, 0], [-1, -phi, 0], [ 1, -phi, 0],
      [ 0, -1,  phi], [ 0,  1,  phi], [ 0, -1, -phi], [ 0,  1, -phi],
      [ phi, 0, -1], [ phi, 0,  1], [-phi, 0, -1], [-phi, 0,  1],
    ].map(v => v.map(c => c * scale / Math.sqrt(1 + phi * phi)));

    // Icosahedron faces (indices)
    const faces = [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
      [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
      [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
    ];

    // Subdivide for more detail
    const subdivide = (v1: number[], v2: number[], v3: number[]): number[] => {
      const mid = (a: number[], b: number[]): number[] => {
        const m = [(a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2];
        const len = Math.sqrt(m[0]*m[0] + m[1]*m[1] + m[2]*m[2]);
        return [m[0]/len * scale, m[1]/len * scale, m[2]/len * scale];
      };
      const m12 = mid(v1, v2);
      const m23 = mid(v2, v3);
      const m31 = mid(v3, v1);
      return [
        ...v1, ...m12, ...m31,
        ...m12, ...v2, ...m23,
        ...m31, ...m23, ...v3,
        ...m12, ...m23, ...m31,
      ];
    };

    // Build subdivided mesh
    const positions: number[] = [];
    const barycentrics: number[] = [];

    for (const face of faces) {
      const v1 = baseVertices[face[0]];
      const v2 = baseVertices[face[1]];
      const v3 = baseVertices[face[2]];

      // One level of subdivision
      const subdivided = subdivide(v1, v2, v3);

      // Add positions
      positions.push(...subdivided);

      // Add barycentric coordinates for each triangle
      const numTris = subdivided.length / 9;
      for (let i = 0; i < numTris; i++) {
        barycentrics.push(
          1, 0, 0,  // vertex 1
          0, 1, 0,  // vertex 2
          0, 0, 1,  // vertex 3
        );
      }
    }

    this.vertexCount = positions.length / 3;

    // Create VAO
    this.vao = createVao(gl);
    gl.bindVertexArray(this.vao);

    // Position buffer
    this.positionBuffer = createBuffer(gl, new Float32Array(positions));
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);

    const positionLoc = gl.getAttribLocation(this.program!, 'a_position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);

    // Barycentric buffer
    this.barycentricBuffer = createBuffer(gl, new Float32Array(barycentrics));
    gl.bindBuffer(gl.ARRAY_BUFFER, this.barycentricBuffer);

    const barycentricLoc = gl.getAttribLocation(this.program!, 'a_barycentric');
    gl.enableVertexAttribArray(barycentricLoc);
    gl.vertexAttribPointer(barycentricLoc, 3, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  destroy(): void {
    const gl = this.gl;
    if (this.program) gl.deleteProgram(this.program);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
    if (this.barycentricBuffer) gl.deleteBuffer(this.barycentricBuffer);
    this.stats.destroy();
  }

  render(ctx: DemoContext): void {
    if (this.isPaused || !this.program || !this.vao) return;

    const gl = this.gl;
    this.stats.beginFrame();

    // Clear
    gl.viewport(0, 0, ctx.width, ctx.height);
    gl.clearColor(0.02, 0.02, 0.05, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const aspect = ctx.width / ctx.height;
    mat4.perspective(this.projectionMatrix, Math.PI / 4, aspect, 0.1, 100.0);

    const time = ctx.reduceMotion ? ctx.time * 0.3 : ctx.time;
    const camRadius = 5;
    const camX = Math.sin(time * 0.3) * camRadius;
    const camZ = Math.cos(time * 0.3) * camRadius;
    const camY = Math.sin(time * 0.2) * 1.5;

    mat4.lookAt(this.viewMatrix, [camX, camY, camZ], [0, 0, 0], [0, 1, 0]);

    mat4.identity(this.modelMatrix);
    mat4.rotateY(this.modelMatrix, this.modelMatrix, time * 0.2);
    mat4.rotateX(this.modelMatrix, this.modelMatrix, time * 0.1);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.uniformMatrix4fv(this.uniforms.u_projection, false, this.projectionMatrix);
    gl.uniformMatrix4fv(this.uniforms.u_view, false, this.viewMatrix);
    gl.uniformMatrix4fv(this.uniforms.u_model, false, this.modelMatrix);
    gl.uniform1f(this.uniforms.u_time, time);
    gl.uniform1f(this.uniforms.u_edgeWidth, this.edgeWidth);
    gl.uniform1f(this.uniforms.u_fillOpacity, this.fillOpacity);
    gl.uniform3f(this.uniforms.u_edgeColor, 0.0, 0.8, 1.0);
    gl.uniform3f(this.uniforms.u_fillColor, 0.1, 0.2, 0.4);
    gl.uniform1i(this.uniforms.u_animate, this.animate ? 1 : 0);

    gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
    this.stats.recordDrawCall(this.vertexCount / 3);

    gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

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
    this.edgeWidth = 1.5;
    this.fillOpacity = 0.1;
    this.animate = true;
  }

  setParameter(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'edgeWidth':
        this.edgeWidth = value as number;
        break;
      case 'fillOpacity':
        this.fillOpacity = value as number;
        break;
      case 'animate':
        this.animate = value as boolean;
        break;
    }
  }

  getParameters(): Record<string, number | boolean | string> {
    return {
      edgeWidth: this.edgeWidth,
      fillOpacity: this.fillOpacity,
      animate: this.animate,
    };
  }

  getStats(): DemoStats {
    return this.stats.getStats();
  }
}

export const factory: DemoFactory = (gl: WebGL2RenderingContext) => new WireframeDemo(gl);
