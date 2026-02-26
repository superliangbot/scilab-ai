# Audit Report: Batches 28–30 (Final Wave)

**Date:** 2026-02-26  
**Auditor:** Liang (automated)  
**Files Audited:** 67 simulation files  
**Commit:** `de5d726` — `fix: audit corrections for batches 28-30`

## Summary

All 67 simulations from batches 28–30 were audited for:
- Division-by-zero vulnerabilities
- Formula correctness
- Parameter validation
- `getStateDescription()` quality
- Category placement accuracy

**Result: 11 issues found and fixed across 10 files.**

---

## Issues Found & Fixed

### 1. Division-by-Zero Guards (5 fixes)

| File | Issue | Fix |
|------|-------|-----|
| `biology/why-are-cells-small.ts` | `dist` (line 74) and `newDist` (line 80) used as divisor with no zero guard | Added `\|\| 1` fallback to both `Math.sqrt` calls |
| `chemistry/temperature-and-reaction-rate.ts` | Collision check `dist < 12` includes `dist === 0`, causing `nx = dx / dist` to be `NaN` | Changed guard to `dist > 0 && dist < 12` |
| `physics/tidal-force.ts` | Two unguarded `dist` / `distMoon` divisors for tidal force vectors | Added `\|\| 1` fallback to both distance calculations |
| `physics/vacuum-jar.ts` | `dist` in balloon collision could be 0 when molecule overlaps center exactly | Added `\|\| 1` fallback |
| `physics/wheatstone-bridge.ts` | `len` between two resistor endpoints used as divisor with no guard | Added `\|\| 1` fallback |

### 2. Category Misplacements (6 fixes)

| File | Was | Should Be | Rationale |
|------|-----|-----------|-----------|
| `stellar-classification.ts` | chemistry | **astronomy** | H-R diagram and spectral types are astronomy |
| `trigonometric-functions.ts` | chemistry | **math** | Pure mathematics topic |
| `test-cross.ts` | physics | **biology** | Mendelian genetics concept |
| `sum-of-exterior-angle.ts` | physics | **math** | Geometry topic |
| `stoichiometry-with-ammonia-synthesis.ts` | physics | **chemistry** | Chemical stoichiometry |
| `stoichiometry-with-water-synthesis.ts` | physics | **chemistry** | Chemical stoichiometry |

All 6 files were moved to their correct category directories and registry imports/categories updated.

---

## Verified Clean (No Issues)

The remaining 57 simulations passed all checks:

- **Formulas:** Physics/math formulas verified correct (spring constants, wave equations, gravitational forces, Torricelli's theorem, Snell's law, Wheatstone bridge balance, etc.)
- **Div-by-zero:** Already guarded via softening constants (swingby-1/2: `+ 10`/`+ 5`), explicit zero checks (spring-wave: `if (len === 0) return`), `|| 1` fallbacks (triangle-and-tetragon), or `Math.max()` floors (three-body-problem, ticker-timer, status-change-of-water)
- **Parameters:** All param ranges validated — minimums prevent zero-division (harmonicNumber min=1, wavelength min=10+, starDistance min=1, etc.)
- **`getStateDescription()`:** All 67 files have meaningful, context-aware state descriptions returning simulation-specific values

---

## Build Status

✅ `npx next build` — compiled successfully, all pages generated.

---

## Cumulative Audit Status

With this final batch, **all 500 simulations** in the scilab-ai catalog have been audited across batches 1–30.
