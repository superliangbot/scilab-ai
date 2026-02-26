# Simulation Duplicate & Similarity Audit

**Date:** 2026-02-26  
**Total simulation files:** 500  
**Registry entries:** 493 unique slugs  

---

## 1. Registry Issues

### Duplicate Slugs in Registry
None found. All 493 slugs are unique.

### Orphaned Registry Entry (slug exists in registry but no matching file)
| Slug | Notes |
|------|-------|
| `doppler-wave-effect` | Points to `./waves/doppler-effect.ts` — file exists but slug doesn't match filename |

### Unregistered Files (file exists but no registry entry)
| File | Notes |
|------|-------|
| `waves/beats.ts` | Missing from registry entirely |
| `waves/harmonics.ts` | Missing from registry entirely |
| `waves/resonance.ts` | Missing from registry entirely |
| `waves/snells-law.ts` | Missing from registry entirely |
| `waves/doppler-effect.ts` | Registered as `doppler-wave-effect` (slug mismatch) |
| `physics/coupled-oscillators.ts` | Missing from registry entirely |
| `technology/memory-hierarchy.ts` | Missing from registry entirely |
| `technology/neural-network-perceptron.ts` | Missing from registry entirely |

**Total: 8 files not properly registered** (7 missing + 1 slug mismatch)

---

## 2. Placeholder/Stub Files (≤30 lines)

These files contain only a placeholder "title + blank canvas" with no real simulation logic:

| File | Lines |
|------|-------|
| `astronomy/exoplanet-transit.ts` | 25 |
| `astronomy/gravitational-lensing.ts` | 25 |
| `astronomy/tidal-forces.ts` | 25 |
| `chemistry/crystal-lattice-structures.ts` | 25 |
| `chemistry/galvanic-cell-electrochemistry.ts` | 25 |
| `earth/earths-magnetic-field.ts` | 25 |
| `earth/seasons-axial-tilt.ts` | 25 |
| `physics/double-slit-experiment.ts` | 25 |
| `biology/genetics-punnett-square.ts` | 27 |
| `biology/heart-electrical-system.ts` | 27 |
| `biology/natural-selection.ts` | 27 |
| `biology/neural-signal-transmission.ts` | 27 |

**Recommendation:** These are all stubs. Either implement them or remove them. Several overlap with real implementations (see below).

---

## 3. Duplicate & Similar Groups

### 🔴 HIGH PRIORITY — Likely Redundant (same concept, should consolidate)

#### Group 1: Activity Series of Metals
- `chemistry/activity-series-metals.ts` (1057 lines) — "Activity Series of Metals"
- `chemistry/activity-series-of-metals.ts` (317 lines) — "Activity Series of Metals"

**Same title.** The 317-line version is simpler. **Recommendation: REMOVE the shorter one**, keep the comprehensive version.

#### Group 2: Absorption & Emission of Light
- `physics/absorption-and-emission-of-light.ts` (288 lines) — "Absorption & Emission of Light (4-Level)"
- `physics/absorption-emission-light.ts` (828 lines) — "Absorption & Emission of Light"

Both simulate the same phenomenon. The 828-line version is more detailed; the 288-line "4-Level" version adds a specific energy level model. **Recommendation: MERGE** — add 4-level mode to the comprehensive version.

#### Group 3: AM/FM
- `physics/am-fm.ts` (508 lines) — "AM & FM"
- `physics/am-fm-modulation.ts` (448 lines) — "AM & FM Modulation"

Same concept with minor visualization differences. **Recommendation: MERGE into one.**

#### Group 4: Double Slit (3 files!)
- `physics/double-slit.ts` (242 lines) — "Double Slit"
- `physics/double-slit-experiment.ts` (25 lines) — "Double-Slit Experiment" **(PLACEHOLDER)**
- `physics/youngs-double-slit.ts` (220 lines) — "Young's Double Slit"

`double-slit-experiment` is a stub. `double-slit` and `youngs-double-slit` are essentially the same experiment. **Recommendation: REMOVE placeholder, MERGE the other two.**

#### Group 5: Free Fall (3 files!)
- `physics/free-fall.ts` (418 lines) — "Free Fall"
- `physics/free-fall-2.ts` (unknown title, numbered variant)
- `physics/free-falling.ts` (357 lines) — "Free Falling"

Three files for free fall is excessive. **Recommendation: CONSOLIDATE into one, possibly with configurable parameters.**

#### Group 6: Doppler Effect (cross-category)
- `physics/doppler-effect.ts` (292 lines) — "Doppler Effect"
- `waves/doppler-effect.ts` (377 lines) — registered as "doppler-wave-effect"

Both simulate the Doppler effect. The waves version may focus more on wave visualization. **Recommendation: KEEP BOTH but ensure distinct focus. Fix registry slug for waves version.**

#### Group 7: C-Curve Fractal
- `math/c-curve.ts` (362 lines) — "C-Curve (Lévy)"
- `math/c-curve-fractal.ts` (333 lines) — "C-Curve Fractal"

Same fractal with very similar implementations (diff shows high overlap). **Recommendation: MERGE into one.**

#### Group 8: Gas/Gas Model
- `physics/gas.ts` (409 lines) — "Gas"
- `physics/gas-model.ts` (433 lines) — "Gas Model"

Both are kinetic gas simulations. **Recommendation: MERGE.**

#### Group 9: Color/RGB/Three Primary Colors
- `physics/color.ts` (156 lines) — "Additive Color Mixing"
- `physics/three-primary-colors.ts` (346 lines) — "Three Primary Colors"
- `physics/rgb.ts` (229 lines) — "RGB Additive Color Mixing"

Three files all doing additive color mixing. **Recommendation: CONSOLIDATE into one "Additive Color Mixing" sim.**

#### Group 10: Superposition/Interference
- `physics/superposition.ts` (294 lines) — "Superposition"
- `physics/superposition-and-interference.ts` (371 lines) — "Superposition and Interference"
- `waves/wave-interference.ts` — "Wave Interference" (cross-category)

All demonstrate wave superposition/interference. **Recommendation: MERGE physics versions; decide if waves/ version adds distinct value.**

#### Group 11: Tidal Force/Forces/Tides
- `physics/tidal-force.ts` (313 lines) — "Tidal Force"
- `astronomy/tidal-forces.ts` (25 lines) — "Tidal Forces" **(PLACEHOLDER)**
- `physics/tides.ts` — "Tides"

**Recommendation: REMOVE placeholder. Keep tidal-force and tides if they show different aspects (force mechanics vs actual tide patterns).**

#### Group 12: Sound Waves (cross-category)
- `physics/sound-wave.ts` (315 lines) — "Sound Wave"
- `waves/sound-waves.ts` (369 lines) — "Sound Waves"

Very similar concept across categories. **Recommendation: KEEP ONE, redirect the other.**

#### Group 13: Standing Waves (cross-category)
- `physics/standing-wave-synthesis.ts` (293 lines) — "Standing Wave Synthesis"
- `waves/standing-waves.ts` (295 lines) — "Standing Waves"
- `physics/standing-waves-on-a-drum-surface.ts` — distinct (2D drum)
- `physics/standing-waves-on-a-string.ts` — distinct (1D string)

The drum and string variants are legitimately different. The synthesis and generic standing-waves are likely redundant. **Recommendation: MERGE standing-wave-synthesis with standing-waves.**

#### Group 14: Electromagnetic Wave(s)
- `physics/electromagnetic-wave.ts` (432 lines) — "Electromagnetic Wave"
- `physics/electromagnetic-waves.ts` (396 lines) — "Electromagnetic Waves"

Nearly identical names and concept. **Recommendation: MERGE.**

#### Group 15: Seismic Wave(s) (cross-category)
- `physics/seismic-wave.ts` (297 lines) — "Seismic Wave"
- `earth/seismic-waves.ts` (625 lines) — "Seismic Waves"

Both simulate seismic waves. Earth version is more detailed. **Recommendation: KEEP the earth/ version, redirect physics/.**

#### Group 16: CMYK/CMY Decomposers
- `physics/cmyk-decomposer.ts` (175 lines) — "CMYK Decomposer"
- `physics/filedrop-cmyk.ts` (238 lines) — "CMYK Color Separation"
- `physics/filedrop-cmy.ts` (230 lines) — "CMY Color Separation"

Three files for subtractive color separation. CMY and CMYK differ by one channel. **Recommendation: MERGE into one with a CMY/CMYK toggle.**

---

### 🟡 MEDIUM PRIORITY — Different Angles on Same Topic (review needed)

#### Group 17: Boyle's Law family
- `chemistry/boyles-law.ts` — "Boyle's Law"
- `chemistry/boyles-law-2.ts` — "Boyle's Law (Weighted Piston)"
- `chemistry/boyles-j-tube.ts` — "Boyle's J-Tube"
- `chemistry/gas-laws.ts` — "Gas Laws" (may include Boyle's)

Different apparatus/approaches. J-Tube is historically distinct. Gas Laws likely combines Boyle + Charles + Gay-Lussac. **Recommendation: KEEP ALL — they demonstrate different experimental setups. Ensure gas-laws doesn't fully duplicate boyles-law.**

#### Group 18: Carnot Engine
- `chemistry/carnot-engine.ts` (652 lines) — "Carnot Engine"
- `chemistry/carnot-engines.ts` (671 lines) — "Carnot Engine vs Real Engine"

Second adds comparison with real engines. **Recommendation: KEEP BOTH — the comparison version adds educational value.**

#### Group 19: Status/Phase of Water (3 files)
- `physics/status-of-water.ts` (348 lines) — "Three States of Water"
- `physics/status-of-water-2.ts` (486 lines) — "Phase Diagram of Water"
- `physics/status-solid-liquid-gas.ts` (417 lines) — "Solid, Liquid, Gas Comparison"

Three perspectives: states overview, phase diagram, comparison. **Recommendation: Phase diagram is distinct. The other two may overlap — review and potentially MERGE status-of-water and status-solid-liquid-gas.**

#### Group 20: Conduction (3 files)
- `chemistry/conduction.ts` (319 lines) — "Heat Conduction"
- `chemistry/conduction-2.ts` (275 lines) — "Heat Conduction (Particle Model)"
- `chemistry/conduction-3.ts` (unknown) — "Heat Conduction (Metal vs Wood)"

Each uses a different model/perspective. **Recommendation: KEEP ALL — different educational approaches.**

#### Group 21: Ecosystem family
- `biology/ecosystem.ts` (389 lines) — "Ecosystem"
- `biology/ecosystem-v2.ts` (392 lines) — "Ecosystem V2"
- `biology/food-web-ecosystem.ts` — "Food Web Ecosystem"

V2 likely replaces V1. Food web is distinct. **Recommendation: REMOVE ecosystem.ts if v2 is a direct improvement. Keep food-web.**

#### Group 22: Cell Division
- `biology/cell-division.ts` (647 lines) — "Cell Division"
- `biology/cell-division-model.ts` (682 lines) — "Cell Division Model"

Similar size, potentially overlapping. **Recommendation: Review and MERGE if one is a strict superset.**

#### Group 23: Projectile/Parabolic Motion
- `physics/projectile.ts` — "Projectile"
- `physics/projectile-motion.ts` (548 lines) — "Projectile Motion"
- `physics/parabolic-motion.ts` (447 lines) — "Parabolic Motion"

Three files for projectile/parabolic motion. **Recommendation: CONSOLIDATE into one or two (basic + advanced).**

#### Group 24: Rainbow (3 files)
- `physics/rainbow-by-raindrops.ts` (286 lines) — "Rainbow By Raindrops"
- `physics/rainbow-colors.ts` (293 lines) — "Rainbow Colors"
- `physics/rainbow-formation.ts` (280 lines) — "Rainbow Formation"

Three very similarly-sized rainbow sims. **Recommendation: Review — likely mergeable into one comprehensive rainbow simulation.**

#### Group 25: Electrostatic Induction
- `physics/electrostatic-induction.ts` (327 lines) — "Electrostatic Induction"
- `physics/electrostatic-induction-metal-bonding.ts` (305 lines) — "Electrostatic Induction (Metal Bonding)"

Related but the second adds metal bonding context. **Recommendation: MERGE if overlap is high.**

#### Group 26: Spring/Springs
- `physics/spring.ts` (394 lines) — "Spring (Hooke's Law)"
- `physics/springs.ts` (365 lines) — "Springs (Series & Parallel)"

Different focus (single vs series/parallel). **Recommendation: KEEP BOTH — complementary.**

#### Group 27: Ionic Bond family
- `chemistry/ionic-bond.ts` — "Ionic Bond"
- `chemistry/ionic-bond-2.ts` — "Ionic Bond 2"
- `chemistry/nacl-ionic-bond.ts` — "NaCl Ionic Bond"

NaCl is a specific example. Bond 1 vs 2 unclear. **Recommendation: Review — potentially MERGE ionic-bond and ionic-bond-2.**

#### Group 28: Rutherford Scattering
- `physics/rutherford-scattering.ts` (259 lines)
- `physics/rutherford-scattering-and-size-of-nucleus.ts` (233 lines)

Second extends to show nuclear size estimation. **Recommendation: MERGE — add nuclear size as a feature of the main sim.**

---

### 🟢 LOW PRIORITY — Legitimately Different (keep both)

These share similar base names but have genuinely different educational content:

| Group | Files | Reason to Keep Both |
|-------|-------|-------------------|
| Phase of Moon 1/2/3 | `astronomy/phase-of-moon{,-2,-3}.ts` | Likely different visualization approaches |
| Serial-Parallel Circuit 1/2/3 | `electricity/serial-parallel-circuit{,-2,-3}.ts` | Different circuit configurations |
| Inductor & Capacitor 1/2/3 | `electricity/inductor-and-capacitor{,-2,-3}.ts` | Different LC circuit scenarios |
| Electric Potential 1/2/3 | `electricity/electric-potential{,-2,-3}.ts` | Point charge / Uniform field / Energy & Work |
| Capacitor family (5 files) | `electricity/capacitor{,-2,-application,-characteristic}, dielectric-in-capacitor` | All cover distinct aspects |
| Transistor / MOSFET | `electricity/transistor{,-2}.ts` | BJT vs MOSFET |
| Moment of Inertia 1/2/3D | `physics/moment-of-inertia{,-2,-3d}.ts` | Static / Rolling race / 3D visualization |
| Camera 1/2/optics | `physics/camera{,-2,-optics}.ts` | Lens&Film / Exposure&Focus / Optics |
| Pendulum family | `physics/pendulum, period-of-pendulum, pendulum-wave, conical-pendulum` | All different physics |
| Faraday's Law 1/2 | `physics/faradays-law{,-2}.ts` | Likely different experimental setups |
| DC Motor 1/2 | `physics/dc-motor{,-2}.ts` | Likely different detail levels |
| Diurnal Motion family | `physics/diurnal-motion{,-3d,-of-sun}.ts` | 2D / 3D / solar-specific |
| Stoichiometry pair | `chemistry/stoichiometry-with-{ammonia,water}-synthesis.ts` | Different chemical reactions |
| Blocklab family | `technology/blocklab{,-circular,-parabolic}.ts` | Different trajectory types |
| Buoyancy pair | `physics/buoyancy{,-comparison}.ts` | Single object vs comparison |
| Pressure family | `physics/pressure, air-pressure, atmospheric-pressure` | Different contexts |
| Stellar Parallax 1/3D | `physics/stellar-parallax{,-3d}.ts` | 2D vs 3D visualization |
| Zodiac 1/2 | `physics/zodiac{,-2}.ts` | Likely different features |
| Swingby 1/2 | `physics/swingby-{1,2}.ts` | Different orbital scenarios |

---

## 4. Cross-Category Overlap Summary

Several simulations exist in **both** a topic category (physics/) **and** the newer waves/ or earth/ category:

| Physics File | Other Category File | Status |
|-------------|-------------------|--------|
| `physics/doppler-effect.ts` | `waves/doppler-effect.ts` | Both implemented, waves unregistered properly |
| `physics/seismic-wave.ts` | `earth/seismic-waves.ts` | Both implemented |
| `physics/sound-wave.ts` | `waves/sound-waves.ts` | Both implemented |
| `physics/standing-wave-synthesis.ts` | `waves/standing-waves.ts` | Both implemented |
| `physics/superposition*.ts` | `waves/wave-interference.ts` | Both implemented |
| `physics/tidal-force.ts` | `astronomy/tidal-forces.ts` | astronomy version is placeholder |
| `astronomy/apparent-motion-mars.ts` | `physics/apparent-motion-of-mars.ts` | Both implemented |
| `astronomy/apparent-motion-venus.ts` | `physics/apparent-motion-of-venus.ts` | Both implemented |

**Recommendation:** Decide on canonical category for each topic. Keep the better implementation, redirect the other via the registry.

---

## 5. Summary Statistics

| Category | Count |
|----------|-------|
| Total files | 500 |
| Registry entries | 493 |
| Unregistered files | 8 |
| Orphaned registry entries | 1 |
| Placeholder/stub files | 12 |
| 🔴 High-priority duplicate groups | 16 |
| 🟡 Medium-priority review groups | 12 |
| 🟢 Legitimately different (keep) | 19+ groups |

### Estimated Reduction
If all high-priority duplicates are consolidated: **~20-25 files could be removed or merged**, bringing the count closer to 475-480 meaningful, distinct simulations.

---

## 6. Recommended Actions

1. **Immediate:** Register the 7 missing files in `registry.ts`
2. **Immediate:** Fix `doppler-wave-effect` slug → `doppler-effect-waves` or similar
3. **Immediate:** Remove or implement the 12 placeholder stubs
4. **Sprint 1:** Consolidate 🔴 high-priority groups (double-slit, free-fall, color mixing, AM/FM, etc.)
5. **Sprint 2:** Review 🟡 medium-priority groups for merge opportunities
6. **Ongoing:** Establish naming convention to prevent future duplicates (e.g., use numbered suffixes only when genuinely different)
