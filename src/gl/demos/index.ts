/**
 * WebGL2 Demos Index
 *
 * Re-exports demo factories from their category folders.
 * The main registry uses dynamic imports, so this file is
 * primarily for convenience if importing directly.
 */

// Shader demos
export { factory as nebulaFactory } from './shaders/nebula';

// Performance demos
export { factory as instancedFactory } from './performance/instanced';
export { factory as portalRttFactory } from './performance/portalRtt';
export { factory as gpuParticlesFactory } from './performance/gpuParticles';
