# Massive Web Flight Simulator - Project Charter

**Version:** 1.0  
**Date:** 2026-02-23  
**Project Manager:** Ares (Lead Developer)

---

## 1. Project Overview

**Name:** Massive Web Flight Simulator  
**Type:** Web-based 3D Flight Simulator  
**Core Functionality:** Browser-based flight simulator using CesiumJS for geospatial rendering, JSBSim for flight dynamics, and glTF/GLB for aircraft models.

**Target Users:** 
- Aviation enthusiasts
- Web developers interested in flight simulation
- Casual gamers seeking browser-based flight experience

---

## 2. Goals

### Primary Goals
- [ ] Ship a runnable A380 cockpit-first flight simulator in browser
- [ ] Achieve stable 60 FPS on desktop, acceptable performance on mobile
- [ ] Implement CesiumJS terrain + imagery with optional 3D Tiles streaming
- [ ] Integrate JSBSim-based FDM for semi-realistic flight physics
- [ ] Support all platforms: iOS Safari, Android Chrome, Desktop browsers

### Secondary Goals
- [ ] Asset pipeline for GLB validation and LOD management
- [ ] Performance tier system (low/med/high)
- [ ] Mobile touch controls with gyro support
- [ ] HUD + PFD instrumentation

---

## 3. Non-Goals

- **Multiplayer** - Deferred to M6 (optional)
- **Weather systems** - Deferred to M6 (optional)
- **Study-level realism** - Target is semi-realistic (arcade-to-study bridge)
- **Native mobile apps** - Web-only deployment

---

## 4. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| JSBSim WASM/JS port unavailable | Medium | High | Fallback to simple aerodynamic model |
| A380 GLB model licensing | Medium | Medium | Use open-source model or create placeholder |
| 3D Tiles performance on mobile | High | High | Distance-based LOD + tier system |
| Cesium ion API key management | Low | High | User provides key; document setup |
| Memory constraints on mobile | High | Medium | Aggressive asset unloading, tiered quality |

---

## 5. Technology Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Rendering | CesiumJS | Terrain + imagery + 3D Tiles |
| Aircraft Assets | glTF 2.0 (GLB) | PBR materials |
| Flight Dynamics | JSBSim | WASM/JS port or fallback |
| Language | TypeScript | Strict mode |
| Build | Vite | Fast dev + production builds |
| Testing | Vitest | Unit tests |

---

## 6. Architecture Modules

```
src/
├── sim-core/        # Fixed timestep physics loop
├── fdm-jsbsim/      # JSBSim integration (Web Worker)
├── frames/          # Coordinate systems & conversions
├── world-cesium/    # Cesium Viewer setup
├── aircraft-render/ # GLB loading + LOD
├── input/           # Keyboard/mouse/gamepad/touch/gyro
├── ui/              # HUD + PFD + Debug overlays
└── asset-pipeline/  # GLB validation + compression scripts
```

---

## 7. Content & Licensing TODO

| Item | Status | Notes |
|------|--------|-------|
| Cesium ion API key | ❌ User required | Provide your own key |
| A380 GLB model | ❌ Need source | Open-source or placeholder |
| Terrain provider | ✅ Cesium World Terrain | Built-in Cesium |
| Imagery provider | ✅ Bing Maps / Sentinel | Cesium ion default |
| 3D Tiles cities | ❌ Optional | Enable in M5 if performance allows |

---

## 8. Milestone Plan

| Milestone | Description | Acceptance Criteria |
|-----------|-------------|---------------------|
| M0 | Repo + Tooling | TS project, CI, test harness |
| M1 | World + Aircraft | Cesium globe, A380 renders, chase camera |
| M2 | Physics Core | Fixed timestep, JSBSim integration |
| M3 | Controls + HUD | Desktop/mobile input, PFD display |
| M4 | Asset Pipeline | GLB validation, LOD, compression |
| M5 | Performance Tuning | Tier system, streaming config |
| M6 (Optional) | Weather/Traffic | Post-M5 only |

---

## 9. Performance Targets

| Tier | Target FPS | Max Download | Texture Size |
|------|------------|--------------|--------------|
| Desktop High | 60 fps | 2-3 GB | 4K |
| Desktop Low | 30 fps | 500 MB | 1K |
| Mobile | 24 fps | 300 MB | 1K |

---

## 10. First Aircraft: Airbus A380

- **Model:** Airbus A380 (double-decker commercial airliner)
- **Realism:** Semi-realistic (accessible to enthusiasts)
- **Camera:** Cockpit first (primary), chase (secondary)
- **Initial View:** Cockpit with forward view

---

*This charter is a living document. Update as requirements clarify.*
