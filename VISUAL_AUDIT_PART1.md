# Visual Audit Part 1: Physics, Electricity, Waves

**Total simulations audited: 303**
- Physics: 250
- Electricity: 43
- Waves: 10

## Summary

| Metric | GOOD | NEEDS_IMPROVEMENT | POOR |
|--------|------|-------------------|------|
| Render | 280 | 16 | 7 |
| Label | 228 | 66 | 9 |
| Ui | 14 | 281 | 8 |

### Key Finding: Mouse Interaction Gap
Only 14 of 303 sims have any mouse/touch interaction beyond sliders.
Most rely entirely on parameter sliders. Adding click-to-place, drag, or hover interactions would greatly improve engagement.

## 🚨 Worst Sims (Need Most Work)

| Slug | Dir | Render | Labels | UI | Draw Calls | Text Calls | Issues |
|------|-----|--------|--------|----|-----------|------------|--------|
| color-panel | physics | POOR | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | 3 | 5 | Very few draw calls; No interaction; Stub-like (short) |
| mendeleev | physics | POOR | GOOD | GOOD | 5 | 14 | Very few draw calls |
| color-cube | physics | POOR | POOR | NEEDS_IMPROVEMENT | 6 | 4 | Very few draw calls; Minimal labels; No interaction |
| conductor-and-insulator | electricity | POOR | NEEDS_IMPROVEMENT | GOOD | 7 | 9 | Very few draw calls |
| triboelectricity | electricity | POOR | NEEDS_IMPROVEMENT | POOR | 7 | 9 | Very few draw calls; No interaction |
| koch-curve | physics | POOR | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | 7 | 6 | Very few draw calls; No interaction; Stub-like (short) |
| sierpinski-curve | physics | POOR | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | 7 | 5 | Very few draw calls; No interaction |
| dihybrid-cross | physics | NEEDS_IMPROVEMENT | GOOD | POOR | 8 | 11 | No interaction |
| gravity-difference-on-several-planet | physics | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | POOR | 11 | 7 | No interaction |
| wave-propagation | physics | NEEDS_IMPROVEMENT | POOR | NEEDS_IMPROVEMENT | 11 | 3 | Minimal labels; No interaction; Stub-like (short) |
| gravity-orbits | physics | NEEDS_IMPROVEMENT | POOR | NEEDS_IMPROVEMENT | 13 | 2 | Minimal labels; No interaction |
| fireworks | physics | NEEDS_IMPROVEMENT | POOR | NEEDS_IMPROVEMENT | 14 | 2 | Minimal labels; No interaction |
| pendulum-wave | physics | NEEDS_IMPROVEMENT | POOR | NEEDS_IMPROVEMENT | 14 | 1 | Minimal labels; No interaction |
| hilbert-curve | physics | GOOD | POOR | NEEDS_IMPROVEMENT | 19 | 3 | Minimal labels; No interaction |
| resonance | waves | GOOD | NEEDS_IMPROVEMENT | POOR | 19 | 8 | No interaction |
| gravity-train | physics | GOOD | NEEDS_IMPROVEMENT | POOR | 22 | 8 | No interaction |
| water-waves | physics | GOOD | POOR | NEEDS_IMPROVEMENT | 23 | 4 | Minimal labels; No interaction |
| magnet | physics | GOOD | POOR | NEEDS_IMPROVEMENT | 25 | 3 | Minimal labels; No interaction |
| double-slit-experiment | physics | GOOD | GOOD | POOR | 26 | 15 | No interaction |
| prism | physics | GOOD | POOR | NEEDS_IMPROVEMENT | 26 | 4 | Minimal labels; No interaction |
| harmonics | waves | GOOD | NEEDS_IMPROVEMENT | POOR | 28 | 8 | No interaction |
| latitude-of-polaris | physics | GOOD | GOOD | POOR | 29 | 14 | No interaction |

## 🎯 Top 3D Upgrade Candidates

These sims are currently 2D but would benefit significantly from 3D visualization:

| Slug | Why 3D? | Priority |
|------|---------|----------|
| magnetic-field-around-a-bar-magnet | Magnetic field lines are inherently 3D — showing field emerging from poles in 3D space | 🔴 HIGH |
| magnetic-field-around-a-circular-wire | Circular symmetry of field around loop needs 3D to show properly | 🟡 MEDIUM |
| magnetic-field-around-a-coil | Solenoid field visualization is fundamentally 3D | 🟡 MEDIUM |
| magnetic-field-around-a-wire | Right-hand rule visualization needs 3D | 🟡 MEDIUM |
| electric-field-line | 3D field lines around point charges/dipoles | 🔴 HIGH |
| electric-potential | Equipotential surfaces as 3D landscape | 🟡 MEDIUM |
| electric-potential-2 | Same — potential surfaces need 3D | 🟡 MEDIUM |
| electric-potential-3 | Same — potential surfaces need 3D | 🟡 MEDIUM |
| electromagnetic-waves-around-of-visible-rays | E and B fields perpendicular in 3D space | 🔴 HIGH |
| lorentzs-force | Helical particle paths in crossed E/B fields | 🔴 HIGH |
| standing-waves-on-a-drum-surface | Drum vibration modes are 3D surfaces (Chladni patterns) | 🔴 HIGH |
| wave-propagation | 3D expanding wavefronts | 🟡 MEDIUM |
| gas-model | 3D particle collisions in a box | 🔴 HIGH |
| kinetic-theory-model | Same — 3D gas particles | 🟡 MEDIUM |
| brownian-motion | 3D random walk is more physically accurate | 🟡 MEDIUM |
| polarity-of-water | Molecular geometry (bent structure) is 3D | 🔴 HIGH |
| rutherford-scattering | Alpha particles scatter in 3D around nucleus | 🟡 MEDIUM |
| rutherford-scattering-and-size-of-nucleus | Same | 🟡 MEDIUM |
| gravity-orbits | Orbital mechanics in 3D (inclination, precession) | 🔴 HIGH |
| foucault-pendulum | Rotation of swing plane needs 3D | 🟡 MEDIUM |
| pendulum-wave | Multiple pendulums look stunning in 3D perspective | 🟡 MEDIUM |
| dipole-antenna | Radiation pattern is a 3D doughnut shape | 🟡 MEDIUM |
| phase-array | Beam steering/forming in 3D | 🟡 MEDIUM |
| earth-movements | Axial tilt, precession, nutation — all 3D | 🟡 MEDIUM |

### Already 3D (good examples to follow)

- `conical-pendulum` (590 lines)
- `diurnal-motion-3d` (328 lines)
- `electromagnetic-wave` (432 lines)
- `ester` (457 lines)
- `horizontal-coordinate-system` (385 lines)
- `lorentzs-force-3d` (544 lines)
- `moment-of-inertia-3d` (491 lines)
- `stellar-parallax-3d` (359 lines)
- `structure-of-ice-3d` (391 lines)
- `ursa-minor-3d` (232 lines)
- `polarization` (419 lines)

## 📝 Specific Enhancement Suggestions

### `color-panel`
Essentially a color display utility, not a true sim. Add: interactive color mixing, wavelength slider with spectrum visualization, complementary color display.

### `color-cube`
Add: interactive rotation of the RGB cube, click to select colors, show HSL/RGB conversion. Currently very static.

### `koch-curve`
Add: iteration depth slider (already has?), zoom/pan, measurement of fractal dimension, comparison with other fractals.

### `sierpinski-curve`
Same as koch-curve — add zoom, iteration control, fractal dimension calculation.

### `wave-propagation`
Very short (189 lines). Add: source placement by click, multiple sources for interference, 3D mode, wavelength/frequency display.

### `gravity-orbits`
Only 2 text labels! Add: orbital parameters (period, eccentricity, energy), velocity vectors, trail toggle, Kepler's law verification.

### `fireworks`
Fun but uninformative. Add: physics annotations (projectile motion equations, velocity decomposition, air resistance toggle).

### `pendulum-wave`
Only 1 text label. Add: period display for each pendulum, phase relationships, frequency ratio annotations.

### `hilbert-curve`
Minimal labels. Add: iteration level display, curve length calculation, space-filling ratio.

### `water-waves`
Few labels. Add: wavelength/frequency display, wave equation, depth effect annotations.

### `magnet`
Few labels. Add: magnetic field strength values, pole labels, field line density explanation.

### `prism`
Few labels. Add: angle of incidence/refraction values, wavelength labels on dispersed colors, Snell's law display.

### `conductor-and-insulator`
Few draw calls, mostly text-based. Add: animated electron flow, band gap visualization, temperature effects.

### `triboelectricity`
Few draw calls. Add: charge transfer animation, triboelectric series display, quantitative charge values.

### `mendeleev`
Good interaction (hover/click) but few canvas draws — likely renders mainly with fillRect for cells. Could add: trend visualization overlays, electron configuration diagrams.

## Full Audit Table

| Slug | Dir | Lines | Renders | Labels | UI Quality | Mouse | 3D? | Draws | Texts |
|------|-----|-------|---------|--------|-----------|-------|-----|-------|-------|
| ac-generator | electricity | 777 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 93 | 19 |
| ammeter | electricity | 952 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 124 | 30 |
| capacitor | electricity | 687 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 56 | 23 |
| capacitor-2 | electricity | 663 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 55 | 27 |
| capacitor-application | electricity | 760 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 92 | 24 |
| capacitor-characteristic | electricity | 700 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 75 | 35 |
| charge-conservation | electricity | 567 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 69 | 21 |
| charge-distribution-on-a-thin-conductive-plate | electricity | 525 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 30 | 9 |
| circuit-builder | electricity | 688 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 69 | 16 |
| conductor-and-insulator | electricity | 243 | POOR | NEEDS_IMPROVEMENT | GOOD | ⚠️ |  | 7 | 9 |
| crt | electricity | 518 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 42 | 16 |
| crt-tv | electricity | 520 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 33 | 19 |
| dielectric-in-capacitor | electricity | 271 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 36 | 13 |
| diode | electricity | 395 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 49 | 16 |
| diode-making | electricity | 347 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 34 | 14 |
| electric-circuit | electricity | 365 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 53 | 14 |
| electric-circuits-ac | electricity | 300 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 50 | 17 |
| electric-current | electricity | 382 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 31 | 16 |
| electric-field-line | electricity | 335 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 17 | 8 |
| electric-plating | electricity | 253 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 41 | 20 |
| electric-potential | electricity | 474 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 18 | 9 |
| electric-potential-2 | electricity | 299 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 56 | 28 |
| electric-potential-3 | electricity | 298 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 29 | 17 |
| electric-transformer | electricity | 312 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 57 | 25 |
| inductor-and-capacitor | electricity | 498 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 51 | 20 |
| inductor-and-capacitor-2 | electricity | 305 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 49 | 10 |
| inductor-and-capacitor-3 | electricity | 248 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 18 | 7 |
| led | electricity | 447 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 49 | 14 |
| leyden-jar | electricity | 377 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 32 | 16 |
| microbit-capacitor | electricity | 397 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 52 | 18 |
| ohms-law | electricity | 512 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 62 | 27 |
| parallel-circuit | electricity | 492 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 42 | 16 |
| photoelectric-effect-2 | electricity | 337 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 24 | 12 |
| potentiometer | electricity | 370 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 33 | 22 |
| rectifier-circuit | electricity | 397 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 64 | 13 |
| rlc-serial-circuit | electricity | 177 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 62 | 22 |
| same-circuit | electricity | 260 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 15 | 10 |
| serial-parallel-circuit | electricity | 303 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 27 | 10 |
| serial-parallel-circuit-2 | electricity | 311 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 35 | 14 |
| serial-parallel-circuit-3 | electricity | 314 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 31 | 12 |
| transistor | electricity | 218 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 46 | 24 |
| transistor-2 | electricity | 230 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 50 | 27 |
| triboelectricity | electricity | 246 | POOR | NEEDS_IMPROVEMENT | POOR | ❌ |  | 7 | 9 |
| absorption-emission-light | physics | 828 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 49 | 8 |
| addition-of-force | physics | 569 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 34 | 13 |
| addition-of-force-2 | physics | 604 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 68 | 12 |
| air-pressure | physics | 897 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 75 | 18 |
| am-fm | physics | 508 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 34 | 16 |
| apparent-motion-of-mars | physics | 674 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 54 | 10 |
| apparent-motion-of-venus | physics | 326 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 48 | 16 |
| archimedes | physics | 535 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 55 | 14 |
| atmospheric-pressure | physics | 489 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 18 | 11 |
| average-velocity | physics | 556 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 62 | 16 |
| balloon | physics | 653 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 33 | 16 |
| balloon-pressure | physics | 532 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 31 | 17 |
| bernoullis-principle | physics | 542 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 33 | 21 |
| brownian-motion | physics | 525 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 19 | 9 |
| buoyancy | physics | 542 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 37 | 11 |
| buoyancy-comparison | physics | 611 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 42 | 34 |
| camera | physics | 835 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 116 | 27 |
| camera-2 | physics | 754 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 81 | 21 |
| camera-optics | physics | 681 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 98 | 19 |
| clay-shooting | physics | 813 | GOOD | GOOD | GOOD | ✅ | ⚠️ | 68 | 17 |
| collision | physics | 276 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 18 | 7 |
| collision-2 | physics | 258 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 22 | 7 |
| collision-2d | physics | 555 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 34 | 15 |
| color-cube | physics | 210 | POOR | POOR | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 6 | 4 |
| color-panel | physics | 136 | POOR | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 3 | 5 |
| condition-of-circular-movement | physics | 272 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 23 | 9 |
| conical-pendulum | physics | 590 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ✅ | 68 | 19 |
| constant-velocity | physics | 271 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 35 | 11 |
| countercurrent-exchange | physics | 447 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 22 | 9 |
| coupled-oscillators | physics | 754 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 30 | 25 |
| daylight | physics | 523 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 64 | 16 |
| daylight-map | physics | 386 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 28 | 9 |
| dc-and-ac | physics | 532 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 69 | 19 |
| dc-motor | physics | 307 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 55 | 13 |
| dc-motor-2 | physics | 313 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 56 | 8 |
| dew | physics | 314 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 24 | 10 |
| diffraction-grating | physics | 286 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 21 | 12 |
| dihybrid-cross | physics | 293 | NEEDS_IMPROVEMENT | GOOD | POOR | ❌ |  | 8 | 11 |
| dipole-antenna | physics | 311 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 51 | 10 |
| distance-of-1-pc | physics | 276 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 33 | 19 |
| diurnal-motion | physics | 298 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 21 | 10 |
| diurnal-motion-3d | physics | 328 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ | ✅ | 20 | 9 |
| diurnal-motion-of-sun | physics | 265 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 18 | 10 |
| doppler-effect | physics | 292 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 36 | 11 |
| doppler-effect-and-redshift | physics | 319 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 36 | 12 |
| double-slit | physics | 242 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 22 | 11 |
| double-slit-experiment | physics | 300 | GOOD | GOOD | POOR | ❌ |  | 26 | 15 |
| dragon-curve | physics | 251 | GOOD | NEEDS_IMPROVEMENT | GOOD | ✅ |  | 16 | 5 |
| earth-movements | physics | 300 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 36 | 8 |
| earths-gravity | physics | 347 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 31 | 18 |
| earths-gravity-2 | physics | 298 | GOOD | GOOD | GOOD | ⚠️ |  | 37 | 13 |
| electromagnetic-wave | physics | 432 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ✅ | 53 | 15 |
| electromagnetic-waves-around-of-visible-rays | physics | 579 | GOOD | GOOD | GOOD | ⚠️ |  | 55 | 16 |
| electroscope | physics | 363 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 32 | 10 |
| electrostatic-induction | physics | 327 | NEEDS_IMPROVEMENT | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 12 | 10 |
| electrostatic-induction-metal-bonding | physics | 305 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 16 | 10 |
| elevator | physics | 430 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 46 | 16 |
| energy-band | physics | 339 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 38 | 12 |
| entropy | physics | 354 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 21 | 8 |
| epeirogeny | physics | 288 | NEEDS_IMPROVEMENT | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 13 | 14 |
| equatorial-coordinate-system | physics | 415 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 33 | 10 |
| equilibrium | physics | 380 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 27 | 15 |
| equilibrium-constants | physics | 385 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 18 | 14 |
| ester | physics | 457 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ | ✅ | 17 | 7 |
| evolution-of-the-eye | physics | 477 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 59 | 10 |
| faradays-law | physics | 434 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 42 | 14 |
| faradays-law-2 | physics | 346 | GOOD | GOOD | GOOD | ✅ |  | 34 | 14 |
| filedrop-cmyk | physics | 238 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 17 | 10 |
| fireworks | physics | 286 | NEEDS_IMPROVEMENT | POOR | NEEDS_IMPROVEMENT | ❌ |  | 14 | 2 |
| five-kingdom | physics | 308 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 15 | 15 |
| flame-test | physics | 318 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 29 | 10 |
| fnd | physics | 282 | NEEDS_IMPROVEMENT | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 14 | 11 |
| force-movement | physics | 330 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 40 | 16 |
| force-on-inclined-plane | physics | 364 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 40 | 9 |
| foucault-pendulum | physics | 274 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 19 | 10 |
| free-fall | physics | 418 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 46 | 23 |
| gas-model | physics | 433 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 28 | 8 |
| general-relativity | physics | 409 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 22 | 12 |
| geocentrism-and-heliocentrism | physics | 344 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 24 | 10 |
| gravity | physics | 419 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 27 | 14 |
| gravity-difference-on-several-planet | physics | 216 | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | POOR | ❌ |  | 11 | 7 |
| gravity-orbits | physics | 386 | NEEDS_IMPROVEMENT | POOR | NEEDS_IMPROVEMENT | ❌ |  | 13 | 2 |
| gravity-train | physics | 241 | GOOD | NEEDS_IMPROVEMENT | POOR | ❌ | ⚠️ | 22 | 8 |
| half-life-period | physics | 339 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 25 | 9 |
| heat-capacity | physics | 337 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 18 | 10 |
| heat-transfer-radiation | physics | 631 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 20 | 15 |
| hilbert-curve | physics | 238 | GOOD | POOR | NEEDS_IMPROVEMENT | ❌ |  | 19 | 3 |
| homopolar-motor | physics | 275 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 20 | 13 |
| hookes-law | physics | 397 | GOOD | GOOD | GOOD | ⚠️ |  | 31 | 18 |
| horizontal-coordinate-system | physics | 385 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ✅ | 42 | 10 |
| human-gene-transfer | physics | 334 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 24 | 11 |
| hydrocarbon | physics | 375 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 33 | 10 |
| igneous-rock | physics | 335 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 24 | 9 |
| impulse | physics | 430 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 35 | 14 |
| incandescence | physics | 479 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 42 | 10 |
| indoor-wiring | physics | 375 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 32 | 15 |
| inductor | physics | 474 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 65 | 12 |
| inertia | physics | 241 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 19 | 7 |
| keplers-law | physics | 320 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 20 | 7 |
| kinetic-theory-model | physics | 321 | NEEDS_IMPROVEMENT | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 14 | 10 |
| koch-curve | physics | 153 | POOR | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 7 | 6 |
| latitude-of-polaris | physics | 298 | GOOD | GOOD | POOR | ❌ |  | 29 | 14 |
| law-of-reflection | physics | 290 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 35 | 12 |
| lc-filter | physics | 432 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 59 | 22 |
| lc-oscillator | physics | 374 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 55 | 13 |
| lcd-display | physics | 260 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 27 | 9 |
| lcd-display-2 | physics | 318 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 22 | 6 |
| le-chateliers-principle-pressure | physics | 388 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 29 | 20 |
| lens | physics | 317 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 54 | 18 |
| life-game | physics | 290 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 18 | 6 |
| light-interference-on-cd-surface | physics | 369 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 44 | 9 |
| light-refraction | physics | 359 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 35 | 20 |
| little-princes-trampoline | physics | 382 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 55 | 13 |
| logic | physics | 423 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 57 | 18 |
| lorentzs-force | physics | 480 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 44 | 19 |
| lorentzs-force-3d | physics | 544 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ✅ | 41 | 19 |
| lorenzs-water-mill | physics | 631 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 61 | 14 |
| magnet | physics | 357 | GOOD | POOR | NEEDS_IMPROVEMENT | ❌ |  | 25 | 3 |
| magnet-and-electromagnet | physics | 390 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 28 | 9 |
| magnetic-field-around-a-bar-magnet | physics | 400 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 18 | 7 |
| magnetic-field-around-a-circular-wire | physics | 385 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 27 | 8 |
| magnetic-field-around-a-coil | physics | 386 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 26 | 6 |
| magnetic-field-around-a-wire | physics | 390 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 43 | 12 |
| magnetic-force | physics | 396 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 37 | 20 |
| magnetic-induction | physics | 486 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 47 | 20 |
| magnetization | physics | 451 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 37 | 17 |
| magnitude | physics | 598 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 42 | 21 |
| matter-wave | physics | 455 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 38 | 21 |
| measuring-the-earth | physics | 287 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 34 | 13 |
| measuring-the-earth-2 | physics | 301 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 34 | 15 |
| mendeleev | physics | 335 | POOR | GOOD | GOOD | ✅ |  | 5 | 14 |
| mendels-law-of-heredity | physics | 409 | NEEDS_IMPROVEMENT | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 9 | 19 |
| michelson-interferometer | physics | 323 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 21 | 15 |
| microscope | physics | 326 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 36 | 17 |
| microscopic-image | physics | 429 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 29 | 10 |
| mirrors | physics | 314 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 43 | 12 |
| moment-of-inertia | physics | 718 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 41 | 9 |
| moment-of-inertia-2 | physics | 277 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 19 | 12 |
| moment-of-inertia-3d | physics | 491 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ✅ | 45 | 17 |
| motion-analysis | physics | 388 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 34 | 13 |
| motion-shot | physics | 300 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 30 | 10 |
| multiple-reflections | physics | 359 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 35 | 13 |
| newton-ring | physics | 313 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 24 | 20 |
| newtonian-reflector | physics | 359 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 35 | 18 |
| newtons-cradle | physics | 373 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 39 | 6 |
| oersteds-experiment | physics | 346 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 32 | 21 |
| on-the-table | physics | 394 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 23 | 12 |
| optics | physics | 492 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 80 | 16 |
| osmosis | physics | 500 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 36 | 12 |
| parabolic-motion | physics | 447 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 46 | 14 |
| parallax-of-eyes | physics | 444 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 44 | 16 |
| parallel-rays-of-sun | physics | 307 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 41 | 14 |
| pascals-principle | physics | 322 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 33 | 16 |
| path-of-satellite | physics | 458 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 34 | 13 |
| pendulum | physics | 446 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 35 | 18 |
| pendulum-wave | physics | 251 | NEEDS_IMPROVEMENT | POOR | NEEDS_IMPROVEMENT | ❌ |  | 14 | 1 |
| period-of-pendulum | physics | 396 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 32 | 19 |
| phase-array | physics | 393 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 24 | 7 |
| photoelectric-effect | physics | 587 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 38 | 17 |
| polarity-of-water | physics | 337 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 30 | 10 |
| pressure | physics | 302 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 33 | 8 |
| pressure-volume-diagram | physics | 374 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 34 | 13 |
| principle-of-least-time | physics | 317 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 25 | 19 |
| principle-of-mirror | physics | 300 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 36 | 10 |
| principle-of-satellite | physics | 373 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 28 | 13 |
| prism | physics | 304 | GOOD | POOR | NEEDS_IMPROVEMENT | ❌ |  | 26 | 4 |
| projectile | physics | 321 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 42 | 10 |
| projectile-motion | physics | 548 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 55 | 12 |
| psychrometer | physics | 268 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 17 | 12 |
| pulley-3 | physics | 307 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 43 | 10 |
| pump-problem | physics | 311 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 37 | 8 |
| pvnrt | physics | 316 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 21 | 11 |
| quantum-of-light | physics | 313 | NEEDS_IMPROVEMENT | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 14 | 15 |
| radio-wave-communication | physics | 256 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 27 | 9 |
| rainbow-by-raindrops | physics | 286 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 36 | 10 |
| rainbow-colors | physics | 293 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 21 | 14 |
| rainbow-formation | physics | 280 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 34 | 5 |
| refracting-telescope | physics | 321 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 35 | 13 |
| refraction-a-fish-under-water | physics | 388 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 53 | 16 |
| resistive-touch-screen | physics | 268 | GOOD | GOOD | GOOD | ✅ |  | 54 | 22 |
| rgb-decomposer | physics | 339 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 21 | 8 |
| rgb-filter | physics | 342 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 19 | 10 |
| rocket-and-principle-of-inertia | physics | 181 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 68 | 15 |
| rolling-motion-dynamics | physics | 772 | GOOD | GOOD | GOOD | ⚠️ | ⚠️ | 58 | 18 |
| rutherford-scattering | physics | 259 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 15 | 6 |
| rutherford-scattering-and-size-of-nucleus | physics | 233 | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 13 | 7 |
| sea-breeze | physics | 350 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 33 | 12 |
| seeing-the-light | physics | 283 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 25 | 11 |
| seismometer-and-inertia | physics | 307 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 33 | 6 |
| sierpinski-curve | physics | 211 | POOR | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 7 | 5 |
| simple-harmonic-motion | physics | 430 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 50 | 23 |
| size-of-atom-and-light | physics | 460 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 47 | 16 |
| sound-analyzing | physics | 365 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 28 | 14 |
| sound-fft | physics | 409 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 25 | 14 |
| speaker | physics | 400 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 43 | 17 |
| specific-heat | physics | 392 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 28 | 16 |
| spectrogram | physics | 361 | GOOD | NEEDS_IMPROVEMENT | GOOD | ✅ |  | 16 | 8 |
| spectrum | physics | 396 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 19 | 20 |
| spectrum-of-hydrogen | physics | 388 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 30 | 16 |
| speedgun | physics | 389 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 44 | 12 |
| spring | physics | 394 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 40 | 13 |
| spring-mass-system | physics | 537 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 36 | 13 |
| spring-pendulum | physics | 397 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 32 | 13 |
| spring-scales | physics | 397 | GOOD | GOOD | GOOD | ✅ |  | 51 | 17 |
| spring-wave | physics | 299 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 25 | 5 |
| springs | physics | 365 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 37 | 14 |
| stairbulb | physics | 367 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 43 | 12 |
| standing-waves-on-a-drum-surface | physics | 315 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 18 | 12 |
| standing-waves-on-a-string | physics | 369 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 33 | 11 |
| status-change-of-water | physics | 579 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 52 | 10 |
| status-of-water | physics | 348 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 18 | 17 |
| status-of-water-2 | physics | 486 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 45 | 21 |
| status-solid-liquid-gas | physics | 417 | NEEDS_IMPROVEMENT | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 11 | 25 |
| stellar-parallax | physics | 279 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 31 | 10 |
| stellar-parallax-3d | physics | 359 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ✅ | 35 | 20 |
| step-response | physics | 352 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 36 | 11 |
| stopwatch-for-pulse-measurement | physics | 359 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 38 | 13 |
| stratum-making | physics | 372 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 29 | 9 |
| straw | physics | 329 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 34 | 16 |
| stroboscope | physics | 310 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 21 | 11 |
| structure-of-ice-3d | physics | 391 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ✅ | 22 | 15 |
| superposition-and-interference | physics | 371 | GOOD | GOOD | GOOD | ✅ |  | 18 | 17 |
| swingby-1 | physics | 398 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 27 | 14 |
| swingby-2 | physics | 392 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 29 | 15 |
| theo-jansen | physics | 363 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 17 | 17 |
| thermometer | physics | 190 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 23 | 20 |
| thin-film-interference | physics | 214 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 46 | 27 |
| three-body-problem | physics | 205 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 25 | 13 |
| three-phase-equilibrium | physics | 388 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 49 | 17 |
| three-primary-colors | physics | 346 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 18 | 29 |
| ticker-timer | physics | 330 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 20 | 24 |
| tidal-force | physics | 313 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 26 | 14 |
| tides | physics | 400 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 35 | 25 |
| torricellis-experiment | physics | 388 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 62 | 21 |
| total-internal-reflection | physics | 331 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 45 | 18 |
| touch-screen | physics | 317 | GOOD | GOOD | GOOD | ✅ |  | 36 | 18 |
| tuning-fork-and-sound-wave | physics | 238 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 15 | 6 |
| uniform-motion | physics | 239 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 28 | 6 |
| uniformly-accelerated-motion | physics | 273 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 36 | 10 |
| ursa-minor-3d | physics | 232 | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ | ✅ | 11 | 7 |
| vacuum-jar | physics | 306 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 30 | 6 |
| vapor-pressure-lowering | physics | 331 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 28 | 9 |
| water-waves | physics | 239 | GOOD | POOR | NEEDS_IMPROVEMENT | ❌ |  | 23 | 4 |
| wave-propagation | physics | 189 | NEEDS_IMPROVEMENT | POOR | NEEDS_IMPROVEMENT | ❌ |  | 11 | 3 |
| waveform | physics | 234 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 19 | 7 |
| weather-fronts | physics | 285 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 22 | 7 |
| wheatstone-bridge | physics | 259 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 40 | 8 |
| why-is-the-sky-blue | physics | 289 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 18 | 6 |
| zodiac | physics | 239 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 21 | 7 |
| zodiac-2 | physics | 304 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 26 | 8 |
| beats | waves | 322 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 50 | 12 |
| diffraction | waves | 439 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 16 | 14 |
| doppler-effect | waves | 377 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 22 | 17 |
| harmonics | waves | 289 | GOOD | NEEDS_IMPROVEMENT | POOR | ❌ |  | 28 | 8 |
| polarization | waves | 419 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ✅ | 25 | 20 |
| resonance | waves | 229 | GOOD | NEEDS_IMPROVEMENT | POOR | ❌ |  | 19 | 8 |
| snells-law | waves | 308 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ | ⚠️ | 29 | 16 |
| sound-waves | waves | 369 | GOOD | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 25 | 10 |
| standing-waves | waves | 295 | GOOD | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | ❌ |  | 22 | 7 |
| wave-interference | waves | 387 | NEEDS_IMPROVEMENT | GOOD | NEEDS_IMPROVEMENT | ❌ |  | 13 | 12 |