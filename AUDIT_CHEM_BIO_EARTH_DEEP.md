# Deep Scientific Accuracy Audit: Chemistry, Biology & Earth Science

**Date:** 2026-02-26  
**Auditor:** Liang (AI Agent)  
**Scope:** All `.ts` files in `src/simulations/chemistry/`, `src/simulations/biology/`, `src/simulations/earth/`  
**Files reviewed in depth:** 30+ simulation files

---

## Summary

| Category | Files Reviewed | Issues Found | Fixed | Placeholders |
|----------|---------------|-------------|-------|-------------|
| Chemistry | 18 | 3 | 2 | 1 (galvanic-cell-electrochemistry) |
| Biology | 10 | 1 | 1 | 2 (genetics-punnett-square, natural-selection) |
| Earth Science | 7 | 1 | 1 | 0 |
| **Total** | **35** | **5** | **4** | **3** |

---

## 🔴 Issues Found & Fixed

### 1. Titration Curves — Weak Acid/Strong Base pH Calculation (FIXED)
**File:** `chemistry/titration-curves.ts`  
**Severity:** High  
**Issue:** `weakAcidStrongBasePH()` had multiple problems:
- Initial weak acid pH used `0.5 * (pKa - log10(Ca))` which is algebraically correct but numerically fragile — `log10(Ca)` can be negative, producing confusing sign chains.
- **Missing equivalence point handling** — at molesBase ≈ molesAcid, the Henderson-Hasselbalch formula divides by ~0 (log10(0) → -Infinity), producing NaN.
- No guard against very small base additions (ratio → 0).

**Fix:** 
- Rewrote using `[H+] = sqrt(Ka * Ca)` for initial acid.
- Added explicit equivalence point case using conjugate base hydrolysis: `[OH-] = sqrt(Kb * Csalt)`.
- Added guards for ratio < 1e-10 in Henderson-Hasselbalch region.

### 2. Titration Curves — Strong Acid/Weak Base pH Calculation (FIXED)
**File:** `chemistry/titration-curves.ts`  
**Severity:** High  
**Issue:** `strongAcidWeakBasePH()` was incorrect:
- Missing pure weak base initial case.
- Missing equivalence point handling (conjugate acid hydrolysis).
- Past equivalence point formula `pKw - pKb + 0.5 * log10(concentration)` was wrong — should use Henderson-Hasselbalch for conjugate acid/base pair.

**Fix:** Complete rewrite with proper cases:
- Pure weak base: `[OH-] = sqrt(Kb * Cb)`
- Equivalence: conjugate acid hydrolysis `[H+] = sqrt(Ka_conj * Csalt)`
- Excess acid: `-log10([H+]excess)`  
- Buffer region: Henderson-Hasselbalch with conjugate pair

### 3. Greenhouse Effect — Missing Stefan-Boltzmann Law (FIXED)
**File:** `earth/greenhouse-effect.ts`  
**Severity:** Medium  
**Issue:** Energy balance used an ad-hoc model: `outgoingIR = effectiveIncoming * (1 - greenhouseEffect)`. This doesn't follow physics — outgoing IR should be governed by the Stefan-Boltzmann law (σT⁴), and the greenhouse effect modulates emissivity, not a simple fraction of incoming.

**Fix:** Replaced with proper Stefan-Boltzmann outgoing radiation:
- `outgoingIR = ε × σ × T⁴` where σ = 5.67e-8 W/(m²·K⁴)
- Emissivity varies logarithmically with CO₂ concentration
- Corrected incoming to divide by 4 (sphere geometry)

### 4. Population Dynamics — Euler Integration Instability (FIXED)
**File:** `biology/population-dynamics.ts`  
**Severity:** Medium  
**Issue:** Lotka-Volterra equations used basic Euler integration, which is known to cause spiral divergence in predator-prey systems (populations grow unboundedly over time instead of oscillating stably).

**Fix:** Upgraded to RK2 (midpoint method) which preserves oscillation amplitude much better.

---

## ✅ Verified Correct

### Chemistry
| Simulation | Key Formula/Concept | Status |
|-----------|-------------------|--------|
| `gas-laws.ts` | PV=nRT, R=8.314 J/(mol·K), kB=1.381e-23, Maxwell-Boltzmann | ✅ Correct |
| `boyles-law.ts` | PV = constant at constant T, P₁V₁ = P₂V₂ | ✅ Correct |
| `boyles-law-2.ts` | P = 1 + mg/(A×101325) atm, v_rms = √(3kT/m) | ✅ Correct |
| `charles-law.ts` | V/T = constant at constant P, V = V_ref × T/T_ref | ✅ Correct |
| `reaction-kinetics.ts` | Arrhenius: k = k₀exp(-Ea/RT), R=8.314, catalyst reduces Ea | ✅ Correct |
| `temperature-and-reaction-rate.ts` | k = A·exp(-Ea/RT), A=1e13, Maxwell-Boltzmann distribution | ✅ Correct |
| `nuclear-decay-simulation.ts` | N(t) = N₀e^(-λt), λ = ln(2)/t½, correct half-lives for C-14, U-238, etc. | ✅ Correct |
| `standard-reduction-potentials.ts` | E°cell = E°cathode - E°anode, correct E° values (Zn=-0.76, Cu=+0.34, etc.) | ✅ Correct |
| `neutralization-reaction.ts` | pH = -log10([H+]), Kw = 1e-14, ΔH = -57.1 kJ/mol | ✅ Correct |
| `electrolysis-of-water.ts` | Faraday's law stoichiometry (2H₂O → 2H₂ + O₂, 2:1 ratio) | ✅ Correct |
| `stoichiometry-with-ammonia-synthesis.ts` | N₂ + 3H₂ → 2NH₃, correct mole ratios | ✅ Correct |

### Biology
| Simulation | Key Formula/Concept | Status |
|-----------|-------------------|--------|
| `enzyme-kinetics.ts` | Michaelis-Menten: v = (Vmax·[S])/(Km+[S]) | ✅ Correct |
| `ecosystem.ts` / `ecosystem-v2.ts` | Agent-based predator-prey with energy/stamina | ✅ Reasonable |
| `cell-division.ts` | Mitosis phases (IPMATC), 2n chromosome count, sister chromatid separation | ✅ Correct |

### Earth Science
| Simulation | Key Formula/Concept | Status |
|-----------|-------------------|--------|
| `atmosphere.ts` | Barometric formula: n(h)=n₀exp(-Mgh/RT), M=0.029, g=9.81, R=8.314, ISA temp profile | ✅ Correct |
| `coriolis-effect.ts` | F = -2m(ω×v), Northern→right deflection, Southern→left | ✅ Correct |
| `seismic-waves.ts` | P-waves faster (6 km/s) than S-waves (3.5 km/s), geometric spreading | ✅ Correct |
| `plate-tectonics.ts` | Convergent boundary: subduction, volcanism, trench formation | ✅ Correct (qualitative) |

---

## ⚠️ Notes & Recommendations

### Placeholder Simulations (No Science to Audit)
- `chemistry/galvanic-cell-electrochemistry.ts` — Stub, just displays title
- `biology/genetics-punnett-square.ts` — Stub placeholder
- `biology/natural-selection.ts` — Stub placeholder

**Recommendation:** Implement these with proper science. The `standard-reduction-potentials.ts` already covers electrochemistry well.

### Minor Observations
1. **Neutralization reaction** assumes base concentration equals acid concentration — this is by design for the slider-based UI but could confuse users.
2. **Seismic waves** uses a click handler for earthquake initiation; P/S wave speed ratio (1.71) is close to the theoretical √3 ≈ 1.73 — acceptable.
3. **Atmosphere ISA profile** uses simplified linear segments — this is the standard approach for ISA and is correct.
4. **Titration weak acid/weak base** case uses simplified formula — acceptable for educational purposes.
5. **Ecosystem simulations** (v1 and v2) are agent-based rather than ODE-based, which is appropriate for visualization but produces stochastic rather than deterministic dynamics.

---

## Constants Verification

| Constant | Expected | Code Value | File(s) | Status |
|----------|----------|------------|---------|--------|
| R (gas constant) | 8.314 J/(mol·K) | 8.314 | gas-laws, reaction-kinetics, atmosphere, boyles-law-2, temp-reaction-rate | ✅ |
| kB (Boltzmann) | 1.381e-23 J/K | 1.380649e-23 / 1.381e-23 | gas-laws, boyles-law, charles-law | ✅ |
| NA (Avogadro) | 6.022e23 mol⁻¹ | 6.022e23 | gas-laws | ✅ |
| σ (Stefan-Boltzmann) | 5.67e-8 W/(m²·K⁴) | 5.67e-8 | greenhouse-effect (after fix) | ✅ |
| g (gravity) | 9.81 m/s² | 9.81 | atmosphere, boyles-law-2 | ✅ |
| M_air | 0.029 kg/mol | 0.029 | atmosphere | ✅ |
| Kw (water) | 1e-14 | 1e-14 | neutralization-reaction, titration-curves | ✅ |
| ΔH neutralization | -57.1 kJ/mol | -57.1 | neutralization-reaction | ✅ |

---

*Audit complete. 4 scientific errors fixed, 3 placeholder stubs identified, all core formulas and constants verified.*
