# Audit Group D — 111 Simulations

**Auditor:** Liang (subagent)  
**Date:** 2026-03-02  
**Status:** ✅ Complete

## Summary

All 111 simulation files found and audited. **6 division-by-zero bugs fixed.** All simulations have `getStateDescription()` implemented. Scientific formulas verified correct across sampled files. Parameter min/max constraints in registry.ts prevent most zero-denominator scenarios at the UI level.

## Fixes Applied

### 1. `biology/population-dynamics.ts` — Div-by-zero in flee calculation
- **Line 135-136:** `dx / minPredDist` used raw distance that could approach 0
- **Fix:** Added `const safeDist = Math.max(minPredDist, 1)` and used it as denominator

### 2. `physics/principle-of-mirror.ts` — Div-by-zero in ray normalization
- **Line 62:** `dist = Math.sqrt(dx*dx + dy*dy)` could be 0 if points coincide
- **Fix:** Added `|| 1` fallback: `Math.sqrt(...) || 1`

### 3. `physics/thermometer.ts` — Div-by-zero in molecule boundary check
- **Line 77:** `dist = Math.sqrt(mol.x² + mol.y²)` used as denominator without guard
- **Fix:** Added `|| 1` fallback

### 4. `physics/prism.ts` — Div-by-zero in face normal / refraction normalization
- **Lines 106, 167, 188:** `leftNLen`, `rNLen`, `refLen` could be 0 for degenerate geometry
- **Fix:** Added `|| 1` fallback to all three `Math.sqrt()` calls

### 5. `chemistry/stellar-classification.ts` — Div-by-zero in Planck normalization
- **Line 325:** `peakIntensity` from Planck function could theoretically be 0
- **Fix:** Added `|| 1` fallback

### 6. `electricity/rlc-circuits.ts` — Div-by-zero at perfect resonance with R=0
- **Line 72:** `impedance = sqrt(R² + X²)` → 0 when R=0 and XL=XC (resonance)
- **Fix:** Added `|| 0.01` fallback (minimum 0.01Ω impedance)

## Scientific Accuracy — Verified Correct

| Simulation | Formula | Status |
|---|---|---|
| projectile / projectile-motion | x=v₀cos(θ)t, y=v₀sin(θ)t - ½gt² | ✅ Correct |
| snells-law / snells-law-refraction | n₁sin(θ₁) = n₂sin(θ₂) | ✅ Correct |
| simple-harmonic-motion | x(t)=A·cos(ωt+φ), ω=2πf | ✅ Correct |
| thermodynamic-heat-engine-cycle | Carnot η = 1 - Tc/Th | ✅ Correct |
| thin-lens-equation | 1/f = 1/do + 1/di, guarded for do≈f | ✅ Correct |
| torricellis-experiment | v = √(2gh) | ✅ Correct |
| reynolds-number-flow | Re = ρvD/μ | ✅ Correct |
| pressure | P = F/A (area guarded with Math.max) | ✅ Correct |
| pvnrt | PV = nRT | ✅ Correct |
| wheatstone-bridge | Diamond bridge layout, balanced condition | ✅ Correct |
| solenoid-magnetic-field | B = μ₀nI | ✅ Correct |
| stellar-parallax / stellar-parallax-3d | p = 1/d (arcsec/parsec) | ✅ Correct |
| stellar-classification | Wien's law λ_max = 2898000/T, Planck function | ✅ Correct |
| rlc-circuits | Z = √(R² + (XL-XC)²) | ✅ Correct |
| titration-curves | Henderson-Hasselbalch, strong/weak acid-base | ✅ Correct |
| psychrometer | Magnus-Tetens formula for dew point | ✅ Correct |
| three-body-problem | Gravitational F = Gm₁m₂/r², Verlet integration | ✅ Correct |
| standing-waves | Superposition of counter-propagating waves | ✅ Correct |
| sound-waves | Density waves with frequency/wavelength | ✅ Correct |
| spring-mass-system | F = -kx - γv, ζ = γ/ω₀ | ✅ Correct |
| rolling-motion-dynamics | Includes rotational inertia in acceleration | ✅ Correct |

## getStateDescription() — All Present

All 111 simulations have `getStateDescription()` implemented and return meaningful descriptive text about the current simulation state.

## Parameter Validation

Parameters are defined in `registry.ts` with min/max/step/default values. Spot-checked critical parameters:
- **viscosity** (reynolds): min=0.0005 ✅
- **starDistance** (stellar-parallax): min=1 ✅
- **turns** (solenoid): min=5 ✅
- **loadResistance** (potentiometer): min=8 ✅
- **sourceVoltage** (potentiometer): min=1 ✅
- **frequency** (simple-harmonic): min defined, non-zero ✅
- **dropRate** (polarity-of-water): min=1 ✅
- **frictionIntensity** (triboelectricity): param default=5, non-zero ✅

## Edge Case Handling — Notable Good Practices

- `thin-lens-equation`: Guards `|objectDistance - f| < 0.1` → sets Infinity
- `prism`: Guards `|denom| < 1e-10` for ray-face intersection
- `pressure`: Guards area with `Math.max(0.0001, area)`
- `vacuum-jar`: Uses `|| 1` for distance normalization
- `triangle-and-tetragon`: Uses `|| 1` for distance normalization
- `tidal-force`: Uses `|| 1` for distance normalization
- `wheatstone-bridge`: Uses `|| 1` for length normalization
- `swingby-1/2`: Adds softening constants to distances
- `three-body-problem`: Guards energy range with `Math.max(0.1, range)`
- `reaction-kinetics`: Guards `distance > 0` and `total = molecules.length || 1`
- `tidal-forces`: Guards `magnitude > 0.01` before normalization
- `torricellis-experiment`: Guards `holeHeight > 0` for flight time

## Files Audited (111)

All files in the assigned slug list were found and reviewed:
photoelectric-effect, photoelectric-effect-2, photosynthesis, pi-monte-carlo, plants-respiration, plate-tectonics, polar-molecule-and-nonpolar-molecule, polarity-of-water, polarization, polygonal-wheel, population-dynamics, potentiometer, precipitation-reaction, pressure, pressure-volume-diagram, prime-sieve, principle-of-least-time, principle-of-mirror, principle-of-satellite, prism, projectile, projectile-motion, psychrometer, pulley-3, pump-problem, pvnrt, pythagoras-tree, pythagorean-theorem, pythagorean-theorem-2, quantum-of-light, radians, radio-wave-communication, rainbow-by-raindrops, rainbow-colors, rainbow-formation, reaction-kinetics, resonance, reynolds-number-flow, ripple-tank, rlc-circuits, rock-cycle, rolling-motion-dynamics, rsa-encryption, seasons-axial-tilt, seismic-waves, simple-harmonic-motion, snells-law, snells-law-refraction, solar-system, solenoid-magnetic-field, sorting-algorithms, sound-waves, spring-mass-system, stack-queue-visualization, standing-waves, stellar-lifecycle, sum-of-exterior-angle, superposition-and-interference, surface-tension, swingby-1, swingby-2, taylor-series, tcp-ip-routing, temperature-and-reaction-rate, test-cross, theo-jansen, thermodynamic-heat-engine-cycle, thermometer, thin-film-interference, thin-lens-equation, three-body-problem, three-phase-equilibrium, three-primary-colors, ticker-timer, tidal-force, tidal-forces, tides, titration-curves, torricellis-experiment, total-internal-reflection, touch-screen, transistor, transistor-2, transistor-switch, triangle-and-tetragon, triangle-trick, triboelectricity, trigonometric-functions, tuning-fork-and-sound-wave, uniform-motion, uniformly-accelerated-motion, ursa-minor-3d, vacuum-jar, vapor-pressure-lowering, water-cycle, water-waves, wave-interference, wave-propagation, wave-reflection-transmission, waveform, weather-fronts, wheatstone-bridge, why-are-cells-small, why-does-the-moon-rise-50-minutes-later-each-day, why-does-the-moon-seem-to-follow-me, why-is-the-sky-blue, zodiac, zodiac-2, stellar-classification, stellar-parallax, stellar-parallax-3d
