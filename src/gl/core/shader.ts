/**
 * WebGL2 Shader Compilation Utilities
 *
 * Provides helpers for compiling vertex/fragment shaders and linking programs.
 */

/**
 * Compile a shader from source
 */
export function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Failed to create shader');
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation error: ${info}`);
  }

  return shader;
}

/**
 * Create and link a WebGL program from vertex and fragment shader sources
 */
export function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
  transformFeedbackVaryings?: string[]
): WebGLProgram {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error('Failed to create program');
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);

  // Set up transform feedback varyings before linking if specified
  if (transformFeedbackVaryings && transformFeedbackVaryings.length > 0) {
    gl.transformFeedbackVaryings(
      program,
      transformFeedbackVaryings,
      gl.INTERLEAVED_ATTRIBS
    );
  }

  gl.linkProgram(program);

  // Shaders can be deleted after linking
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program linking error: ${info}`);
  }

  return program;
}

/**
 * Get all uniform locations for a program
 */
export function getUniformLocations(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  names: string[]
): Record<string, WebGLUniformLocation | null> {
  const locations: Record<string, WebGLUniformLocation | null> = {};
  for (const name of names) {
    locations[name] = gl.getUniformLocation(program, name);
  }
  return locations;
}

/**
 * Get attribute location with error checking
 */
export function getAttribLocation(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string
): number {
  const location = gl.getAttribLocation(program, name);
  if (location === -1) {
    console.warn(`Attribute '${name}' not found in program`);
  }
  return location;
}
