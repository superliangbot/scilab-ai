# Audit Report: Batches 19-21

**Date:** 2026-02-26  
**Auditor:** Liang (automated)  
**Commits:** e17863c (batch 19), 16f8d63 (batch 20), a3f415d (batch 21)  
**Total simulations reviewed:** 45 files across biology, chemistry, electricity, physics, technology

## Summary

All 45 simulations were reviewed for scientific accuracy, div-by-zero risks, parameter validation, and meaningful `getStateDescription()`. **7 files required fixes** (all div-by-zero guards). No formula errors found.

## Issues Found & Fixed

| File | Issue | Fix |
|------|-------|-----|
| `technology/microbit-pulse.ts` | `1/frequency` — frequency could be 0 | Clamped frequency ≥ 0.1 Hz; duty cycle 0–100; amplitude ≥ 0 |
| `physics/newton-ring.ts` | `/ refractiveIndex` and `/ lensRadius` — could be 0 | Clamped lensRadius ≥ 1, wavelength ≥ 1, refractiveIndex ≥ 0.01 |
| `physics/moment-of-inertia-3d.ts` | `torque / I` in `getStateDescription()` — I could be 0 if mass/dimension = 0 | Added `I > 0` guard; clamped mass ≥ 0.01, dimension ≥ 0.01 |
| `chemistry/normal-distribution.ts` | `/ sigma` in normalPDF — sigma could be 0 | Clamped sigma ≥ 0.01 in PDF function |
| `physics/on-the-table.ts` | `netForce / mass` — mass could be 0 | Clamped mass ≥ 0.01, friction ≥ 0 |
| `physics/microscope.ts` | `1/fObjective`, `1/fEyepiece`, `1/objectDistance` — could be 0 | Clamped all three ≥ 1 |
| `physics/mirrors.ts` | `focalLength` used in denominator for curved mirrors | Clamped focalLength ≥ 1 (already had Infinity guard for image calc) |

## Verified Correct (No Issues)

### Scientific Accuracy ✅
- **Meiosis** — correct 9-stage sequence, proper 2n→n reduction
- **Maximum Elongation** — correct orbital mechanics, elongation angle calc uses dot product properly
- **Molecule Viewer** — accurate geometries (H₂O 104.5°, CH₄ 109.5°, etc.)
- **RC Circuit (microbit-capacitor)** — correct V(t) = V₀(1-e^(-t/RC)) and V₀e^(-t/RC); τ=RC formula correct
- **Eratosthenes (measuring-the-earth)** — C=(360/θ)×d formula correct
- **Horizon distance (measuring-the-earth-2)** — d=√(2Rh) correct
- **Mendeleev** — element data spot-checked (H, He, C, Fe, etc.) — accurate
- **Mendel's Law** — correct 3:1 ratio for monohybrid F2, 9:3:3:1 for dihybrid
- **Michelson Interferometer** — path difference = 2×offset, intensity = cos²(phase/2) ✅
- **Microscope** — thin lens equation 1/v - 1/u = 1/f correct
- **Mirrors** — mirror equation 1/f = 1/v + 1/u, sign conventions correct
- **Newton's Rings** — r_n = √(nλR/μ), path diff = 2μt + λ/2 (phase change) ✅
- **Moment of Inertia** — all I/(mR²) ratios correct (2/5 sphere, 1/2 cylinder, 2/3 hollow sphere, 1 hollow cylinder)
- **Newton's Cradle** — pendulum physics with angular acceleration = -(g/L)sin(θ) correct
- **Oersted's Experiment** — magnetic field direction from current correct
- **On the Table** — force decomposition, normal force, friction model correct
- **Ohm's Law** — V=IR, I=V/R correct, resistance guarded with Math.max(resistance, 0.1)
- **Nuclear Chain Reaction** — fission produces 2-3 neutrons, control rod absorption modeled
- **Normal Distribution** — Galton board → binomial → normal, PDF formula correct
- **Neutralization** — pH = -log₁₀[H⁺], properly handles excess acid/base
- **Nephron** — anatomically correct pathway (glomerulus → PCT → loop → DCT → collecting duct)
- **Neuron** — action potential phases correct (-70→+40→-80→-70 mV)
- **NaCl Ionic Bond** — electron transfer Na→Cl, Lennard-Jones-like energy curve
- **Newtonian Reflector** — parabolic primary + flat secondary at 45° correct
- **PWM (microbit-pulse)** — V_avg = V × duty_cycle correct
- **Motion Analysis** — s = ut + ½at² correct
- **Motion Shot (projectile)** — parabolic trajectory with correct decomposition
- **Multiple Reflections** — n = 360/θ - 1 images formula correct

### getStateDescription() ✅
All 45 simulations have meaningful, informative `getStateDescription()` methods that report current parameter values and computed results.

### Code Quality ✅
- Consistent coding style across all files
- Proper TypeScript types used
- Canvas rendering well-structured with helper functions
- No memory leaks (event listeners cleaned up in destroy())

## Build Status
`npx next build` — ✅ compiled successfully
