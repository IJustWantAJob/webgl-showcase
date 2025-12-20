/**
 * Raymarching Basics Demo
 *
 * A raymarched 3D scene using signed distance functions (SDFs).
 * Features:
 * - Sphere and box SDF primitives
 * - Smooth minimum for blending
 * - Soft shadows
 * - Basic ambient occlusion
 */

import { createProgram, createVao, createBuffer, getUniformLocations } from '../../core';
import { StatsTracker } from '../../core/stats';
import type { DemoInstance, DemoContext, DemoStats, DemoFactory } from '../../core/types';

// Vertex shader - simple fullscreen triangle
const vertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// Fragment shader - raymarching
const fragmentShader = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform int u_maxSteps;
uniform bool u_softShadows;
uniform bool u_ao;
uniform float u_rotationSpeed;

const float MAX_DIST = 100.0;
const float SURF_DIST = 0.001;
const float PI = 3.14159265359;

// Rotation matrix around Y axis
mat3 rotateY(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat3(c, 0, s, 0, 1, 0, -s, 0, c);
}

// Rotation matrix around X axis
mat3 rotateX(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat3(1, 0, 0, 0, c, -s, 0, s, c);
}

// SDF primitives
float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

float sdCylinder(vec3 p, float h, float r) {
  vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

// Ground plane
float sdPlane(vec3 p, float h) {
  return p.y - h;
}

// Smooth min for blending shapes
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// Scene SDF
float sceneSDF(vec3 p, float time) {
  // Rotate the scene
  mat3 rot = rotateY(time * u_rotationSpeed);
  vec3 rp = rot * p;

  // Ground plane
  float ground = sdPlane(p, -1.0);

  // Central sphere
  float sphere = sdSphere(rp - vec3(0.0, 0.0, 0.0), 0.5);

  // Orbiting smaller spheres
  float orbitSpheres = MAX_DIST;
  for (int i = 0; i < 3; i++) {
    float angle = float(i) * 2.0 * PI / 3.0 + time * 0.5;
    vec3 offset = vec3(cos(angle) * 1.2, sin(time * 2.0 + float(i)) * 0.3, sin(angle) * 1.2);
    orbitSpheres = min(orbitSpheres, sdSphere(rp - offset, 0.2));
  }

  // Box
  float box = sdBox(rp - vec3(0.0, -0.5, 0.0), vec3(0.8, 0.2, 0.8));

  // Torus
  float torus = sdTorus(rp - vec3(0.0, 0.5, 0.0), vec2(0.6, 0.15));

  // Combine shapes
  float objects = smin(sphere, orbitSpheres, 0.3);
  objects = smin(objects, torus, 0.2);
  objects = smin(objects, box, 0.1);

  return min(objects, ground);
}

// Get material color based on position
vec3 getMaterial(vec3 p, float time) {
  mat3 rot = rotateY(time * u_rotationSpeed);
  vec3 rp = rot * p;

  // Ground
  if (p.y < -0.95) {
    float checker = mod(floor(p.x * 2.0) + floor(p.z * 2.0), 2.0);
    return mix(vec3(0.1), vec3(0.3), checker);
  }

  // Objects - color based on position
  vec3 baseColor = vec3(0.2, 0.4, 0.8);
  vec3 accentColor = vec3(0.9, 0.3, 0.4);

  float blend = 0.5 + 0.5 * sin(rp.y * 4.0 + time);
  return mix(baseColor, accentColor, blend);
}

// Calculate normal
vec3 getNormal(vec3 p, float time) {
  float e = 0.001;
  vec3 n;
  n.x = sceneSDF(p + vec3(e, 0, 0), time) - sceneSDF(p - vec3(e, 0, 0), time);
  n.y = sceneSDF(p + vec3(0, e, 0), time) - sceneSDF(p - vec3(0, e, 0), time);
  n.z = sceneSDF(p + vec3(0, 0, e), time) - sceneSDF(p - vec3(0, 0, e), time);
  return normalize(n);
}

// Raymarching
float raymarch(vec3 ro, vec3 rd, float time, int maxSteps) {
  float d = 0.0;
  for (int i = 0; i < 128; i++) {
    if (i >= maxSteps) break;
    vec3 p = ro + rd * d;
    float ds = sceneSDF(p, time);
    d += ds;
    if (ds < SURF_DIST || d > MAX_DIST) break;
  }
  return d;
}

// Soft shadows
float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k, float time) {
  float res = 1.0;
  float t = mint;
  for (int i = 0; i < 32; i++) {
    if (t >= maxt) break;
    float h = sceneSDF(ro + rd * t, time);
    if (h < 0.001) return 0.0;
    res = min(res, k * h / t);
    t += h;
  }
  return clamp(res, 0.0, 1.0);
}

// Ambient occlusion
float ambientOcclusion(vec3 p, vec3 n, float time) {
  float occ = 0.0;
  float sca = 1.0;
  for (int i = 0; i < 5; i++) {
    float h = 0.01 + 0.12 * float(i);
    float d = sceneSDF(p + n * h, time);
    occ += (h - d) * sca;
    sca *= 0.95;
  }
  return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
}

void main() {
  vec2 uv = v_uv * 2.0 - 1.0;
  float aspect = u_resolution.x / u_resolution.y;
  uv.x *= aspect;

  // Camera
  vec3 ro = vec3(0.0, 1.5, 4.0);

  // Mouse look - clamp vertical rotation to prevent camera flip
  vec2 mouse = (u_mouse - 0.5) * 2.0;
  mouse.y = clamp(mouse.y, -0.5, 0.7);  // Prevent looking too far down (causes black screen)
  mat3 camRotY = rotateY(-mouse.x * PI * 0.5);
  mat3 camRotX = rotateX(mouse.y * PI * 0.25);
  ro = camRotY * camRotX * ro;

  vec3 target = vec3(0.0, 0.0, 0.0);
  vec3 forward = normalize(target - ro);
  // Use a stable up vector that won't cause issues at extreme angles
  vec3 worldUp = vec3(0.0, 1.0, 0.0);
  vec3 right = normalize(cross(worldUp, forward));
  // Fallback if forward is nearly parallel to worldUp
  if (length(right) < 0.001) {
    right = vec3(1.0, 0.0, 0.0);
  }
  vec3 up = cross(forward, right);

  vec3 rd = normalize(forward + uv.x * right + uv.y * up);

  // Raymarch
  float d = raymarch(ro, rd, u_time, u_maxSteps);

  // Sky gradient
  vec3 skyColor = mix(vec3(0.1, 0.1, 0.2), vec3(0.02, 0.02, 0.05), uv.y * 0.5 + 0.5);
  vec3 col = skyColor;

  if (d < MAX_DIST) {
    vec3 p = ro + rd * d;
    vec3 n = getNormal(p, u_time);

    // Material
    vec3 material = getMaterial(p, u_time);

    // Lighting
    vec3 lightPos = vec3(3.0, 5.0, 2.0);
    vec3 lightDir = normalize(lightPos - p);

    // Diffuse
    float diff = max(dot(n, lightDir), 0.0);

    // Specular
    vec3 viewDir = normalize(ro - p);
    vec3 reflectDir = reflect(-lightDir, n);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);

    // Shadows
    float shadow = 1.0;
    if (u_softShadows) {
      shadow = softShadow(p + n * 0.01, lightDir, 0.02, length(lightPos - p), 16.0, u_time);
    }

    // Ambient occlusion
    float ao = 1.0;
    if (u_ao) {
      ao = ambientOcclusion(p, n, u_time);
    }

    // Combine lighting
    vec3 ambient = 0.2 * material;
    vec3 diffuseLight = diff * material * shadow;
    vec3 specularLight = spec * vec3(1.0) * shadow * 0.5;

    col = (ambient + diffuseLight + specularLight) * ao;

    // Fog
    float fog = 1.0 - exp(-d * 0.05);
    col = mix(col, skyColor, fog);
  }

  // Gamma correction
  col = pow(col, vec3(1.0 / 2.2));

  fragColor = vec4(col, 1.0);
}
`;

class RaymarchingDemo implements DemoInstance {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private buffer: WebGLBuffer | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private stats: StatsTracker;
  private isPaused = false;

  // Parameters
  private maxSteps = 64;
  private softShadows = true;
  private ao = true;
  private rotationSpeed = 0.3;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.stats = new StatsTracker(gl);
  }

  async init(): Promise<void> {
    const gl = this.gl;

    // Create shader program
    this.program = createProgram(gl, vertexShader, fragmentShader);
    if (!this.program) throw new Error('Failed to create raymarching shader program');

    // Get uniform locations
    this.uniforms = getUniformLocations(gl, this.program, [
      'u_time',
      'u_resolution',
      'u_mouse',
      'u_maxSteps',
      'u_softShadows',
      'u_ao',
      'u_rotationSpeed',
    ]);

    // Create fullscreen triangle
    const positions = new Float32Array([
      -1, -1,
       3, -1,
      -1,  3,
    ]);

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

    // Clear
    gl.viewport(0, 0, ctx.width, ctx.height);
    gl.clearColor(0.02, 0.02, 0.05, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Use program
    gl.useProgram(this.program);

    // Set uniforms
    gl.uniform1f(this.uniforms.u_time, ctx.time);
    gl.uniform2f(this.uniforms.u_resolution, ctx.width, ctx.height);
    gl.uniform2f(this.uniforms.u_mouse, ctx.mouseX, ctx.mouseY);
    gl.uniform1i(this.uniforms.u_maxSteps, this.maxSteps);
    gl.uniform1i(this.uniforms.u_softShadows, this.softShadows ? 1 : 0);
    gl.uniform1i(this.uniforms.u_ao, this.ao ? 1 : 0);
    gl.uniform1f(this.uniforms.u_rotationSpeed, ctx.reduceMotion ? 0.1 : this.rotationSpeed);

    // Draw fullscreen triangle
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.stats.recordDrawCall(1);
    gl.bindVertexArray(null);

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
    this.maxSteps = 64;
    this.softShadows = true;
    this.ao = true;
    this.rotationSpeed = 0.3;
  }

  setParameter(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'maxSteps':
        this.maxSteps = value as number;
        break;
      case 'softShadows':
        this.softShadows = value as boolean;
        break;
      case 'ao':
        this.ao = value as boolean;
        break;
      case 'rotationSpeed':
        this.rotationSpeed = value as number;
        break;
    }
  }

  getParameters(): Record<string, number | boolean | string> {
    return {
      maxSteps: this.maxSteps,
      softShadows: this.softShadows,
      ao: this.ao,
      rotationSpeed: this.rotationSpeed,
    };
  }

  getStats(): DemoStats {
    return this.stats.getStats();
  }
}

export const factory: DemoFactory = (gl: WebGL2RenderingContext) => new RaymarchingDemo(gl);
