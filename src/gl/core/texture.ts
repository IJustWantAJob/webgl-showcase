/**
 * WebGL2 Texture and Framebuffer Utilities
 *
 * Provides helpers for creating textures and framebuffer objects for render-to-texture.
 */

import type { FramebufferInfo } from './types';

/**
 * Create an empty texture for render-to-texture operations
 */
export function createTexture(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  internalFormat: number = gl.RGBA8,
  _format: number = gl.RGBA,
  _type: number = gl.UNSIGNED_BYTE,
  filter: number = gl.LINEAR,
  wrap: number = gl.CLAMP_TO_EDGE
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error('Failed to create texture');
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Use texStorage2D for immutable texture allocation (WebGL2)
  gl.texStorage2D(gl.TEXTURE_2D, 1, internalFormat, width, height);

  // Set texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);

  gl.bindTexture(gl.TEXTURE_2D, null);

  return texture;
}

/**
 * Create a texture with mutable storage (allows resizing)
 */
export function createMutableTexture(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  internalFormat: number = gl.RGBA,
  format: number = gl.RGBA,
  type: number = gl.UNSIGNED_BYTE,
  filter: number = gl.LINEAR,
  wrap: number = gl.CLAMP_TO_EDGE
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error('Failed to create texture');
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Use texImage2D for mutable texture
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);

  // Set texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);

  gl.bindTexture(gl.TEXTURE_2D, null);

  return texture;
}

/**
 * Resize a mutable texture
 */
export function resizeTexture(
  gl: WebGL2RenderingContext,
  texture: WebGLTexture,
  width: number,
  height: number,
  internalFormat: number = gl.RGBA,
  format: number = gl.RGBA,
  type: number = gl.UNSIGNED_BYTE
): void {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
}

/**
 * Create a framebuffer with an attached color texture
 */
export function createFramebufferWithTexture(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  useDepth: boolean = false
): FramebufferInfo {
  const framebuffer = gl.createFramebuffer();
  if (!framebuffer) {
    throw new Error('Failed to create framebuffer');
  }

  // Create color texture using mutable storage for easier resizing
  const texture = createMutableTexture(gl, width, height);

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0
  );

  // Optionally add depth buffer
  if (useDepth) {
    const depthBuffer = gl.createRenderbuffer();
    if (depthBuffer) {
      gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
      gl.framebufferRenderbuffer(
        gl.FRAMEBUFFER,
        gl.DEPTH_ATTACHMENT,
        gl.RENDERBUFFER,
        depthBuffer
      );
    }
  }

  // Check framebuffer completeness
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error(`Framebuffer incomplete: ${status}`);
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return { framebuffer, texture, width, height };
}

/**
 * Resize a framebuffer and its attached texture
 */
export function resizeFramebuffer(
  gl: WebGL2RenderingContext,
  fboInfo: FramebufferInfo,
  width: number,
  height: number
): void {
  resizeTexture(gl, fboInfo.texture, width, height);
  fboInfo.width = width;
  fboInfo.height = height;
}

/**
 * Bind a framebuffer for rendering
 */
export function bindFramebuffer(
  gl: WebGL2RenderingContext,
  fboInfo: FramebufferInfo | null
): void {
  if (fboInfo) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboInfo.framebuffer);
    gl.viewport(0, 0, fboInfo.width, fboInfo.height);
  } else {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
}
