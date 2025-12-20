/**
 * 3D Primitives Demo
 *
 * Classic 3D primitives with Phong lighting and interactive camera.
 */

import { mat4, vec3 } from 'gl-matrix';
import { createProgram, createVao, createBuffer, getUniformLocations } from '../../core';
import { StatsTracker } from '../../core/stats';
import type { DemoInstance, DemoContext, DemoStats, DemoFactory } from '../../core/types';

const vertexShader = `#version 300 es
precision highp float;

in vec3 a_position;
in vec3 a_normal;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_model;
uniform mat3 u_normalMatrix;

out vec3 v_normal;
out vec3 v_position;

void main() {
  v_normal = u_normalMatrix * a_normal;
  v_position = (u_model * vec4(a_position, 1.0)).xyz;
  gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);
}
`;

const fragmentShader = `#version 300 es
precision highp float;

in vec3 v_normal;
in vec3 v_position;

uniform vec3 u_viewPos;
uniform vec3 u_color;
uniform bool u_wireframe;

out vec4 fragColor;

void main() {
  if (u_wireframe) {
    fragColor = vec4(u_color, 1.0);
    return;
  }

  vec3 normal = normalize(v_normal);

  // Light positions
  vec3 light1Pos = vec3(5.0, 5.0, 5.0);
  vec3 light2Pos = vec3(-5.0, 3.0, -5.0);

  vec3 light1Color = vec3(1.0, 0.95, 0.9);
  vec3 light2Color = vec3(0.6, 0.7, 1.0);

  // Ambient
  vec3 ambient = 0.15 * u_color;

  // Light 1
  vec3 lightDir1 = normalize(light1Pos - v_position);
  float diff1 = max(dot(normal, lightDir1), 0.0);
  vec3 diffuse1 = diff1 * u_color * light1Color;

  vec3 viewDir = normalize(u_viewPos - v_position);
  vec3 reflectDir1 = reflect(-lightDir1, normal);
  float spec1 = pow(max(dot(viewDir, reflectDir1), 0.0), 32.0);
  vec3 specular1 = spec1 * light1Color * 0.5;

  // Light 2
  vec3 lightDir2 = normalize(light2Pos - v_position);
  float diff2 = max(dot(normal, lightDir2), 0.0);
  vec3 diffuse2 = diff2 * u_color * light2Color * 0.5;

  vec3 reflectDir2 = reflect(-lightDir2, normal);
  float spec2 = pow(max(dot(viewDir, reflectDir2), 0.0), 32.0);
  vec3 specular2 = spec2 * light2Color * 0.3;

  vec3 result = ambient + diffuse1 + specular1 + diffuse2 + specular2;

  // Gamma correction
  result = pow(result, vec3(1.0 / 2.2));

  fragColor = vec4(result, 1.0);
}
`;

// Geometry generators
function createCubeGeometry(): { positions: Float32Array; normals: Float32Array } {
  const positions: number[] = [];
  const normals: number[] = [];

  const faces = [
    { dir: [0, 0, 1], corners: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
    { dir: [0, 0, -1], corners: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
    { dir: [0, 1, 0], corners: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
    { dir: [0, -1, 0], corners: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
    { dir: [1, 0, 0], corners: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
    { dir: [-1, 0, 0], corners: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  ];

  for (const face of faces) {
    const c = face.corners;
    const indices = [0, 1, 2, 0, 2, 3];
    for (const i of indices) {
      positions.push(...c[i]);
      normals.push(...face.dir);
    }
  }

  return { positions: new Float32Array(positions), normals: new Float32Array(normals) };
}

function createSphereGeometry(segments = 32): { positions: Float32Array; normals: Float32Array } {
  const positions: number[] = [];
  const normals: number[] = [];

  for (let lat = 0; lat < segments; lat++) {
    const theta1 = (lat / segments) * Math.PI;
    const theta2 = ((lat + 1) / segments) * Math.PI;

    for (let lon = 0; lon < segments; lon++) {
      const phi1 = (lon / segments) * 2 * Math.PI;
      const phi2 = ((lon + 1) / segments) * 2 * Math.PI;

      const p1 = [Math.sin(theta1) * Math.cos(phi1), Math.cos(theta1), Math.sin(theta1) * Math.sin(phi1)];
      const p2 = [Math.sin(theta2) * Math.cos(phi1), Math.cos(theta2), Math.sin(theta2) * Math.sin(phi1)];
      const p3 = [Math.sin(theta2) * Math.cos(phi2), Math.cos(theta2), Math.sin(theta2) * Math.sin(phi2)];
      const p4 = [Math.sin(theta1) * Math.cos(phi2), Math.cos(theta1), Math.sin(theta1) * Math.sin(phi2)];

      positions.push(...p1, ...p2, ...p3, ...p1, ...p3, ...p4);
      normals.push(...p1, ...p2, ...p3, ...p1, ...p3, ...p4);
    }
  }

  return { positions: new Float32Array(positions), normals: new Float32Array(normals) };
}

function createTorusGeometry(majorR = 1, minorR = 0.4, segments = 32): { positions: Float32Array; normals: Float32Array } {
  const positions: number[] = [];
  const normals: number[] = [];

  for (let i = 0; i < segments; i++) {
    const theta1 = (i / segments) * 2 * Math.PI;
    const theta2 = ((i + 1) / segments) * 2 * Math.PI;

    for (let j = 0; j < segments; j++) {
      const phi1 = (j / segments) * 2 * Math.PI;
      const phi2 = ((j + 1) / segments) * 2 * Math.PI;

      const getPoint = (theta: number, phi: number) => {
        const x = (majorR + minorR * Math.cos(phi)) * Math.cos(theta);
        const y = minorR * Math.sin(phi);
        const z = (majorR + minorR * Math.cos(phi)) * Math.sin(theta);
        return [x, y, z];
      };

      const getNormal = (theta: number, phi: number) => {
        const x = Math.cos(phi) * Math.cos(theta);
        const y = Math.sin(phi);
        const z = Math.cos(phi) * Math.sin(theta);
        return [x, y, z];
      };

      const p1 = getPoint(theta1, phi1);
      const p2 = getPoint(theta2, phi1);
      const p3 = getPoint(theta2, phi2);
      const p4 = getPoint(theta1, phi2);

      const n1 = getNormal(theta1, phi1);
      const n2 = getNormal(theta2, phi1);
      const n3 = getNormal(theta2, phi2);
      const n4 = getNormal(theta1, phi2);

      positions.push(...p1, ...p2, ...p3, ...p1, ...p3, ...p4);
      normals.push(...n1, ...n2, ...n3, ...n1, ...n3, ...n4);
    }
  }

  return { positions: new Float32Array(positions), normals: new Float32Array(normals) };
}

class Primitives3DDemo implements DemoInstance {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private cubeVao: WebGLVertexArrayObject | null = null;
  private sphereVao: WebGLVertexArrayObject | null = null;
  private torusVao: WebGLVertexArrayObject | null = null;
  private cubeVertexCount = 0;
  private sphereVertexCount = 0;
  private torusVertexCount = 0;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private stats: StatsTracker;
  private isPaused = false;

  private projectionMatrix = mat4.create();
  private viewMatrix = mat4.create();
  private modelMatrix = mat4.create();
  private normalMatrix = mat4.create();

  private shape = 'torus';
  private autoRotate = true;
  private wireframe = false;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.stats = new StatsTracker(gl);
  }

  async init(): Promise<void> {
    const gl = this.gl;

    this.program = createProgram(gl, vertexShader, fragmentShader);
    if (!this.program) throw new Error('Failed to create 3D primitives shader');

    this.uniforms = getUniformLocations(gl, this.program, [
      'u_projection', 'u_view', 'u_model', 'u_normalMatrix', 'u_viewPos', 'u_color', 'u_wireframe',
    ]);

    // Create geometries
    const cube = createCubeGeometry();
    this.cubeVao = this.createVAO(cube.positions, cube.normals);
    this.cubeVertexCount = cube.positions.length / 3;

    const sphere = createSphereGeometry(24);
    this.sphereVao = this.createVAO(sphere.positions, sphere.normals);
    this.sphereVertexCount = sphere.positions.length / 3;

    const torus = createTorusGeometry(1, 0.4, 32);
    this.torusVao = this.createVAO(torus.positions, torus.normals);
    this.torusVertexCount = torus.positions.length / 3;
  }

  private createVAO(positions: Float32Array, normals: Float32Array): WebGLVertexArrayObject {
    const gl = this.gl;

    const vao = createVao(gl);
    gl.bindVertexArray(vao);

    const posBuffer = createBuffer(gl, positions);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    const posLoc = gl.getAttribLocation(this.program!, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

    const normBuffer = createBuffer(gl, normals);
    gl.bindBuffer(gl.ARRAY_BUFFER, normBuffer);
    const normLoc = gl.getAttribLocation(this.program!, 'a_normal');
    gl.enableVertexAttribArray(normLoc);
    gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
    return vao!;
  }

  destroy(): void {
    const gl = this.gl;
    if (this.program) gl.deleteProgram(this.program);
    if (this.cubeVao) gl.deleteVertexArray(this.cubeVao);
    if (this.sphereVao) gl.deleteVertexArray(this.sphereVao);
    if (this.torusVao) gl.deleteVertexArray(this.torusVao);
    this.stats.destroy();
  }

  render(ctx: DemoContext): void {
    if (this.isPaused || !this.program) return;

    const gl = this.gl;
    this.stats.beginFrame();

    gl.viewport(0, 0, ctx.width, ctx.height);
    gl.clearColor(0.05, 0.05, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    const aspect = ctx.width / ctx.height;
    mat4.perspective(this.projectionMatrix, Math.PI / 4, aspect, 0.1, 100.0);

    const time = ctx.reduceMotion ? ctx.time * 0.3 : ctx.time;
    const camRadius = 5;
    const camX = Math.sin(time * 0.3) * camRadius;
    const camZ = Math.cos(time * 0.3) * camRadius;
    const camY = 2 + Math.sin(time * 0.2);

    mat4.lookAt(this.viewMatrix, [camX, camY, camZ], [0, 0, 0], [0, 1, 0]);

    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uniforms.u_projection, false, this.projectionMatrix);
    gl.uniformMatrix4fv(this.uniforms.u_view, false, this.viewMatrix);
    gl.uniform3f(this.uniforms.u_viewPos, camX, camY, camZ);
    gl.uniform1i(this.uniforms.u_wireframe, this.wireframe ? 1 : 0);

    const shapes = this.shape === 'all' ? ['cube', 'sphere', 'torus'] : [this.shape];
    const colors: Record<string, [number, number, number]> = {
      cube: [0.9, 0.3, 0.3],
      sphere: [0.3, 0.9, 0.3],
      torus: [0.3, 0.5, 0.9],
    };
    const offsets: Record<string, [number, number, number]> = {
      cube: this.shape === 'all' ? [-2.5, 0, 0] : [0, 0, 0],
      sphere: this.shape === 'all' ? [0, 0, 0] : [0, 0, 0],
      torus: this.shape === 'all' ? [2.5, 0, 0] : [0, 0, 0],
    };

    for (const shape of shapes) {
      mat4.identity(this.modelMatrix);
      mat4.translate(this.modelMatrix, this.modelMatrix, offsets[shape] as vec3);
      if (this.autoRotate) {
        mat4.rotateY(this.modelMatrix, this.modelMatrix, time * 0.5);
        mat4.rotateX(this.modelMatrix, this.modelMatrix, time * 0.3);
      }

      mat4.invert(this.normalMatrix, this.modelMatrix);
      mat4.transpose(this.normalMatrix, this.normalMatrix);

      gl.uniformMatrix4fv(this.uniforms.u_model, false, this.modelMatrix);
      gl.uniformMatrix3fv(this.uniforms.u_normalMatrix, false, [
        this.normalMatrix[0], this.normalMatrix[1], this.normalMatrix[2],
        this.normalMatrix[4], this.normalMatrix[5], this.normalMatrix[6],
        this.normalMatrix[8], this.normalMatrix[9], this.normalMatrix[10],
      ]);
      gl.uniform3fv(this.uniforms.u_color, colors[shape]);

      let vao: WebGLVertexArrayObject | null;
      let count: number;

      switch (shape) {
        case 'cube': vao = this.cubeVao; count = this.cubeVertexCount; break;
        case 'sphere': vao = this.sphereVao; count = this.sphereVertexCount; break;
        default: vao = this.torusVao; count = this.torusVertexCount; break;
      }

      gl.bindVertexArray(vao);
      if (this.wireframe) {
        for (let i = 0; i < count; i += 3) {
          gl.drawArrays(gl.LINE_LOOP, i, 3);
        }
      } else {
        gl.drawArrays(gl.TRIANGLES, 0, count);
      }
      this.stats.recordDrawCall(count / 3);
    }

    gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST);
    this.stats.endFrame();
  }

  resize(): void {}
  pause(): void { this.isPaused = true; }
  resume(): void { this.isPaused = false; }

  reset(): void {
    this.shape = 'torus';
    this.autoRotate = true;
    this.wireframe = false;
  }

  setParameter(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'shape': this.shape = value as string; break;
      case 'autoRotate': this.autoRotate = value as boolean; break;
      case 'wireframe': this.wireframe = value as boolean; break;
    }
  }

  getParameters(): Record<string, number | boolean | string> {
    return { shape: this.shape, autoRotate: this.autoRotate, wireframe: this.wireframe };
  }

  getStats(): DemoStats { return this.stats.getStats(); }
}

export const factory: DemoFactory = (gl: WebGL2RenderingContext) => new Primitives3DDemo(gl);
