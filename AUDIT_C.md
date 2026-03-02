# AUDIT-C Report — 118 Simulations

**Auditor:** Liang (subagent)  
**Date:** 2026-03-02  
**Status:** ✅ Complete

## Summary

All 118 simulation files found and audited. **6 files fixed** for division-by-zero risks. No scientific accuracy errors found. All files have `getStateDescription()` returning meaningful text.

## Fixes Applied

### 1. `physics/hydrocarbon.ts` — Division by zero in bond drawing
- **Line 104:** `len = Math.hypot(dx, dy)` used as divisor without guard
- **Fix:** Added `if (len === 0) return;` before `nx = -dy / len`

### 2. `chemistry/molecule.ts` — Division by zero in double/triple bond drawing (2 locations)
- **Lines 262, 280:** `len = Math.sqrt(dx*dx + dy*dy)` used as divisor
- **Fix:** Changed to `Math.sqrt(...) || 1` to prevent NaN when atoms overlap

### 3. `chemistry/normal-distribution.ts` — Division by zero in peg collision
- **Line 112:** `dist` used as divisor when ball is exactly at peg center
- **Fix:** Changed `if (dist < pegRadius + ballRadius)` to `if (dist < pegRadius + ballRadius && dist > 0)`

### 4. `biology/natural-selection.ts` — Division by zero in movement vectors (3 locations)
- **Lines 181, 191, 261:** `minPredDist`, `minFoodDist`, `minDist` used as divisors; could be 0 if entities overlap exactly
- **Fix:** Wrapped all three with `Math.max(value, 0.1)`

### 5. `physics/michelson-interferometer.ts` — Division by zero in beam drawing
- **Line 302:** `len` used as divisor for wave dot normalization
- **Fix:** Added `if (len === 0) return;` guard

### 6. `physics/moment-of-inertia.ts` — Division by zero for moment of inertia (3 locations)
- **Lines 302, 561, 694:** `appliedTorque / I` where I could be 0 (point mass at rotation axis)
- **Fix:** Changed all to `I > 0 ? appliedTorque / I : 0`

### 7. `physics/magnetic-induction.ts` — Division by zero on first frame
- **Line ~79:** `dFlux / dtClamped` where `dtClamped = Math.min(dt, 0.05)` could be 0 on first frame
- **Fix:** Changed to `Math.max(Math.min(dt, 0.05), 1e-6)`

## Scientific Accuracy — Spot Checks

All formulas verified correct:
- **Ohm's Law** (`ohms-law`): V = IR ✓ (guarded with `Math.max(resistance, 0.1)`)
- **Parallel Circuit** (`parallel-circuit`): 1/R = Σ(1/Rᵢ) ✓
- **Thin Lens** (`lens`, `microscope`, `optics`): 1/f = 1/v + 1/u ✓ (all guard denom ≈ 0)
- **Mirror Equation** (`mirrors`): 1/f = 1/v + 1/u ✓ (guarded)
- **Snell's Law** (`light-refraction`): sin(θ₂) = (n₁/n₂)sin(θ₁) ✓
- **LC Oscillator** (`lc-oscillator`): f₀ = 1/(2π√LC) ✓
- **de Broglie** (`matter-wave`): λ = h/(mv) ✓ (velocity clamped to ≥0.1)
- **Kepler's 3rd Law** (`keplers-law`): T² ∝ a³ ✓
- **Pendulum Period** (`period-of-pendulum`): T = 2π√(L/g) ✓
- **Newton's Rings** (`newton-ring`): rₙ = √(nλR/μ) ✓
- **Eratosthenes** (`measuring-the-earth`): C = (360°/θ) × d ✓ (guards θ ≤ 0)
- **Parabolic Motion** (`parabolic-motion`): standard projectile equations ✓
- **Dipole Field** (`magnet`, `magnet-and-electromagnet`): B = μ₀/(4π)(3(m·r̂)r̂ - m)/r³ ✓ (r clamped to ≥5)
- **Magnetic Field** (`magnetic-field-around-a-bar-magnet`): dipole model ✓ (r clamped to ≥8)
- **Normal Distribution** (`normal-distribution`): Galton board physics ✓
- **Nuclear Decay** (`nuclear-decay-simulation`): N(t) = N₀e^(-λt) ✓
- **Inductor** (`inductor`): τ = L/R, I = V/R(1-e^(-t/τ)) ✓

## Parameter Validation

All checked configs have sensible min/max/default values:
- Resistances: min ≥ 10Ω (ohms-law, parallel-circuit)
- Masses: min ≥ 0.5 kg (on-the-table, parabolic-motion)
- Gravity: min ≥ 1 m/s² (parabolic-motion, motion-shot)
- Focal lengths: min ≥ 30px (mirrors)
- Inductance/capacitance: min > 0 (inductor-and-capacitor series)
- numTrials: min ≥ 20 (mendels-law)

## Already Well-Guarded Files (notable patterns)

Many files already had proper guards:
- `molecular-motion`: `dist === 0` early return
- `law-of-definite-proportions`: `dist > 0` check
- `phase-diagram`: `distance > 0` check  
- `kinetic-theory-model`: `dist > 0` and `currentSpeed > 0` checks
- `le-chateliers-principle-pressure`: `sp > maxSp` check before division
- `osmosis`: `speed > maxSpeed` check before division
- `ocean-currents`: `speed > 2` check before division
- `on-the-table`: `len < 3` early return
- `pascals-principle`: `len === 0` early return
- `memory-hierarchy`: `totalAccesses > 0` ternary
- `neuron`: `Math.max(tRange, 0.1)` guard
- `pcr`: `Math.max(timeRange, 1)` guard

## Missing Config Entries

The following sims have factory registrations but no `simulationConfigs` entry (they use `getSimConfig()` which returns undefined). Not a crash risk but means no parameter sliders in UI:
- `lens` (uses hardcoded defaults)
- `inductor` (uses hardcoded defaults)
- `nuclear-decay-simulation` (uses hardcoded defaults)

*Note: This is a data completeness issue, not a code bug. The sims work fine with their internal defaults.*

## Edge Cases

- All graph/plot renderers handle empty data arrays or zero ranges
- Animation loops clamp dt to prevent physics explosions (typically `Math.min(dt, 0.05)`)
- Magnetic field calculations clamp minimum distances to prevent singularities
- Lens/mirror equations handle the focal-point singularity (object at F)

## Files Audited (118/118)

All slugs from the assignment were found and reviewed. No missing files.
