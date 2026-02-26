# Duplicate Cleanup Summary

**Date:** 2026-02-26
**Commit:** `bbcc829` — `fix: consolidate duplicates, register missing sims, clean orphans`

## Files Removed (21 total)

### HIGH-PRIORITY Duplicates (19 files)

| Removed File | Kept Instead | Reason |
|---|---|---|
| `chemistry/activity-series-of-metals.ts` (317 lines) | `chemistry/activity-series-metals.ts` (1057 lines) | Shorter duplicate, same title |
| `physics/absorption-and-emission-of-light.ts` (288 lines) | `physics/absorption-emission-light.ts` (828 lines) | Less detailed version |
| `physics/am-fm-modulation.ts` (448 lines) | `physics/am-fm.ts` (508 lines) | Redundant, same concept |
| `physics/double-slit-experiment.ts` (25 lines) | `physics/double-slit.ts` (242 lines) | Placeholder stub |
| `physics/youngs-double-slit.ts` (220 lines) | `physics/double-slit.ts` (242 lines) | Same experiment |
| `physics/free-fall-2.ts` | `physics/free-fall.ts` (418 lines) | Numbered variant |
| `physics/free-falling.ts` (357 lines) | `physics/free-fall.ts` (418 lines) | Redundant rename |
| `math/c-curve-fractal.ts` (333 lines) | `math/c-curve.ts` (362 lines) | High-overlap duplicate |
| `physics/gas.ts` (409 lines) | `physics/gas-model.ts` (433 lines) | Redundant, same concept |
| `physics/color.ts` (156 lines) | `physics/three-primary-colors.ts` (346 lines) | Minimal version of same concept |
| `physics/rgb.ts` (229 lines) | `physics/three-primary-colors.ts` (346 lines) | Redundant additive color sim |
| `physics/superposition.ts` (294 lines) | `physics/superposition-and-interference.ts` (371 lines) | Subset of more complete version |
| `astronomy/tidal-forces.ts` (25 lines) | `physics/tidal-force.ts` (313 lines) | Placeholder stub |
| `physics/sound-wave.ts` (315 lines) | `waves/sound-waves.ts` (369 lines) | Cross-category duplicate; waves/ version kept |
| `physics/standing-wave-synthesis.ts` (293 lines) | `waves/standing-waves.ts` (295 lines) | Cross-category duplicate |
| `physics/electromagnetic-waves.ts` (396 lines) | `physics/electromagnetic-wave.ts` (432 lines) | Near-identical name, less complete |
| `physics/seismic-wave.ts` (297 lines) | `earth/seismic-waves.ts` (625 lines) | Cross-category; earth/ version far more detailed |
| `physics/cmyk-decomposer.ts` (175 lines) | `physics/filedrop-cmyk.ts` (238 lines) | Simpler duplicate |
| `physics/filedrop-cmy.ts` (230 lines) | `physics/filedrop-cmyk.ts` (238 lines) | CMY is subset of CMYK |

### MEDIUM-PRIORITY Consolidations (2 files)

| Removed File | Kept Instead | Reason |
|---|---|---|
| `biology/ecosystem.ts` (389 lines) | `biology/ecosystem-v2.ts` (392 lines) | V2 is the replacement |
| `biology/cell-division-model.ts` (682 lines) | `biology/cell-division.ts` (647 lines) | Very similar; kept original |

### MEDIUM-PRIORITY Kept (different perspectives)

- **Boyle's Law family** (boyles-law, boyles-law-2, boyles-j-tube, gas-laws) — different apparatus/approaches
- **Carnot engines** (carnot-engine, carnot-engines) — single vs comparison adds value
- **Conduction 1/2/3** — different models (macro, particle, material comparison)
- **Springs** (spring vs springs) — single Hooke's Law vs series/parallel
- **Projectile/Parabolic** — kept all 3, different focus levels
- **Rainbow** family — kept all 3, subtly different visualizations
- **Ionic bond** family — kept all, NaCl is specific example
- **Doppler Effect** — kept both physics/ and waves/ versions (distinct focus)

## Registry Fixes

1. **Fixed orphaned slug:** `doppler-wave-effect` → `doppler-effect-waves` (matching `waves/doppler-effect.ts`)
2. **Updated file:** `waves/doppler-effect.ts` to use `getSimConfig("doppler-effect-waves")`

## Newly Registered (7 files)

| Slug | File | Category |
|---|---|---|
| `beats` | `waves/beats.ts` | waves |
| `harmonics` | `waves/harmonics.ts` | waves |
| `resonance` | `waves/resonance.ts` | waves |
| `snells-law` | `waves/snells-law.ts` | waves |
| `coupled-oscillators` | `physics/coupled-oscillators.ts` | physics |
| `memory-hierarchy` | `technology/memory-hierarchy.ts` | technology |
| `neural-network-perceptron` | `technology/neural-network-perceptron.ts` | technology |

## Result

- **Files removed:** 21
- **Files registered:** 7
- **Registry entries fixed:** 1 (slug mismatch)
- **Build:** ✅ Passes
- **Estimated sim count:** ~479 (down from 500)
