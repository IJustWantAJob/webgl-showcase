/**
 * Portal Render-to-Texture Demo
 *
 * Renders a 3D scene into an offscreen framebuffer, then displays it
 * with postprocessing effects (bloom + color grading).
 *
 * Features:
 * - Offscreen rendering to framebuffer texture
 * - Multi-pass postprocessing pipeline
 * - Bloom effect with gaussian blur
 * - Color grading / chromatic aberration
 */

import { mat4 } from 'gl-matrix';
import {
  createProgram,
  createBuffer,
  getUniformLocations,
  createFramebufferWithTexture,
  resizeFramebuffer,
} from '../../core';
import { StatsTracker } from '../../core/stats';
import { isPostprocessEnabled } from '../../core/qualityPresets';
import type { DemoInstance, DemoContext, DemoStats, DemoFactory, FramebufferInfo } from '../../core/types';

// Scene shaders
const sceneVertexShader = `#version 300 es
precision highp float;

in vec3 a_position;
in vec3 a_normal;
in vec3 a_color;

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;
uniform float u_time;

out vec3 v_normal;
out vec3 v_color;
out vec3 v_worldPos;

void main() {
  vec3 pos = a_position;
  pos += a_normal * sin(u_time * 3.0 + length(a_position) * 2.0) * 0.1;

  vec4 worldPos = u_model * vec4(pos, 1.0);
  v_worldPos = worldPos.xyz;
  v_normal = mat3(u_model) * a_normal;
  v_color = a_color;

  gl_Position = u_projection * u_view * worldPos;
}
`;

const sceneFragmentShader = `#version 300 es
precision highp float;

in vec3 v_normal;
in vec3 v_color;
in vec3 v_worldPos;

uniform float u_time;
uniform vec3 u_lightPos;

out vec4 fragColor;

void main() {
  vec3 normal = normalize(v_normal);
  vec3 lightDir = normalize(u_lightPos - v_worldPos);

  vec3 ambient = v_color * 0.2;
  float diff = max(dot(normal, lightDir), 0.0);
  vec3 diffuse = v_color * diff;

  vec3 viewDir = normalize(-v_worldPos);
  vec3 reflectDir = reflect(-lightDir, normal);
  float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
  vec3 specular = vec3(1.0) * spec * 0.5;

  float rim = 1.0 - max(dot(viewDir, normal), 0.0);
  rim = pow(rim, 3.0);
  vec3 rimColor = v_color * rim * 0.5;

  vec3 color = ambient + diffuse + specular + rimColor;
  float emissive = smoothstep(0.7, 1.0, length(v_color)) * 0.5;
  color += v_color * emissive;

  fragColor = vec4(color, 1.0);
}
`;

// Postprocess shaders
const postVertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_uv;

out vec2 v_uv;

void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const postFragmentShader = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_bloomIntensity;
uniform float u_aberration;
uniform float u_saturation;
uniform bool u_enableBloom;

const float weights[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);

vec3 blur(sampler2D tex, vec2 uv, vec2 direction) {
  vec2 texelSize = 1.0 / u_resolution;
  vec3 result = texture(tex, uv).rgb * weights[0];
  for (int i = 1; i < 5; i++) {
    vec2 offset = direction * texelSize * float(i) * 2.0;
    result += texture(tex, uv + offset).rgb * weights[i];
    result += texture(tex, uv - offset).rgb * weights[i];
  }
  return result;
}

void main() {
  vec2 uv = v_uv;
  vec3 color = texture(u_texture, uv).rgb;

  if (u_enableBloom) {
    vec3 blurH = blur(u_texture, uv, vec2(1.0, 0.0));
    vec3 blurV = blur(u_texture, uv, vec2(0.0, 1.0));
    vec3 bloom = (blurH + blurV) * 0.5;
    vec3 brightColor = max(color - vec3(0.5), vec3(0.0));
    bloom = bloom * length(brightColor) * 1.5;
    color += bloom * u_bloomIntensity;
  }

  // Chromatic aberration
  float aberration = u_aberration + sin(u_time * 0.5) * 0.001;
  float r = texture(u_texture, uv + vec2(aberration, 0.0)).r;
  float b = texture(u_texture, uv - vec2(aberration, 0.0)).b;
  color.r = mix(color.r, r, 0.3);
  color.b = mix(color.b, b, 0.3);

  // Saturation
  float luminance = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luminance), color, u_saturation);

  // Tone mapping
  color = color / (color + vec3(1.0));
  color = (color - 0.5) * 1.2 + 0.5;

  // Vignette
  float vignette = 1.0 - length(uv - 0.5) * 0.6;
  vignette = smoothstep(0.2, 1.0, vignette);
  color *= vignette;

  // Film grain
  float grain = fract(sin(dot(uv * u_resolution, vec2(12.9898, 78.233)) + u_time * 100.0) * 43758.5453);
  color += (grain - 0.5) * 0.03;

  fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

// Geometry helpers
function createIcosahedronGeometry() {
  const phi = (1 + Math.sqrt(5)) / 2;
  const vertices = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]
  ];
  for (const v of vertices) {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    v[0] /= len; v[1] /= len; v[2] /= len;
  }
  const faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
  ];
  const palette = [[1.0, 0.3, 0.5], [0.3, 0.8, 1.0], [0.5, 0.2, 1.0], [1.0, 0.7, 0.2], [0.2, 1.0, 0.6]];
  const positions: number[] = [], normals: number[] = [], colors: number[] = [];

  for (let i = 0; i < faces.length; i++) {
    const face = faces[i];
    const v0 = vertices[face[0]], v1 = vertices[face[1]], v2 = vertices[face[2]];
    const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
    const e2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
    const normal = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const len = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
    normal[0] /= len; normal[1] /= len; normal[2] /= len;
    const color = palette[i % palette.length];
    for (const v of [v0, v1, v2]) {
      positions.push(v[0], v[1], v[2]);
      normals.push(normal[0], normal[1], normal[2]);
      colors.push(color[0], color[1], color[2]);
    }
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), colors: new Float32Array(colors) };
}

function createTorusGeometry(majorRadius: number, minorRadius: number, majorSegments: number, minorSegments: number) {
  const positions: number[] = [], normals: number[] = [], colors: number[] = [];
  const palette = [[0.0, 0.9, 0.7], [0.9, 0.2, 0.6], [0.2, 0.5, 1.0]];

  for (let i = 0; i < majorSegments; i++) {
    const theta1 = (i / majorSegments) * Math.PI * 2;
    const theta2 = ((i + 1) / majorSegments) * Math.PI * 2;
    for (let j = 0; j < minorSegments; j++) {
      const phi1 = (j / minorSegments) * Math.PI * 2;
      const phi2 = ((j + 1) / minorSegments) * Math.PI * 2;
      const getVertex = (theta: number, phi: number) => [
        (majorRadius + minorRadius * Math.cos(phi)) * Math.cos(theta),
        (majorRadius + minorRadius * Math.cos(phi)) * Math.sin(theta),
        minorRadius * Math.sin(phi)
      ];
      const getNormal = (theta: number, phi: number) => [
        Math.cos(phi) * Math.cos(theta), Math.cos(phi) * Math.sin(theta), Math.sin(phi)
      ];
      const v00 = getVertex(theta1, phi1), v10 = getVertex(theta2, phi1);
      const v01 = getVertex(theta1, phi2), v11 = getVertex(theta2, phi2);
      const n00 = getNormal(theta1, phi1), n10 = getNormal(theta2, phi1);
      const n01 = getNormal(theta1, phi2), n11 = getNormal(theta2, phi2);
      const color = palette[(i + j) % palette.length];
      positions.push(...v00, ...v10, ...v01);
      normals.push(...n00, ...n10, ...n01);
      colors.push(...color, ...color, ...color);
      positions.push(...v10, ...v11, ...v01);
      normals.push(...n10, ...n11, ...n01);
      colors.push(...color, ...color, ...color);
    }
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), colors: new Float32Array(colors) };
}

class PortalRTTDemo implements DemoInstance {
  private gl: WebGL2RenderingContext;
  private sceneProgram: WebGLProgram | null = null;
  private postProgram: WebGLProgram | null = null;
  private sceneUniforms: Record<string, WebGLUniformLocation | null> = {};
  private postUniforms: Record<string, WebGLUniformLocation | null> = {};
  private icosahedronMesh: { vao: WebGLVertexArrayObject; vertexCount: number; buffers: WebGLBuffer[] } | null = null;
  private torusMesh: { vao: WebGLVertexArrayObject; vertexCount: number; buffers: WebGLBuffer[] } | null = null;
  private quadVao: WebGLVertexArrayObject | null = null;
  private quadBuffer: WebGLBuffer | null = null;
  private fbo: FramebufferInfo | null = null;
  private fboSize = 512;
  private stats: StatsTracker;
  private isPaused = false;

  private modelMatrix = mat4.create();
  private viewMatrix = mat4.create();
  private projectionMatrix = mat4.create();

  // Parameters
  private bloomIntensity = 0.4;
  private aberration = 0.002;
  private saturation = 1.3;
  private cameraSpeed = 1.0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.stats = new StatsTracker(gl);
  }

  init(): void {
    const gl = this.gl;

    this.sceneProgram = createProgram(gl, sceneVertexShader, sceneFragmentShader);
    this.postProgram = createProgram(gl, postVertexShader, postFragmentShader);

    this.sceneUniforms = getUniformLocations(gl, this.sceneProgram, [
      'u_model', 'u_view', 'u_projection', 'u_time', 'u_lightPos'
    ]);
    this.postUniforms = getUniformLocations(gl, this.postProgram, [
      'u_texture', 'u_resolution', 'u_time', 'u_bloomIntensity', 'u_aberration', 'u_saturation', 'u_enableBloom'
    ]);

    // Create meshes
    const icosahedron = createIcosahedronGeometry();
    const torus = createTorusGeometry(0.7, 0.25, 32, 16);

    this.icosahedronMesh = this.createMeshVao(icosahedron.positions, icosahedron.normals, icosahedron.colors);
    this.torusMesh = this.createMeshVao(torus.positions, torus.normals, torus.colors);

    // Create quad for postprocess
    const quadVertices = new Float32Array([
      -1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, -1, 1, 0, 1, 1, 1, 1, -1, 1, 0, 1,
    ]);
    this.quadVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.quadVao);
    this.quadBuffer = createBuffer(gl, quadVertices);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    const quadPosLoc = gl.getAttribLocation(this.postProgram, 'a_position');
    gl.enableVertexAttribArray(quadPosLoc);
    gl.vertexAttribPointer(quadPosLoc, 2, gl.FLOAT, false, 16, 0);
    const quadUvLoc = gl.getAttribLocation(this.postProgram, 'a_uv');
    gl.enableVertexAttribArray(quadUvLoc);
    gl.vertexAttribPointer(quadUvLoc, 2, gl.FLOAT, false, 16, 8);
    gl.bindVertexArray(null);

    this.fbo = createFramebufferWithTexture(gl, this.fboSize, this.fboSize, true);
  }

  private createMeshVao(positions: Float32Array, normals: Float32Array, colors: Float32Array) {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);

    const posBuffer = createBuffer(gl, positions);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    const posLoc = gl.getAttribLocation(this.sceneProgram!, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

    const normBuffer = createBuffer(gl, normals);
    gl.bindBuffer(gl.ARRAY_BUFFER, normBuffer);
    const normLoc = gl.getAttribLocation(this.sceneProgram!, 'a_normal');
    gl.enableVertexAttribArray(normLoc);
    gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 0, 0);

    const colorBuffer = createBuffer(gl, colors);
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    const colorLoc = gl.getAttribLocation(this.sceneProgram!, 'a_color');
    gl.enableVertexAttribArray(colorLoc);
    gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
    return { vao, vertexCount: positions.length / 3, buffers: [posBuffer, normBuffer, colorBuffer] };
  }

  destroy(): void {
    const gl = this.gl;
    if (this.sceneProgram) gl.deleteProgram(this.sceneProgram);
    if (this.postProgram) gl.deleteProgram(this.postProgram);
    if (this.icosahedronMesh) {
      gl.deleteVertexArray(this.icosahedronMesh.vao);
      this.icosahedronMesh.buffers.forEach(b => gl.deleteBuffer(b));
    }
    if (this.torusMesh) {
      gl.deleteVertexArray(this.torusMesh.vao);
      this.torusMesh.buffers.forEach(b => gl.deleteBuffer(b));
    }
    if (this.quadVao) gl.deleteVertexArray(this.quadVao);
    if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer);
    if (this.fbo) {
      gl.deleteFramebuffer(this.fbo.framebuffer);
      gl.deleteTexture(this.fbo.texture);
    }
    this.stats.destroy();
  }

  render(ctx: DemoContext): void {
    if (this.isPaused || !this.fbo) return;

    const gl = this.gl;
    this.stats.beginFrame();

    const time = ctx.reduceMotion ? ctx.time * 0.3 : ctx.time;
    const enableBloom = isPostprocessEnabled(ctx.quality);

    // Pass 1: Render scene to FBO
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo.framebuffer);
    gl.viewport(0, 0, this.fbo.width, this.fbo.height);
    this.renderScene(time);

    // Pass 2: Postprocess to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, ctx.width, ctx.height);
    gl.disable(gl.DEPTH_TEST);

    gl.useProgram(this.postProgram);
    gl.bindVertexArray(this.quadVao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fbo.texture);
    gl.uniform1i(this.postUniforms.u_texture, 0);
    gl.uniform2f(this.postUniforms.u_resolution, ctx.width, ctx.height);
    gl.uniform1f(this.postUniforms.u_time, time);
    gl.uniform1f(this.postUniforms.u_bloomIntensity, this.bloomIntensity);
    gl.uniform1f(this.postUniforms.u_aberration, this.aberration);
    gl.uniform1f(this.postUniforms.u_saturation, this.saturation);
    gl.uniform1i(this.postUniforms.u_enableBloom, enableBloom ? 1 : 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.stats.recordDrawCall(2);

    gl.bindVertexArray(null);
    this.stats.endFrame();
  }

  private renderScene(time: number): void {
    const gl = this.gl;
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.02, 0.02, 0.05, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.sceneProgram);

    mat4.perspective(this.projectionMatrix, Math.PI / 3, 1.0, 0.1, 100.0);

    const camDist = 4;
    const camX = Math.sin(time * 0.5 * this.cameraSpeed) * camDist;
    const camZ = Math.cos(time * 0.5 * this.cameraSpeed) * camDist;
    const camY = Math.sin(time * 0.3 * this.cameraSpeed) * 1.5;
    mat4.lookAt(this.viewMatrix, [camX, camY, camZ], [0, 0, 0], [0, 1, 0]);

    gl.uniformMatrix4fv(this.sceneUniforms.u_view, false, this.viewMatrix);
    gl.uniformMatrix4fv(this.sceneUniforms.u_projection, false, this.projectionMatrix);
    gl.uniform1f(this.sceneUniforms.u_time, time);

    const lightX = Math.sin(time * 1.5) * 3;
    const lightY = 2 + Math.cos(time * 0.7) * 1;
    const lightZ = Math.cos(time * 1.2) * 3;
    gl.uniform3f(this.sceneUniforms.u_lightPos, lightX, lightY, lightZ);

    // Draw icosahedron
    mat4.identity(this.modelMatrix);
    mat4.rotateY(this.modelMatrix, this.modelMatrix, time * 0.7);
    mat4.rotateX(this.modelMatrix, this.modelMatrix, time * 0.5);
    mat4.scale(this.modelMatrix, this.modelMatrix, [0.8, 0.8, 0.8]);
    gl.uniformMatrix4fv(this.sceneUniforms.u_model, false, this.modelMatrix);
    gl.bindVertexArray(this.icosahedronMesh!.vao);
    gl.drawArrays(gl.TRIANGLES, 0, this.icosahedronMesh!.vertexCount);

    // Draw torus
    mat4.identity(this.modelMatrix);
    mat4.rotateZ(this.modelMatrix, this.modelMatrix, time * 0.3);
    mat4.rotateY(this.modelMatrix, this.modelMatrix, time * 0.4);
    mat4.scale(this.modelMatrix, this.modelMatrix, [1.2, 1.2, 1.2]);
    gl.uniformMatrix4fv(this.sceneUniforms.u_model, false, this.modelMatrix);
    gl.bindVertexArray(this.torusMesh!.vao);
    gl.drawArrays(gl.TRIANGLES, 0, this.torusMesh!.vertexCount);

    gl.bindVertexArray(null);
  }

  resize(width: number, height: number, _dpr: number): void {
    const newFboSize = Math.min(Math.max(width, height), 1024);
    if (Math.abs(newFboSize - this.fboSize) > 100 && this.fbo) {
      this.fboSize = newFboSize;
      resizeFramebuffer(this.gl, this.fbo, this.fboSize, this.fboSize);
    }
  }

  pause(): void { this.isPaused = true; }
  resume(): void { this.isPaused = false; }

  reset(): void {
    this.bloomIntensity = 0.4;
    this.aberration = 0.002;
    this.saturation = 1.3;
    this.cameraSpeed = 1.0;
  }

  setParameter(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'bloomIntensity': this.bloomIntensity = value as number; break;
      case 'aberration': this.aberration = value as number; break;
      case 'saturation': this.saturation = value as number; break;
      case 'cameraSpeed': this.cameraSpeed = value as number; break;
    }
  }

  getParameters(): Record<string, number | boolean | string> {
    return {
      bloomIntensity: this.bloomIntensity,
      aberration: this.aberration,
      saturation: this.saturation,
      cameraSpeed: this.cameraSpeed,
    };
  }

  getStats(): DemoStats {
    return this.stats.getStats();
  }
}

export const factory: DemoFactory = (gl: WebGL2RenderingContext) => new PortalRTTDemo(gl);
