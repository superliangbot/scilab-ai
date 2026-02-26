# Audit Report: Batches 16-18

**Date:** 2026-02-26  
**Files audited:** 45 simulation files across 3 batches  
**Build status:** ✅ Passes

## Issues Found & Fixed

### 1. fuel-cell.ts — Efficiency calculation bug (Batch 16)
**Severity:** High  
**Issue:** `efficiency = Math.min(0.95, (voltage / 1.48) * 100)` mixed percentage (×100) with a fraction cap (0.95). Result: efficiency always clamped to 0.95%, displayed as "0.9%".  
**Fix:** Changed cap to `Math.min(95, ...)` so efficiency correctly displays up to 95%.

### 2. fuel-cell — Wrong category in registry (Batch 16)
**Severity:** Medium  
**Issue:** Hydrogen PEM fuel cell categorized as `"biology"` instead of `"chemistry"`.  
**Fix:** Updated category to `"chemistry"` in registry.

### 3. led.ts — Division by zero on bandGap=0 (Batch 18)
**Severity:** High  
**Issue:** `wavelengthFromBandGap(eV)` computes `1240 / eV`. Registry allowed `min: 0`, enabling division by zero.  
**Fix:** Added `Math.max(eV, 0.01)` guard in the function + changed registry min from 0 to 0.5 eV.

### 4. lens.ts — Division by zero when object at focal point (Batch 18)
**Severity:** Medium  
**Issue:** Thin lens equation `v = f*u / (u - f)` produces division by zero when objectDist equals focalLength (both adjustable via sliders, both starting at different values but could overlap).  
**Fix:** Added denominator check; returns very large image distance (image at infinity) when `u == f`.

## Files Reviewed — No Issues

The remaining 41 files were reviewed for:
- Formula correctness (verified against standard physics/chemistry/biology equations)
- Division-by-zero guards (all checked — most had proper `Math.max()` or `dist > 0` guards)
- Parameter ranges and defaults (reasonable across the board)
- `getStateDescription()` (all return meaningful, descriptive strings)
- Canvas rendering (coordinates, labels, colors all sensible)

Notable well-implemented sims:
- **galilean-moons.ts** — Correct orbital periods, good top/side view toggle
- **galton-board.ts** — Proper binomial distribution visualization
- **inductor-and-capacitor.ts** — Correct RK4 integration for LC circuit
- **keplers-law.ts** — Proper orbital mechanics
- **general-relativity.ts** — Nice Schwarzschild radius visualization with light bending
- **life-game.ts** — Standard Conway's Game of Life, clean implementation
- **lc-oscillator.ts** — Correct resonant frequency formula, good energy visualization

## Commit
`6eab6f0` — fix: audit corrections for batches 16-18
