/**
 * WebGL2 Core Types
 * Extended for WebGL Showcase Playground
 */

// ============================================================================
// WebGL Resource Types
// ============================================================================

export interface WebGLResources {
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  buffers: WebGLBuffer[];
  textures: WebGLTexture[];
  framebuffers: WebGLFramebuffer[];
}

export interface ShaderSource {
  vertex: string;
  fragment: string;
}

export interface UniformLocations {
  [key: string]: WebGLUniformLocation | null;
}

export interface AttributeInfo {
  location: number;
  size: number;
  type: number;
  normalized: boolean;
  stride: number;
  offset: number;
  divisor?: number; // For instanced rendering
}

export interface FramebufferInfo {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

// ============================================================================
// Quality Settings
// ============================================================================

export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

export interface QualityPreset {
  name: string;
  resolution: number;          // Multiplier: 0.5, 0.75, 1.0, or devicePixelRatio
  particleMultiplier: number;  // 0.25, 0.5, 1.0, 1.5
  instanceMultiplier: number;  // 0.25, 0.5, 1.0, 1.5
  shaderComplexity: 'low' | 'medium' | 'high';
  postprocessEnabled: boolean;
}

// ============================================================================
// Demo Parameter Definitions (for UI generation)
// ============================================================================

export interface SliderParameter {
  key: string;
  label: string;
  type: 'slider';
  default: number;
  min: number;
  max: number;
  step?: number;
}

export interface ToggleParameter {
  key: string;
  label: string;
  type: 'toggle';
  default: boolean;
}

export interface SelectParameter {
  key: string;
  label: string;
  type: 'select';
  default: string;
  options: { label: string; value: string }[];
}

export interface ColorParameter {
  key: string;
  label: string;
  type: 'color';
  default: string; // hex color
}

export type ParameterDefinition =
  | SliderParameter
  | ToggleParameter
  | SelectParameter
  | ColorParameter;

// ============================================================================
// Demo Category
// ============================================================================

export type DemoCategory = 'shaders' | 'geometry' | 'performance' | 'postprocess';

export type DemoDifficulty = 'beginner' | 'intermediate' | 'advanced';

// ============================================================================
// Demo Metadata (for sidebar/search)
// ============================================================================

export interface DemoMetadata {
  id: string;
  name: string;
  category: DemoCategory;
  tags: string[];
  description: string;
  techniqueNotes: string[];  // "What technique is this?" bullet points
  perfNotes: string;         // "Performance notes" single line
  difficulty: DemoDifficulty;
  parameters: ParameterDefinition[];
  wip?: boolean;             // Mark as work-in-progress
}

// ============================================================================
// Demo Stats (enhanced)
// ============================================================================

export interface DemoStats {
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  instances?: number;
  particles?: number;
  gpuTime?: number;  // Requires EXT_disjoint_timer_query_webgl2
}

// ============================================================================
// Demo Context (passed to render each frame)
// ============================================================================

export interface DemoContext {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  dpr: number;
  time: number;
  deltaTime: number;
  mouseX: number;      // Normalized 0-1
  mouseY: number;      // Normalized 0-1
  mouseDown: boolean;
  quality: QualityLevel;
  reduceMotion: boolean;
}

// ============================================================================
// Demo Instance Interface
// ============================================================================

export interface DemoInstance {
  /** Initialize the demo (can be async for loading resources) */
  init(): void | Promise<void>;

  /** Clean up all WebGL resources */
  destroy(): void;

  /** Render one frame */
  render(ctx: DemoContext): void;

  /** Handle canvas resize */
  resize(width: number, height: number, dpr: number): void;

  /** Pause animations */
  pause(): void;

  /** Resume animations */
  resume(): void;

  /** Reset demo to initial state */
  reset(): void;

  /** Set a parameter value */
  setParameter(key: string, value: number | boolean | string): void;

  /** Get current parameter values */
  getParameters(): Record<string, number | boolean | string>;

  /** Get current stats */
  getStats(): DemoStats;
}

/** Factory function to create a demo instance */
export type DemoFactory = (gl: WebGL2RenderingContext) => DemoInstance;

// ============================================================================
// Demo Registry Entry
// ============================================================================

export interface DemoRegistryEntry {
  metadata: DemoMetadata;
  factory: DemoFactory;
}

/** Lazy-loading registry entry */
export interface LazyDemoRegistryEntry {
  metadata: DemoMetadata;
  load: () => Promise<{ factory: DemoFactory }>;
}

// ============================================================================
// App State Types
// ============================================================================

export interface PlaygroundState {
  activeDemoId: string;
  isPaused: boolean;
  isFullscreen: boolean;
  quality: QualityLevel;
  reduceMotion: boolean;
  searchQuery: string;
  categoryFilter: DemoCategory | null;
}

export type PlaygroundAction =
  | { type: 'SET_ACTIVE_DEMO'; demoId: string }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'SET_PAUSED'; isPaused: boolean }
  | { type: 'TOGGLE_FULLSCREEN' }
  | { type: 'SET_QUALITY'; quality: QualityLevel }
  | { type: 'TOGGLE_REDUCE_MOTION' }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'SET_CATEGORY_FILTER'; category: DemoCategory | null }
  | { type: 'RESET' };
