/**
 * Quality Presets
 *
 * Defines quality levels that affect rendering resolution,
 * particle counts, instance counts, and shader complexity.
 */

import type { QualityLevel, QualityPreset } from './types';

export const QUALITY_PRESETS: Record<QualityLevel, QualityPreset> = {
  low: {
    name: 'Low',
    resolution: 0.5,
    particleMultiplier: 0.25,
    instanceMultiplier: 0.25,
    shaderComplexity: 'low',
    postprocessEnabled: false,
  },
  medium: {
    name: 'Medium',
    resolution: 0.75,
    particleMultiplier: 0.5,
    instanceMultiplier: 0.5,
    shaderComplexity: 'medium',
    postprocessEnabled: true,
  },
  high: {
    name: 'High',
    resolution: 1.0,
    particleMultiplier: 1.0,
    instanceMultiplier: 1.0,
    shaderComplexity: 'high',
    postprocessEnabled: true,
  },
  ultra: {
    name: 'Ultra',
    resolution: typeof window !== 'undefined' ? window.devicePixelRatio : 2,
    particleMultiplier: 1.5,
    instanceMultiplier: 1.5,
    shaderComplexity: 'high',
    postprocessEnabled: true,
  },
};

/**
 * Get the quality preset for a given level
 */
export function getQualityPreset(level: QualityLevel): QualityPreset {
  return QUALITY_PRESETS[level];
}

/**
 * Calculate the actual resolution based on quality level
 */
export function getResolutionMultiplier(level: QualityLevel): number {
  const preset = QUALITY_PRESETS[level];
  // For 'ultra', use actual devicePixelRatio
  if (level === 'ultra' && typeof window !== 'undefined') {
    return window.devicePixelRatio;
  }
  return preset.resolution;
}

/**
 * Calculate scaled particle count based on quality
 */
export function getScaledParticleCount(
  baseCount: number,
  level: QualityLevel
): number {
  const preset = QUALITY_PRESETS[level];
  return Math.floor(baseCount * preset.particleMultiplier);
}

/**
 * Calculate scaled instance count based on quality
 */
export function getScaledInstanceCount(
  baseCount: number,
  level: QualityLevel
): number {
  const preset = QUALITY_PRESETS[level];
  return Math.floor(baseCount * preset.instanceMultiplier);
}

/**
 * Check if postprocessing should be enabled
 */
export function isPostprocessEnabled(level: QualityLevel): boolean {
  return QUALITY_PRESETS[level].postprocessEnabled;
}

/**
 * Get shader complexity level
 */
export function getShaderComplexity(
  level: QualityLevel
): 'low' | 'medium' | 'high' {
  return QUALITY_PRESETS[level].shaderComplexity;
}

/**
 * Get all quality levels
 */
export function getQualityLevels(): QualityLevel[] {
  return ['low', 'medium', 'high', 'ultra'];
}
