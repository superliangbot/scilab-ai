# Audit Report: Batches 22–24

**Date:** 2026-02-26
**Commit:** `2101258` — `fix: audit corrections for batches 22-24`
**Files audited:** 52 simulation files across physics, math, chemistry, biology, electricity, astronomy, technology

## Summary

All 52 simulation files from batches 22–24 were reviewed for:
- Division-by-zero vulnerabilities
- Formula correctness
- Parameter validation (clamping)
- `getStateDescription()` quality and meaningfulness

**7 files were fixed. 45 files passed without issues.**

## Issues Found & Fixed

### 1. `physics/microscope.ts` — Div-by-zero in thin lens equation
- **Line 29:** `1 / (1/focalLength - 1/objectDist)` produces `Infinity` when objectDist equals focalLength
- **Fix:** Added guard for `Math.abs(denom) < 1e-10`, returns `{ Infinity, Infinity }` gracefully (matching optics.ts pattern)

### 2. `physics/pressure.ts` — Area parameter not clamped
- **Line 60:** `area = params.area ?? 0.01` allows `area = 0`, causing div-by-zero in `force / area`
- **Fix:** `area = Math.max(0.0001, params.area ?? 0.01)`

### 3. `physics/phase-array.ts` — Frequency parameter not clamped
- **Line 106:** `frequency` could be 0, causing div-by-zero in `200 / frequency` (wavelength calc, 3 locations)
- **Fix:** `Math.max(0.1, params.frequency ?? 2)`

### 4. `technology/microbit-pulse.ts` — Amplitude could be zero
- **Line 51:** `amplitude = Math.max(0, ...)` allows 0, used as divisor in `(v / amplitude) * plotH`
- **Fix:** `Math.max(0.01, params.amplitude ?? 5)`

### 5. `math/pascals-triangle.ts` — numRows not clamped
- **Line 49:** `numRows` could be 0, causing div-by-zero in `availH / numRows` and `(width-40) / numRows`
- **Fix:** `Math.max(1, Math.round(params.numRows ?? 10))`

### 6. `physics/pendulum.ts` — Length parameter not clamped
- **Line 82:** `length` could be 0, causing div-by-zero in `gravity / length`
- **Fix:** `Math.max(0.01, params.length ?? 1.5)`

### 7. `physics/period-of-pendulum.ts` — Length parameters not clamped
- **Lines 89–90:** `length1` and `length2` could be 0, used in `g / p.length` angular acceleration calc
- **Fix:** `Math.max(0.01, ...)` for both

## Already Properly Guarded (no fix needed)

| File | Guard |
|------|-------|
| `physics/optics.ts` | `Math.abs(denom) < 0.01` check before division |
| `physics/mirrors.ts` | `Math.abs(vInv) < 1e-10` check, returns Infinity |
| `physics/osmosis.ts` | Divides by `speed` only when `speed > maxSpeed` |
| `physics/pvnrt.ts` | Divides by `currentSpeed` only when `> 0.01` |
| `electricity/parallel-circuit.ts` | Resistances clamped to 0.1 at calc time, `maxCurrent` clamped to 0.01, `counts[b]` min 3 |
| `math/polygonal-wheel.ts` | `numSides` clamped to min 3 |
| `chemistry/normal-distribution.ts` | `n > 0` ternary guard on all divisions |
| `physics/on-the-table.ts` | `mass` clamped to 0.01 |
| `technology/microbit-pulse.ts` | `frequency` clamped to 0.1 |

## Formula Verification

- **Pendulum:** `T = 2π√(L/g)` ✅
- **Satellite orbit:** `T = 2π√(a³/GM)` ✅ (Kepler's third law)
- **Thin lens:** `1/f = 1/do + 1/di` ✅ (optics.ts, microscope.ts)
- **Mirror equation:** `1/f = 1/v + 1/u` ✅
- **Pressure:** `P = F/A` ✅
- **PV diagram:** Isothermal/isochoric/isobaric/adiabatic processes ✅
- **Parallel circuit:** `I = V/R` per branch, resistances properly handled ✅
- **Photoelectric effect:** `KE = E - W` (photon energy minus work function) ✅

## getStateDescription() Quality

All 52 files implement `getStateDescription()` with meaningful, context-rich descriptions including:
- Current parameter values with units
- Active state/mode identification
- Relevant computed quantities
- Educational context where appropriate

**No generic or placeholder descriptions found.** All descriptions are simulation-specific and informative.

## Build Status

`npx next build` — ✅ Compiled successfully, all pages generated.
