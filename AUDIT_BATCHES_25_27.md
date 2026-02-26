# Audit Report: Batches 25-27

**Date:** 2026-02-26
**Commit:** 9f69eb9
**Files audited:** 45 simulation files across physics, chemistry, electricity, astronomy, math

## Summary

Reviewed all 45 simulation files from batches 25 (commit 252457c), 26 (commit 037db47), and 27 (commit b898d2b). Checked formulas, division-by-zero safety, parameter validation, and getStateDescription() quality.

## Issues Found & Fixed

### 1. Division-by-zero: `rectifier-circuit.ts` (batch 25)
- **Location:** `drawArrow()` function, line 113
- **Issue:** `len = Math.sqrt(dx*dx + dy*dy)` used as divisor without guard. If arrow start == end, produces NaN.
- **Fix:** Added `if (len < 0.001) return;` early exit.

### 2. Division-by-zero: `seeing-the-light.ts` (batch 26)
- **Location:** Dashed ray drawing function, line 61
- **Issue:** `dist = Math.sqrt(dx*dx + dy*dy)` used as divisor for `nx`, `ny` without guard. Zero-length rays produce NaN.
- **Fix:** Added `if (dist < 0.001) return;` early exit.

### 3. Missing parameters: `resistance-connection` registry entry
- **Location:** `registry.ts`, slug "resistance-connection"
- **Issue:** Registry config had no `parameters` array, so the UI would show no sliders despite the simulation using `voltage`, `resistance1`, `resistance2`, and `connectionType` params.
- **Fix:** Added parameters array with appropriate min/max/step/defaults matching the simulation's `update()` defaults. All resistance min values set to 1 to prevent division by zero in Ohm's law calculations.

## Audit Results: No Issues

### Formulas ✅
All physics/math formulas verified correct:
- Spring: F = -kx, ω = √(k/m) ✓
- Spring pendulum: r'' and θ'' polar equations ✓
- RLC circuit: impedance Z, resonance f₀ = 1/(2π√LC) ✓
- Coulomb scattering (Rutherford): F = kZ₁Z₂/r² ✓
- Doppler (speedgun): Δf = 2vf₀/c ✓
- Ohm's law: V = IR, series/parallel ✓
- Snell's law (refraction, telescope) ✓
- Sound: wavelength = speed/frequency ✓
- Specific heat: Q = mcΔT ✓

### Division Safety ✅
Most files already had proper guards:
- `seismic-wave.ts`: `if (dist < 1) continue` ✓
- `speaker.ts`: `if (len > 0)` ✓
- `spectrogram.ts`: `if (maxMag > 0)` ✓
- `sound-analyzing.ts` / `sound-fft.ts`: `Math.max(..., 0.01)` ✓
- `spring-pendulum.ts`: `r > 0.001 ?` ternary guard ✓
- `solar-system-making.ts`: `dist*dist + 100` softening ✓
- `rutherford*.ts`: `Math.max(r2, 300/400)` clamp ✓
- `separation-of-iron.ts`: `dist > 0` check ✓

### Parameter Validation ✅
All 44 other simulations have proper registry parameters with min > 0 for divisor values (mass, springConstant, frequency, resistance, etc.).

### getStateDescription() Quality ✅
All 45 simulations return meaningful, context-rich descriptions including:
- Current parameter values
- Computed state (velocities, temperatures, currents, etc.)
- Educational context explaining the physics

## Build
`npx next build` passed successfully after all fixes.
