/**
 * WebGL2 Buffer and VAO Utilities
 *
 * Provides helpers for creating buffers, VAOs, and setting up vertex attributes.
 */

import type { AttributeInfo } from './types';

/**
 * Create a buffer and upload data
 */
export function createBuffer(
  gl: WebGL2RenderingContext,
  data: ArrayBufferView | null,
  usage: number = gl.STATIC_DRAW,
  target: number = gl.ARRAY_BUFFER
): WebGLBuffer {
  const buffer = gl.createBuffer();
  if (!buffer) {
    throw new Error('Failed to create buffer');
  }

  gl.bindBuffer(target, buffer);
  if (data) {
    gl.bufferData(target, data, usage);
  }
  gl.bindBuffer(target, null);

  return buffer;
}

/**
 * Create an empty buffer with specified size
 */
export function createEmptyBuffer(
  gl: WebGL2RenderingContext,
  byteSize: number,
  usage: number = gl.DYNAMIC_DRAW,
  target: number = gl.ARRAY_BUFFER
): WebGLBuffer {
  const buffer = gl.createBuffer();
  if (!buffer) {
    throw new Error('Failed to create buffer');
  }

  gl.bindBuffer(target, buffer);
  gl.bufferData(target, byteSize, usage);
  gl.bindBuffer(target, null);

  return buffer;
}

/**
 * Update buffer data
 */
export function updateBuffer(
  gl: WebGL2RenderingContext,
  buffer: WebGLBuffer,
  data: ArrayBufferView,
  target: number = gl.ARRAY_BUFFER,
  offset: number = 0
): void {
  gl.bindBuffer(target, buffer);
  gl.bufferSubData(target, offset, data);
  gl.bindBuffer(target, null);
}

/**
 * Create a Vertex Array Object (VAO)
 */
export function createVao(gl: WebGL2RenderingContext): WebGLVertexArrayObject {
  const vao = gl.createVertexArray();
  if (!vao) {
    throw new Error('Failed to create VAO');
  }
  return vao;
}

/**
 * Set up a vertex attribute in the current VAO
 */
export function setupAttribute(
  gl: WebGL2RenderingContext,
  buffer: WebGLBuffer,
  attribInfo: AttributeInfo
): void {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(attribInfo.location);
  gl.vertexAttribPointer(
    attribInfo.location,
    attribInfo.size,
    attribInfo.type,
    attribInfo.normalized,
    attribInfo.stride,
    attribInfo.offset
  );

  // For instanced rendering
  if (attribInfo.divisor !== undefined) {
    gl.vertexAttribDivisor(attribInfo.location, attribInfo.divisor);
  }
}

/**
 * Create a fullscreen quad VAO for postprocessing
 * Vertices cover clip space -1 to 1, with UVs 0 to 1
 */
export function createFullscreenQuad(
  gl: WebGL2RenderingContext,
  positionLocation: number,
  uvLocation: number
): { vao: WebGLVertexArrayObject; buffer: WebGLBuffer } {
  // Fullscreen triangle (more efficient than quad, covers entire screen)
  // Using a large triangle that extends beyond the viewport
  const vertices = new Float32Array([
    // Position (x, y), UV (u, v)
    -1, -1, 0, 0,
     3, -1, 2, 0,
    -1,  3, 0, 2,
  ]);

  const vao = createVao(gl);
  gl.bindVertexArray(vao);

  const buffer = createBuffer(gl, vertices, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

  // Position attribute
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);

  // UV attribute
  gl.enableVertexAttribArray(uvLocation);
  gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 16, 8);

  gl.bindVertexArray(null);

  return { vao, buffer };
}

/**
 * Create an index buffer (element array buffer)
 */
export function createIndexBuffer(
  gl: WebGL2RenderingContext,
  indices: Uint16Array | Uint32Array
): WebGLBuffer {
  const buffer = gl.createBuffer();
  if (!buffer) {
    throw new Error('Failed to create index buffer');
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  return buffer;
}
