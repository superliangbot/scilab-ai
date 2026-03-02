# Audit Group A — 124 Simulations

**Auditor:** Liang (subagent audit-a)  
**Date:** 2026-03-02  
**Scope:** 4-stroke-engine through dna-replication (124 simulations)

## Summary

- **124/124 files found** ✅
- **124/124 have getStateDescription()** returning meaningful text ✅
- **6 division-by-zero bugs found and fixed** 🔧
- **0 scientific accuracy issues found** ✅
- **0 parameter validation issues** — all min/max/defaults are sensible ✅
- **Edge cases generally well-handled** — most distance/magnitude divisions already guarded ✅

## Division-by-Zero Fixes Applied

### 1. `physics/absorption-emission-light.ts` (line 160)
- **Issue:** `dist = Math.sqrt(dx*dx + dy*dy)` used as divisor without guard when creating photon direction vector
- **Fix:** `|| 1` fallback on dist calculation
- **Risk:** If photon spawns at exact target position, would produce NaN velocity

### 2. `physics/absorption-emission-light.ts` (line 512)
- **Issue:** `speed2 = Math.sqrt(p.vx*p.vx + p.vy*p.vy)` used as divisor for drawing direction
- **Fix:** `|| 1` fallback on speed2 calculation
- **Risk:** Stationary photon (vx=vy=0) would produce NaN when drawing

### 3. `physics/air-pressure.ts` (line 790)
- **Issue:** `dist` between high/low pressure centers used as divisor for normal vector
- **Fix:** `|| 1` fallback on dist calculation
- **Risk:** If both pressure centers coincide, wind arrow direction would be NaN

### 4. `astronomy/apparent-motion-mars.ts` (line 393)
- **Issue:** `dist` between Earth and Mars positions used as divisor for sight line normal
- **Fix:** `|| 1` fallback on dist calculation
- **Risk:** Extremely unlikely (different orbital radii), but defensive

### 5. `physics/apparent-motion-of-venus.ts` (line 142)
- **Issue:** `mag` of Earth-Venus vector used as divisor for sight line direction
- **Fix:** `|| 1` fallback on mag calculation
- **Risk:** If Earth and Venus overlap (shouldn't happen with orbital mechanics)

### 6. `electricity/circuit-builder.ts` (line 278)
- **Issue:** `len` between resistor endpoints used as divisor for unit vector in zigzag drawing
- **Fix:** `|| 1` fallback on len calculation
- **Risk:** If resistor has zero-length wire segment, would produce NaN positions

## Scientific Accuracy — Spot Checks

All formulas verified correct:

| Simulation | Formula | Status |
|---|---|---|
| boyles-law | PV = k, V = k/P | ✅ Correct |
| charles-law | V/T = constant, V = V_ref × T/T_ref | ✅ Correct |
| archimedes | F_b = ρ_fluid × V_submerged × g | ✅ Correct |
| carnot-engine | η = 1 − T_cold/T_hot | ✅ Correct |
| compton-scattering | Δλ = (h/m_e·c)(1 − cos θ) | ✅ Correct |
| avogadros-law | V ∝ n at constant T, P | ✅ Correct |
| adiabatic-gas-process | P = C/V^γ, T = C/V^(γ−1) | ✅ Correct |
| bernoullis-principle | P + ½ρv² + ρgh = constant | ✅ Correct |
| diffraction-grating | d·sin θ = mλ | ✅ Correct |

## Already-Guarded Divisions (no fix needed)

Many simulations already had proper guards:
- `addition-of-force.ts` — `if (len < 1) return;`
- `alkane-compound.ts` — `if (dist === 0) return;`
- `brownian-motion.ts` — `if (dist === 0) return;`
- `collision-2d.ts` — `if (dist === 0) return;`
- `conical-pendulum.ts` — `if (dist > 0) { ... }`
- `diode.ts` — `if (speed > maxSpeed) { ... }`
- `dissolution-process.ts` — `if (speed > maxSpeed) { ... }`
- `boiling-point.ts` — `if (speed > maxSpeed) { ... }`
- `charge-distribution-on-a-thin-conductive-plate.ts` — `if (len < 0.1) return;` and `if (mag < 0.01) continue;`
- `air-conditioner.ts` — `if (len < 0.1) continue;`

## Parameter Validation

All 124 simulations have sensible parameter ranges defined in `registry.ts`:
- Temperature params have min > 0 (Kelvin)
- Count params have min ≥ 1
- Physical quantities have appropriate ranges
- Carnot engine enforces `coldTemp < hotTemp - 1`

## Notes

- Code quality is consistently high across all 124 files
- Canvas rendering is well-structured with proper coordinate transforms
- Physics simulations properly use SI units internally
- Most edge cases around zero-distance/zero-speed are already handled
