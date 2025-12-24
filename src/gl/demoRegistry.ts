/**
 * Demo Registry
 *
 * Central registry of all WebGL demos with metadata and lazy loading.
 * Each demo has metadata for the sidebar/search and a factory function
 * to create demo instances.
 */

import type {
  DemoCategory,
  DemoMetadata,
  DemoFactory,
  DemoRegistryEntry,
} from './core/types';

// ============================================================================
// Demo Metadata Definitions
// ============================================================================

const nebulaMetadata: DemoMetadata = {
  id: 'nebula',
  name: 'Procedural Nebula',
  category: 'shaders',
  tags: ['noise', 'fbm', 'procedural', 'mouse-interactive'],
  description:
    'A procedural nebula effect using fractional Brownian motion (FBM) and domain warping. The effect responds subtly to mouse movement and includes film grain for texture.',
  techniqueNotes: [
    'Simplex noise with multiple octaves (FBM)',
    'Domain warping for organic flow patterns',
    'Mouse-reactive displacement',
    'Film grain post-effect',
  ],
  perfNotes: 'Fragment-heavy; 1 draw call',
  difficulty: 'intermediate',
  parameters: [
    { key: 'speed', label: 'Animation Speed', type: 'slider', default: 1, min: 0.1, max: 2, step: 0.1 },
    { key: 'complexity', label: 'Noise Octaves', type: 'slider', default: 5, min: 2, max: 8, step: 1 },
    { key: 'mouseInfluence', label: 'Mouse Effect', type: 'slider', default: 0.15, min: 0, max: 0.5, step: 0.05 },
    { key: 'grain', label: 'Film Grain', type: 'toggle', default: true },
    { key: 'palette', label: 'Color Palette', type: 'select', default: 'nebula',
      options: [
        { label: 'Nebula', value: 'nebula' },
        { label: 'Ocean', value: 'ocean' },
        { label: 'Fire', value: 'fire' },
      ] },
  ],
};

const instancedMetadata: DemoMetadata = {
  id: 'instanced',
  name: 'Instanced Field',
  category: 'performance',
  tags: ['instancing', 'hexagons', '3d', 'webgl2'],
  description:
    'Renders 5,000+ hexagonal tiles using WebGL2 instanced drawing. Each instance has unique position, color, scale, and rotation animated on the GPU.',
  techniqueNotes: [
    'drawArraysInstanced for batch rendering',
    'Per-instance attributes with vertexAttribDivisor',
    'GPU-driven wave animations',
    'Perspective camera with orbit',
  ],
  perfNotes: '5,000 instances; 1 draw call',
  difficulty: 'intermediate',
  parameters: [
    { key: 'speed', label: 'Animation Speed', type: 'slider', default: 1, min: 0.1, max: 3, step: 0.1 },
    { key: 'cameraSpeed', label: 'Camera Speed', type: 'slider', default: 1, min: 0, max: 2, step: 0.1 },
  ],
};

const portalRttMetadata: DemoMetadata = {
  id: 'portal-rtt',
  name: 'Portal RTT',
  category: 'performance',
  tags: ['rtt', 'framebuffer', 'postprocess', 'bloom'],
  description:
    'Demonstrates render-to-texture by rendering a 3D scene to an offscreen framebuffer, then applying postprocessing effects including bloom and color grading.',
  techniqueNotes: [
    'Offscreen framebuffer rendering',
    'Gaussian blur for bloom effect',
    'Chromatic aberration',
    'Tone mapping and color grading',
  ],
  perfNotes: '2 passes (scene + postprocess); uses FBO',
  difficulty: 'advanced',
  parameters: [
    { key: 'bloomIntensity', label: 'Bloom Intensity', type: 'slider', default: 0.4, min: 0, max: 1, step: 0.05 },
    { key: 'aberration', label: 'Chromatic Aberration', type: 'slider', default: 0.002, min: 0, max: 0.01, step: 0.001 },
    { key: 'saturation', label: 'Saturation', type: 'slider', default: 1.3, min: 0.5, max: 2, step: 0.1 },
    { key: 'cameraSpeed', label: 'Camera Speed', type: 'slider', default: 1, min: 0, max: 2, step: 0.1 },
  ],
};

const gpuParticlesMetadata: DemoMetadata = {
  id: 'gpu-particles',
  name: 'GPU Particles',
  category: 'performance',
  tags: ['particles', 'transform-feedback', 'gpgpu', 'webgl2'],
  description:
    '50,000 particles simulated entirely on the GPU using WebGL2 transform feedback. Particles are attracted to animated points and rendered with additive blending.',
  techniqueNotes: [
    'Transform feedback for GPU-side updates',
    'Double buffering (ping-pong)',
    'Attractor-based physics',
    'Additive blending for glow',
  ],
  perfNotes: '50K particles; 2 passes (update + render)',
  difficulty: 'advanced',
  parameters: [
    { key: 'turbulence', label: 'Turbulence', type: 'slider', default: 2, min: 0, max: 5, step: 0.5 },
    { key: 'cameraSpeed', label: 'Camera Speed', type: 'slider', default: 1, min: 0, max: 2, step: 0.1 },
    { key: 'pointSize', label: 'Point Size', type: 'slider', default: 5, min: 1, max: 10, step: 0.5 },
  ],
};

const voronoiMetadata: DemoMetadata = {
  id: 'voronoi',
  name: 'Voronoi Patterns',
  category: 'shaders',
  tags: ['noise', 'cellular', 'procedural'],
  description:
    'Animated Voronoi/cellular noise patterns with customizable color palettes. A fundamental noise technique used in many procedural effects.',
  techniqueNotes: [
    'Cellular/Worley noise algorithm',
    'Distance-based coloring',
    'Animated cell centers',
    'Customizable color palette',
  ],
  perfNotes: 'Fragment-heavy; 1 draw call',
  difficulty: 'beginner',
  parameters: [
    { key: 'cellCount', label: 'Cell Density', type: 'slider', default: 8, min: 2, max: 20, step: 1 },
    { key: 'speed', label: 'Animation Speed', type: 'slider', default: 1, min: 0, max: 3, step: 0.1 },
    { key: 'edgeWidth', label: 'Edge Width', type: 'slider', default: 0.05, min: 0, max: 0.2, step: 0.01 },
    { key: 'palette', label: 'Color Palette', type: 'select', default: 'cosmic',
      options: [
        { label: 'Cosmic', value: 'cosmic' },
        { label: 'Lava', value: 'lava' },
        { label: 'Ocean', value: 'ocean' },
        { label: 'Neon', value: 'neon' },
      ] },
  ],
};

const raymarchingMetadata: DemoMetadata = {
  id: 'raymarching',
  name: 'Raymarching Basics',
  category: 'shaders',
  tags: ['raymarching', 'sdf', '3d', 'lighting'],
  description:
    'A raymarched 3D scene using signed distance functions (SDFs). Demonstrates sphere and box primitives with soft shadows and ambient occlusion.',
  techniqueNotes: [
    'Sphere and box SDF primitives',
    'Smooth minimum for blending',
    'Soft shadows via ray marching',
    'Basic ambient occlusion',
  ],
  perfNotes: 'Fragment-heavy (per-pixel ray march); 1 draw call',
  difficulty: 'intermediate',
  parameters: [
    { key: 'maxSteps', label: 'Max Steps', type: 'slider', default: 64, min: 16, max: 128, step: 8 },
    { key: 'softShadows', label: 'Soft Shadows', type: 'toggle', default: true },
    { key: 'ao', label: 'Ambient Occlusion', type: 'toggle', default: true },
    { key: 'rotationSpeed', label: 'Rotation Speed', type: 'slider', default: 0.3, min: 0, max: 1, step: 0.1 },
  ],
};

const sdf2dMetadata: DemoMetadata = {
  id: 'sdf-2d',
  name: '2D SDF Shapes',
  category: 'shaders',
  tags: ['sdf', '2d', 'procedural', 'shapes'],
  description:
    'A showcase of 2D signed distance functions: circles, boxes, stars, and more with smooth unions, subtractions, and repetition.',
  techniqueNotes: [
    'Basic 2D SDF primitives',
    'Smooth union/subtraction',
    'Domain repetition',
    'Anti-aliased rendering',
  ],
  perfNotes: 'Fragment-heavy; 1 draw call',
  difficulty: 'beginner',
  parameters: [
    { key: 'shape', label: 'Primary Shape', type: 'select', default: 'star',
      options: [
        { label: 'Circle', value: 'circle' },
        { label: 'Box', value: 'box' },
        { label: 'Star', value: 'star' },
        { label: 'Heart', value: 'heart' },
      ] },
    { key: 'repetition', label: 'Repetition', type: 'toggle', default: false },
    { key: 'smoothness', label: 'Blend Smoothness', type: 'slider', default: 0.1, min: 0, max: 0.5, step: 0.01 },
    { key: 'animate', label: 'Animate', type: 'toggle', default: true },
  ],
};

const metaballsMetadata: DemoMetadata = {
  id: 'metaballs',
  name: 'Metaballs 2D',
  category: 'shaders',
  tags: ['metaballs', 'threshold', 'procedural', 'organic'],
  description:
    'Classic metaballs effect where multiple circular fields blend together when close. Adjust the threshold to control the "gooey" appearance.',
  techniqueNotes: [
    'Inverse distance field calculation',
    'Threshold-based surface extraction',
    'Multiple animated blobs',
    'Smooth color gradients',
  ],
  perfNotes: 'Fragment-heavy; 1 draw call',
  difficulty: 'beginner',
  parameters: [
    { key: 'blobCount', label: 'Blob Count', type: 'slider', default: 5, min: 2, max: 12, step: 1 },
    { key: 'threshold', label: 'Threshold', type: 'slider', default: 1.0, min: 0.5, max: 2.0, step: 0.1 },
    { key: 'speed', label: 'Animation Speed', type: 'slider', default: 1, min: 0, max: 3, step: 0.1 },
    { key: 'colorful', label: 'Colorful Mode', type: 'toggle', default: true },
  ],
};

const heightfieldMetadata: DemoMetadata = {
  id: 'heightfield',
  name: 'Heightfield Wave',
  category: 'geometry',
  tags: ['vertex-displacement', 'normals', 'grid', 'lighting'],
  description:
    'A grid mesh displaced by noise-based heights. Demonstrates vertex shader displacement and computed normals for proper lighting.',
  techniqueNotes: [
    'Vertex displacement in shader',
    'Normal computation from neighbors',
    'Phong-style lighting',
    'Animated wave patterns',
  ],
  perfNotes: '100x100 grid; 1 draw call',
  difficulty: 'intermediate',
  parameters: [
    { key: 'gridSize', label: 'Grid Size', type: 'slider', default: 100, min: 20, max: 200, step: 10 },
    { key: 'waveHeight', label: 'Wave Height', type: 'slider', default: 1, min: 0.1, max: 3, step: 0.1 },
    { key: 'waveFrequency', label: 'Wave Frequency', type: 'slider', default: 2, min: 0.5, max: 5, step: 0.1 },
    { key: 'wireframe', label: 'Wireframe Mode', type: 'toggle', default: false },
  ],
};

const wireframeMetadata: DemoMetadata = {
  id: 'wireframe',
  name: 'Wireframe Look',
  category: 'geometry',
  tags: ['wireframe', 'barycentric', 'stylized'],
  description:
    'Achieves a wireframe rendering effect without geometry shaders using barycentric coordinates passed as vertex attributes.',
  techniqueNotes: [
    'Barycentric coordinates as attributes',
    'Edge detection in fragment shader',
    'Adjustable edge thickness',
    'Works on any mesh',
  ],
  perfNotes: 'Requires barycentric data; 1 draw call',
  difficulty: 'intermediate',
  parameters: [
    { key: 'edgeWidth', label: 'Edge Width', type: 'slider', default: 1.5, min: 0.5, max: 5, step: 0.5 },
    { key: 'fillOpacity', label: 'Fill Opacity', type: 'slider', default: 0.1, min: 0, max: 1, step: 0.05 },
    { key: 'animate', label: 'Animate Mesh', type: 'toggle', default: true },
  ],
};

const bloomMetadata: DemoMetadata = {
  id: 'bloom',
  name: 'Bloom Effect',
  category: 'postprocess',
  tags: ['bloom', 'blur', 'postprocess', 'glow'],
  description:
    'A multi-pass bloom effect that extracts bright areas and applies gaussian blur. A common technique for making lights and emissive surfaces glow.',
  techniqueNotes: [
    'Bright-pass threshold extraction',
    'Separable gaussian blur (2 passes)',
    'Additive blending with original',
    'Render-to-texture pipeline',
  ],
  perfNotes: '3-4 passes (threshold + blur H + blur V + combine)',
  difficulty: 'intermediate',
  parameters: [
    { key: 'threshold', label: 'Bright Threshold', type: 'slider', default: 0.5, min: 0, max: 1, step: 0.05 },
    { key: 'intensity', label: 'Bloom Intensity', type: 'slider', default: 1, min: 0, max: 3, step: 0.1 },
    { key: 'radius', label: 'Blur Radius', type: 'slider', default: 4, min: 1, max: 10, step: 1 },
  ],
};

const capabilitiesMetadata: DemoMetadata = {
  id: 'capabilities',
  name: 'WebGL2 Capabilities',
  category: 'performance',
  tags: ['webgl2', 'extensions', 'features', 'educational'],
  description:
    'Displays WebGL2 capabilities and supported extensions of your browser/GPU. Useful for understanding what features are available.',
  techniqueNotes: [
    'Extension detection (getExtension)',
    'Parameter queries (getParameter)',
    'Capability limits (MAX_*)',
    'Feature support table',
  ],
  perfNotes: 'Static display; minimal GPU usage',
  difficulty: 'beginner',
  parameters: [],
};

const waterCausticsMetadata: DemoMetadata = {
  id: 'water-caustics',
  name: 'Water Caustics',
  category: 'shaders',
  tags: ['water', 'caustics', 'distortion', 'uv'],
  description:
    'Simulates underwater caustic light patterns using UV distortion and animated noise. Creates a convincing underwater lighting effect.',
  techniqueNotes: [
    'UV coordinate distortion',
    'Layered noise for caustics',
    'Animated light patterns',
    'Fake volumetric lighting',
  ],
  perfNotes: 'Fragment-heavy; 1 draw call',
  difficulty: 'intermediate',
  parameters: [
    { key: 'speed', label: 'Animation Speed', type: 'slider', default: 1, min: 0, max: 3, step: 0.1 },
    { key: 'distortion', label: 'Distortion Amount', type: 'slider', default: 0.1, min: 0, max: 0.3, step: 0.01 },
    { key: 'brightness', label: 'Caustic Brightness', type: 'slider', default: 1, min: 0.5, max: 2, step: 0.1 },
  ],
};

const glitchMetadata: DemoMetadata = {
  id: 'glitch',
  name: 'Glitch Effects',
  category: 'postprocess',
  tags: ['glitch', 'chromatic-aberration', 'noise', 'distortion'],
  description:
    'Collection of glitch effects including chromatic aberration, scan lines, and random displacement. Great for stylized or "broken" aesthetics.',
  techniqueNotes: [
    'Chromatic aberration (RGB split)',
    'Random block displacement',
    'Scan line overlay',
    'Noise-based distortion',
  ],
  perfNotes: 'Postprocess pass; 1 draw call',
  difficulty: 'beginner',
  parameters: [
    { key: 'chromaticStrength', label: 'Chromatic Aberration', type: 'slider', default: 0.01, min: 0, max: 0.05, step: 0.002 },
    { key: 'scanlines', label: 'Scan Lines', type: 'toggle', default: true },
    { key: 'blockGlitch', label: 'Block Glitch', type: 'toggle', default: false },
    { key: 'intensity', label: 'Glitch Intensity', type: 'slider', default: 0.5, min: 0, max: 1, step: 0.1 },
  ],
};

const ditheringMetadata: DemoMetadata = {
  id: 'dithering',
  name: 'Dithering/Posterize',
  category: 'postprocess',
  tags: ['dithering', 'posterize', 'stylized', 'retro'],
  description:
    'Stylized rendering with color quantization and dithering. Achieve retro game aesthetics or artistic poster-like effects.',
  techniqueNotes: [
    'Color quantization (posterization)',
    'Ordered dithering (Bayer matrix)',
    'Blue noise dithering option',
    'Adjustable color palette size',
  ],
  perfNotes: 'Postprocess pass; 1 draw call',
  difficulty: 'beginner',
  parameters: [
    { key: 'colorLevels', label: 'Color Levels', type: 'slider', default: 8, min: 2, max: 32, step: 1 },
    { key: 'ditherType', label: 'Dither Type', type: 'select', default: 'bayer',
      options: [
        { label: 'None', value: 'none' },
        { label: 'Bayer 4x4', value: 'bayer' },
        { label: 'Blue Noise', value: 'blue' },
      ] },
    { key: 'ditherStrength', label: 'Dither Strength', type: 'slider', default: 1, min: 0, max: 2, step: 0.1 },
  ],
};

const primitives3dMetadata: DemoMetadata = {
  id: '3d-primitives',
  name: '3D Primitives',
  category: 'geometry',
  tags: ['3d', 'primitives', 'lighting', 'phong'],
  description:
    'Classic 3D primitives (cube, sphere, torus) with Phong lighting. Interactive camera orbit and multiple light sources.',
  techniqueNotes: [
    'Procedural primitive generation',
    'Phong lighting model',
    'Orbit camera controls',
    'Multiple point lights',
  ],
  perfNotes: 'Standard 3D scene; 3-4 draw calls',
  difficulty: 'beginner',
  parameters: [
    { key: 'shape', label: 'Shape', type: 'select', default: 'torus',
      options: [
        { label: 'Cube', value: 'cube' },
        { label: 'Sphere', value: 'sphere' },
        { label: 'Torus', value: 'torus' },
        { label: 'All', value: 'all' },
      ] },
    { key: 'autoRotate', label: 'Auto Rotate', type: 'toggle', default: true },
    { key: 'wireframe', label: 'Wireframe', type: 'toggle', default: false },
  ],
};

const pingPongMetadata: DemoMetadata = {
  id: 'ping-pong',
  name: 'Ping-Pong FBO',
  category: 'performance',
  tags: ['gpgpu', 'fbo', 'simulation', 'reaction-diffusion'],
  description:
    'A GPGPU simulation using ping-pong framebuffers. Demonstrates reaction-diffusion or Game of Life computed entirely on the GPU.',
  techniqueNotes: [
    'Double-buffered framebuffers',
    'Read from one, write to other',
    'GPU-based state evolution',
    'Texture as data storage',
  ],
  perfNotes: '2 FBOs; 2 passes per frame',
  difficulty: 'advanced',
  parameters: [
    { key: 'simulation', label: 'Simulation Type', type: 'select', default: 'reaction-diffusion',
      options: [
        { label: 'Reaction-Diffusion', value: 'reaction-diffusion' },
        { label: 'Game of Life', value: 'game-of-life' },
      ] },
    { key: 'speed', label: 'Simulation Speed', type: 'slider', default: 1, min: 0.1, max: 5, step: 0.1 },
    { key: 'reset', label: 'Reset Simulation', type: 'toggle', default: false },
  ],
};

const colorGradingMetadata: DemoMetadata = {
  id: 'color-grading',
  name: 'Color Grading',
  category: 'postprocess',
  tags: ['color-grading', 'lut', 'curves', 'vignette'],
  description:
    'Film-style color grading with adjustable curves, saturation, and vignette. Demonstrates common color correction techniques.',
  techniqueNotes: [
    'RGB curve adjustments',
    'Saturation/vibrance control',
    'Lift/gamma/gain',
    'Vignette effect',
  ],
  perfNotes: 'Postprocess pass; 1 draw call',
  difficulty: 'beginner',
  parameters: [
    { key: 'saturation', label: 'Saturation', type: 'slider', default: 1, min: 0, max: 2, step: 0.1 },
    { key: 'contrast', label: 'Contrast', type: 'slider', default: 1, min: 0.5, max: 1.5, step: 0.05 },
    { key: 'brightness', label: 'Brightness', type: 'slider', default: 0, min: -0.5, max: 0.5, step: 0.05 },
    { key: 'vignette', label: 'Vignette', type: 'slider', default: 0.3, min: 0, max: 1, step: 0.05 },
  ],
};

// ============================================================================
// Registry Map
// ============================================================================

const DEMO_METADATA: Record<string, DemoMetadata> = {
  // Shaders
  voronoi: voronoiMetadata,
  nebula: nebulaMetadata,
  raymarching: raymarchingMetadata,
  metaballs: metaballsMetadata,
  'sdf-2d': sdf2dMetadata,
  'water-caustics': waterCausticsMetadata,
  // Geometry
  heightfield: heightfieldMetadata,
  wireframe: wireframeMetadata,
  '3d-primitives': primitives3dMetadata,
  // Performance
  instanced: instancedMetadata,
  'gpu-particles': gpuParticlesMetadata,
  'portal-rtt': portalRttMetadata,
  'ping-pong': pingPongMetadata,
  capabilities: capabilitiesMetadata,
  // Postprocess
  bloom: bloomMetadata,
  glitch: glitchMetadata,
  dithering: ditheringMetadata,
  'color-grading': colorGradingMetadata,
};

// Dynamic import map for lazy loading
const DEMO_LOADERS: Record<string, () => Promise<{ factory: DemoFactory }>> = {
  // Shader demos
  nebula: () => import('./demos/shaders/nebula'),
  voronoi: () => import('./demos/shaders/voronoi'),
  raymarching: () => import('./demos/shaders/raymarching'),
  metaballs: () => import('./demos/shaders/metaballs'),
  'sdf-2d': () => import('./demos/shaders/sdf2d'),
  'water-caustics': () => import('./demos/shaders/waterCaustics'),
  // Geometry demos
  heightfield: () => import('./demos/geometry/heightfield'),
  wireframe: () => import('./demos/geometry/wireframe'),
  '3d-primitives': () => import('./demos/geometry/primitives3d'),
  // Performance demos
  instanced: () => import('./demos/performance/instanced'),
  'gpu-particles': () => import('./demos/performance/gpuParticles'),
  'portal-rtt': () => import('./demos/performance/portalRtt'),
  'ping-pong': () => import('./demos/performance/pingPong'),
  capabilities: () => import('./demos/performance/capabilities'),
  // Postprocess demos
  bloom: () => import('./demos/postprocess/bloom'),
  glitch: () => import('./demos/postprocess/glitch'),
  dithering: () => import('./demos/postprocess/dithering'),
  'color-grading': () => import('./demos/postprocess/colorGrading'),
};

// ============================================================================
// Registry API
// ============================================================================

/**
 * Get all demo metadata entries
 */
export function getAllDemos(): DemoMetadata[] {
  return Object.values(DEMO_METADATA);
}

/**
 * Get demo metadata by ID
 */
export function getDemoById(id: string): DemoMetadata | undefined {
  return DEMO_METADATA[id];
}

/**
 * Get all demos in a category
 */
export function getDemosByCategory(category: DemoCategory): DemoMetadata[] {
  return Object.values(DEMO_METADATA).filter(
    (demo) => demo.category === category
  );
}

/**
 * Search demos by name, tags, or description
 */
export function searchDemos(query: string): DemoMetadata[] {
  const q = query.toLowerCase();
  return Object.values(DEMO_METADATA).filter(
    (demo) =>
      demo.name.toLowerCase().includes(q) ||
      demo.tags.some((tag) => tag.toLowerCase().includes(q)) ||
      demo.description.toLowerCase().includes(q)
  );
}

/**
 * Filter demos by category and search query
 */
export function filterDemos(
  category: DemoCategory | null,
  query: string
): DemoMetadata[] {
  let results = Object.values(DEMO_METADATA);

  if (category) {
    results = results.filter((demo) => demo.category === category);
  }

  if (query) {
    const q = query.toLowerCase();
    results = results.filter(
      (demo) =>
        demo.name.toLowerCase().includes(q) ||
        demo.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }

  return results;
}

/**
 * Load a demo factory dynamically
 */
export async function loadDemo(id: string): Promise<DemoRegistryEntry | null> {
  const metadata = DEMO_METADATA[id];
  const loader = DEMO_LOADERS[id];

  if (!metadata || !loader) {
    console.error(`Demo not found: ${id}`);
    return null;
  }

  try {
    const module = await loader();
    return {
      metadata,
      factory: module.factory,
    };
  } catch (error) {
    console.error(`Failed to load demo: ${id}`, error);
    return null;
  }
}

/**
 * Get all demo IDs
 */
export function getDemoIds(): string[] {
  return Object.keys(DEMO_METADATA);
}

/**
 * Get all categories with their demo counts
 */
export function getCategoryCounts(): Record<DemoCategory, number> {
  const counts: Record<DemoCategory, number> = {
    shaders: 0,
    geometry: 0,
    performance: 0,
    postprocess: 0,
  };

  for (const demo of Object.values(DEMO_METADATA)) {
    counts[demo.category]++;
  }

  return counts;
}

/**
 * Get the default demo ID to show on first load
 */
export function getDefaultDemoId(): string {
  return 'voronoi';
}
