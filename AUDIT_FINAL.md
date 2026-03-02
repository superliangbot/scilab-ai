# Final Audit: Batches 25-28 (68 Simulations)

**Date:** 2026-03-02  
**Auditor:** Liang (automated)  
**Scope:** All simulation files added in batches 25-28

## Summary Stats

| Metric | Count |
|--------|-------|
| Total sim files audited | 68 |
| Total sim files in project | 530 |
| Registry config entries | 415 |
| Registry factory entries | ~530 (includes import paths) |
| Issues found | 8 |
| Fixes applied | 3 |

## Issues Found

### 🔴 Critical — Missing Factory Entries (sims won't load)

| # | Slug | File | Description | Severity | Status |
|---|------|------|-------------|----------|--------|
| 1 | `rgb` | `physics/rgb.ts` | Config exists but no factory entry in `simulationFactories` | CRITICAL | **FIXED** |
| 2 | `seismic-wave` | `physics/seismic-wave.ts` | Config exists but no factory entry in `simulationFactories` | CRITICAL | **FIXED** |
| 3 | `sound-wave` | `physics/sound-wave.ts` | Config exists but no factory entry in `simulationFactories` | CRITICAL | **FIXED** |

### 🟡 Medium — Debatable Category Placement

These files are in categories that could be argued as incorrect, though the registry and file location are consistent with each other:

| # | Slug | Current Category | Suggested Category | Rationale |
|---|------|------------------|--------------------|-----------|
| 4 | `reproduction` | chemistry | biology | Cell reproduction is a biological process |
| 5 | `resistance-connection` | chemistry | electricity | Resistor circuits belong in electricity |
| 6 | `stellar-classification` | chemistry | astronomy | HR diagram and star types are astronomy |
| 7 | `sierpinski-curve` | physics | math | Fractal curves are mathematical constructs |
| 8 | `room-convection` | chemistry | physics | Thermal convection is a physics topic |

**Note:** These are subjective and may reflect the original Korean science curriculum categorization. No changes made.

## Division-by-Zero Analysis

All 68 files were scanned for unguarded division operators. Results:

- **All parameter minimums are positive** where used as divisors (resistance min=1Ω, frequency min=1Hz, mass min=0.1kg, eyepieceFL min=10mm, etc.)
- **Guards present where needed:**
  - `rlc-serial-circuit.ts`: `omega = 2π * freq` where freq min=1 → safe
  - `step-response.ts`: zeta=1 handled via `Math.abs(zeta - 1) < 0.01` branch → safe
  - `spring-pendulum.ts`: `r > 0.001` guard on angular acceleration division → safe
  - `stroboscope.ts`: `strobeFrequency > 0 ?` ternary guard → safe
  - `rectifier-circuit.ts`: `Math.max(tau, 0.001)` and `Math.max(amp, 0.1)` → safe
  - `reaction-rate-of-solution.ts`: `Math.max(reactionHistory.length, 1)` and `Math.max(step, 0.001)` → safe
  - `seismometer-and-inertia.ts`: `(quakeAmplitude || 1)` fallback → safe
  - `sound-fft.ts`: `(maxAmp || 1)` fallback → safe
  - `standing-wave-synthesis.ts`: `Math.max(frequency, 0.01)` → safe
  - `status-solid-liquid-gas.ts`: speed clamping prevents zero-speed division issues
  - `standing-waves-on-a-drum-surface.ts`: `gammaFactor` in Bessel never zero for valid inputs

**No unguarded division-by-zero issues found.**

## Scientific Accuracy Check

All key formulas verified correct:

| Simulation | Formula | Verdict |
|------------|---------|---------|
| `spectrum-of-hydrogen` | 1/λ = R_H(1/n₁² - 1/n₂²), R_H=1.097×10⁷ m⁻¹ | ✅ Correct |
| `stellar-classification` | Wien's law: λ_max = 2,898,000/T nm·K | ✅ Correct |
| `stellar-classification` | Planck function shape (normalized) | ✅ Correct |
| `refraction-a-fish-under-water` | Snell's law: n₁ sin θ₁ = n₂ sin θ₂ | ✅ Correct |
| `rlc-serial-circuit` | Z = √(R² + (X_L - X_C)²), f₀ = 1/(2π√LC) | ✅ Correct |
| `spring` | ω = √(k/m), F = -kx (Hooke's law) | ✅ Correct |
| `spring-pendulum` | Coupled radial + angular spring-pendulum equations | ✅ Correct |
| `standing-waves-on-a-string` | f_n = n/(2L)·√(T/μ) | ✅ Correct |
| `standing-waves-on-a-drum-surface` | Bessel function modes J_m(α_mn r/a) | ✅ Correct |
| `speedgun` | Doppler: Δf = 2vf₀/c | ✅ Correct |
| `stellar-parallax` | d = 1/p (parsecs, p in arcseconds) | ✅ Correct |
| `stoichiometry-with-ammonia-synthesis` | N₂ + 3H₂ → 2NH₃ | ✅ Correct |
| `stoichiometry-with-water-synthesis` | 2H₂ + O₂ → 2H₂O | ✅ Correct |
| `specific-heat` | Q = mcΔT | ✅ Correct |
| `status-change-of-water` | Phase transitions with latent heat plateaus | ✅ Correct |
| `resistance-connection` | Series: R=R₁+R₂, Parallel: 1/R=1/R₁+1/R₂ | ✅ Correct |
| `serial-parallel-circuit` (1,2,3) | Ohm's law, parallel/series combinations | ✅ Correct |
| `springs` | Series: 1/k=1/k₁+1/k₂, Parallel: k=k₁+k₂ | ✅ Correct |
| `straw` | h = ΔP/(ρg) | ✅ Correct |

## getStateDescription() Check

All 68 simulations have `getStateDescription()` implemented and return meaningful descriptive text including current parameter values and simulation state.

## Parameter Validation

All parameters in registry configs have sensible min/max/default values. No parameter allows a value that would cause mathematical errors (division by zero, negative square roots, etc.).

## Registry Reconciliation (Full Project)

### Orphaned Config (config exists, no file)
- `coupled-oscillators` — has config entry but file is at `physics/coupled-oscillators.ts` (actually exists, likely a duplicate entry issue)

### Files Without Config (115 files)
Many older simulation files exist without registry config entries. These are pre-batch files that were likely imported from an older system. This is expected and not an issue for batches 25-28.

### Batch 25-28 Specific
- **All 68 batch files have matching config entries** ✅
- **After fixes, all 68 batch files have matching factory entries** ✅

## Fixes Applied

1. **Added missing factory entry for `rgb`** in registry.ts
2. **Added missing factory entry for `seismic-wave`** in registry.ts  
3. **Added missing factory entry for `sound-wave`** in registry.ts

## Build Verification

See build output below.
