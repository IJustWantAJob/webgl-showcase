# WebGL Showcase

An interactive playground for learning WebGL2 techniques. 18 demos covering shaders, geometry, GPU compute, and postprocessing—each with tweakable parameters and real-time performance stats.

Open webgl.kanteti.me


<img width="698" height="563" alt="image" src="https://github.com/user-attachments/assets/30d0576b-7767-4bdf-8969-324fc7dbb361" />

## What's inside

### Shaders
- **Procedural Nebula** — FBM noise with domain warping, mouse-reactive
- **Voronoi Patterns** — Animated cellular noise with customizable palettes
- **Raymarching** — 3D SDFs with soft shadows and ambient occlusion
- **2D SDF Shapes** — Smooth boolean operations on procedural shapes
- **Metaballs** — Classic gooey blob effect
- **Water Caustics** — Fake underwater lighting with UV distortion

### Geometry
- **Heightfield Wave** — Vertex displacement with computed normals
- **Wireframe Rendering** — Barycentric coordinate trick (no geometry shader needed)
- **3D Primitives** — Cube, sphere, torus with Phong lighting

### Performance
- **Instanced Rendering** — 5,000+ animated hexagons in a single draw call
- **GPU Particles** — 50,000 particles simulated via transform feedback
- **Portal RTT** — Render-to-texture with bloom and chromatic aberration
- **Ping-Pong FBO** — Reaction-diffusion / Game of Life on the GPU
- **WebGL2 Capabilities** — See what your browser/GPU supports

### Postprocessing
- **Bloom** — Multi-pass gaussian blur
- **Glitch Effects** — RGB split, scanlines, block displacement
- **Dithering** — Bayer and blue noise posterization
- **Color Grading** — Curves, saturation, vignette

## Getting started

```bash
npm install
npm run dev
```

## Tech

- React 19 + TypeScript
- Vite
- Raw WebGL2 (no Three.js)
- gl-matrix for 3D math

## Structure

```
src/
├── gl/
│   ├── core/       # Shader utils, buffer helpers, texture loaders
│   ├── demos/      # All 18 demos (lazy-loaded)
│   └── demoRegistry.ts
├── components/     # UI (sidebar, controls, HUD)
├── context/        # App state
└── hooks/          # URL sync, keyboard shortcuts, etc.
```

## License

MIT
