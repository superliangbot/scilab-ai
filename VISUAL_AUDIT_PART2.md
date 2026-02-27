# Visual Audit Part 2: Chemistry, Biology, Math, Astronomy, Earth, Technology

**Date:** 2026-02-26  
**Files audited:** 178 simulations  
**Method:** Automated static analysis of canvas draw calls, text labels, color usage, sliders, animation, and axis/unit references, supplemented by manual spot-checks of flagged files.

## Summary Statistics

| Category | Count | Avg Draw Calls | Avg Labels | Avg Colors |
|----------|-------|---------------|------------|------------|
| Chemistry | 104 | 31 | 14 | 37 |
| Biology | 24 | 27 | 13 | 32 |
| Math | 25 | 21 | 10 | 23 |
| Astronomy | 25 | 31 | 11 | 38 |
| Earth | 11 | 33 | 14 | 35 |
| Technology | 18 | 23 | 18 | 33 |

---

## 🔴 WORST Simulations (Need Immediate Attention)

These have very low draw calls, few labels, and/or minimal colors — likely render poorly or appear mostly blank:

| Slug | Category | Renders | Labels | 3D Candidate | UI Quality | Issues & Suggestions |
|------|----------|---------|--------|-------------|------------|---------------------|
| fractal-explorer | math | WEAK (3 draws, uses ImageData pixel manipulation) | POOR (2 fillText) | No | GOOD (18 slider refs) | Renders via putImageData — works but has almost no text labels. Add iteration count, zoom level display, coordinate readout |
| food-web-ecosystem | biology | WEAK (9 draws, 3 labels) | POOR | No | POOR (basic params) | Very short file (134 lines). Minimal visuals — needs organism icons, food web arrows, population graphs |
| cold-warm-water | chemistry | WEAK (9 draws, 4 labels) | POOR | No | POOR | Barely any visual elements. Needs thermometer visualization, particle motion, temperature gradient colors |
| ion-model | chemistry | WEAK (9 draws, 6 labels) | POOR | Yes ⭐ | POOR | Too sparse for showing ionic structures. Needs 3D atom rendering, electron cloud visualization |
| greenhouse-effect | earth | WEAK (13 draws, 6 labels) | POOR | No | POOR | Only 158 lines — way too simple for such an important topic. Needs IR radiation arrows, gas molecule layer, temperature graph |
| conduction-2 | chemistry | WEAK (14 draws, 4 labels) | POOR | No | POOR | Almost no text. Needs temperature gradient bar, heat flow arrows, material labels |
| conduction | chemistry | WEAK (16 draws, 3 labels) | POOR | No | POOR | Same issues as conduction-2. Near-zero labels |
| conduction-3 | chemistry | WEAK (7 draws, 7 labels) | NEEDS_IMPROVEMENT | No | POOR | Slightly better labels but very few draw calls |
| crystal-lattice-structures | chemistry | WEAK (11 draws) | NEEDS_IMPROVEMENT | Yes ⭐⭐⭐ | POOR (no sliders for rotation speed) | Has pseudo-3D projection already — prime candidate for real Three.js 3D. Only 256 lines, needs expansion |
| ion-exchange-resin | chemistry | WEAK (11 draws, 7 labels) | POOR | No | POOR | Needs animated ion flow, resin bead visualization, before/after water quality |
| cochlear | biology | WEAK (12 draws, 9 labels) | NEEDS_IMPROVEMENT | Yes ⭐ | POOR | Inner ear is inherently 3D. Needs spiral cochlea, basilar membrane, frequency mapping |
| pythagoras-tree | math | WEAK (11 draws, 5 labels) | POOR | No | POOR | Very short (163 lines). Needs depth control slider, color by depth, angle parameter |
| hr-diagram | astronomy | WEAK (12 draws, 7 labels) | POOR | No | POOR | Only 180 lines for a Hertzsprung-Russell diagram! Needs proper axes (temp vs luminosity), star classification regions, clickable stars |
| formation-model-of-columnar-joint | chemistry | WEAK (7 draws, 6 labels) | POOR | Yes ⭐⭐ | NEEDS_IMPROVEMENT | Basalt column formation is inherently 3D. Needs hexagonal prism rendering |

---

## 🟡 Needs Improvement (Functional but Underwhelming)

| Slug | Category | Renders | Labels | 3D Candidate | UI Quality | Suggestions |
|------|----------|---------|--------|-------------|------------|------------|
| mandelbrot-set | math | OK (pixel-based) | POOR (4 labels) | No | GOOD (sliders) | Like fractal-explorer — renders via pixels. Add coordinate display, iteration info |
| differentiation | chemistry | OK | POOR (5 labels) | No | POOR (3 sliders) | Needs derivative visualization, tangent line, formula display |
| differentiation-2 | chemistry | OK | NEEDS_IMPROVEMENT | No | POOR (3 sliders) | Same issues |
| galton-board | math | OK | POOR (6 labels) | No | POOR | Needs count display, normal curve overlay, statistics panel |
| fourier-series | math | OK | POOR (6 labels) | No | NEEDS_IMPROVEMENT | Needs term-by-term visualization, frequency labels |
| fourier-series-2 | math | OK | POOR (6 labels) | No | NEEDS_IMPROVEMENT | Same |
| why-are-cells-small | biology | OK | NEEDS_IMPROVEMENT | No | POOR (3 sliders) | Needs SA:V ratio calculation display, comparison table |
| sierpinski-triangle | math | OK | NEEDS_IMPROVEMENT | No | POOR | Add iteration depth control, color scheme, zoom |
| solar-system | astronomy | OK | POOR (3 labels) | Yes ⭐⭐⭐ | NEEDS_IMPROVEMENT | Only 3 text labels for entire solar system! Needs planet names, orbit labels. Top 3D candidate |
| exoplanet-transit | astronomy | OK | NEEDS_IMPROVEMENT | No | POOR | Only 248 lines. Needs light curve graph, planet size comparison |
| room-convection | chemistry | OK | NEEDS_IMPROVEMENT | No | POOR | Needs temperature labels, flow arrows, heat source visualization |
| reaction-rate-of-solution | chemistry | NEEDS_IMPROVEMENT | NEEDS_IMPROVEMENT | No | POOR (2 sliders) | Only 187 lines. Very basic |
| reaction-time | chemistry | OK | GOOD (21 labels) | No | POOR (3 sliders) | Labels are good but interaction is minimal |
| galvanic-cell-electrochemistry | chemistry | OK | NEEDS_IMPROVEMENT | No | POOR (2 sliders) | Needs electron flow animation, voltage display |
| temperature-and-reaction-rate | chemistry | OK | NEEDS_IMPROVEMENT | No | POOR | Only 200 lines |
| genetic-algorithm | technology | OK | NEEDS_IMPROVEMENT | No | NEEDS_IMPROVEMENT | Needs fitness graph, generation display, population visualization |
| dijkstra-algorithm | technology | OK | NEEDS_IMPROVEMENT | No | POOR | Needs step-by-step mode, distance labels, priority queue visualization |
| heart-rate-counter | biology | OK | POOR | No | NEEDS_IMPROVEMENT | Needs ECG waveform, BPM display with units |
| astar-pathfinding | technology | WEAK (5 draws) | POOR | No | NEEDS_IMPROVEMENT | Very few draw calls for a pathfinding viz. Needs grid, open/closed sets, path highlighting |
| coriolis-effect | earth | OK | POOR (8 labels) | Yes ⭐⭐ | POOR | Earth rotation is inherently 3D |

---

## 🟢 Good Simulations (Solid implementations)

| Slug | Category | Labels | UI Quality | Notes |
|------|----------|--------|------------|-------|
| titration-curves | chemistry | GOOD (27 labels, 65 axis refs) | GOOD (18 sliders) | Excellent — comprehensive with proper axes and units |
| 4-stroke-engine | chemistry | GOOD (21 labels) | NEEDS_IMPROVEMENT | 106 draw calls — very detailed rendering |
| activity-series-metals | chemistry | GOOD (16 labels) | GOOD (8 sliders) | 1057 lines — thorough |
| chemical-bonding | chemistry | GOOD (40 labels!) | GOOD (9 sliders) | Most labels of any chemistry sim |
| carnot-engines | chemistry | GOOD (29 labels) | GOOD (10 sliders) | Well-labeled thermodynamic diagrams |
| stellar-classification | astronomy | GOOD (24 labels) | GOOD (9 sliders) | Best in astronomy category |
| ocean-currents | earth | GOOD (20 labels) | GOOD (21 slider refs!) | Most interactive earth sim |
| seismic-waves | earth | GOOD (22 labels) | NEEDS_IMPROVEMENT | Detailed rendering |
| memory-hierarchy | technology | GOOD (37 labels!) | GOOD (12 sliders) | Best in technology — excellent labeling |
| neural-network-perceptron | technology | GOOD (27 labels) | GOOD (9 sliders) | Well-built |
| cell-size | biology | GOOD (26 labels) | NEEDS_IMPROVEMENT | Good educational content |
| photosynthesis | biology | GOOD (23 labels, 62 axis refs) | NEEDS_IMPROVEMENT | Excellent axis labeling |
| population-dynamics | biology | GOOD (21 labels) | GOOD (6 sliders, 5 animation) | Well-rounded |
| boyles-j-tube | chemistry | GOOD (23 labels) | GOOD (7 sliders) | 727 lines, detailed apparatus |
| area-of-circle | math | GOOD (13 labels) | GOOD (21 slider refs) | Most interactive math sim |

---

## ⭐ Top 3D Upgrade Candidates

Ranked by how much 3D would improve the educational value:

| Priority | Slug | Category | Current State | Why 3D? |
|----------|------|----------|--------------|---------|
| 🥇 1 | crystal-lattice-structures | chemistry | Has pseudo-3D projection already (perspective math) | Crystal structures are INHERENTLY 3D. SC, BCC, FCC, HCP — students need to rotate and inspect. Three.js upgrade would be transformative |
| 🥇 2 | solar-system | astronomy | 2D top-down view | Orbital mechanics, planet tilts, ecliptic plane — 3D is essential for understanding |
| 🥇 3 | dna-replication | biology | 2D diagram (33 draws) | DNA double helix is a 3D structure. Replication fork in 3D would be stunning |
| 🥈 4 | molecule | chemistry | 2D with some 3D math | Molecular geometry (VSEPR) needs 3D — tetrahedral, trigonal planar, etc. |
| 🥈 5 | covalent-bond | chemistry | 2D (48 draws) | Orbital overlap, sigma/pi bonds are 3D concepts |
| 🥈 6 | bohrs-atomic-model | chemistry | 2D circles | Electron shells in 3D with orbital shapes would be much more educational |
| 🥈 7 | earths-magnetic-field | earth | 2D field lines | Dipole field around a sphere — quintessentially 3D |
| 🥈 8 | coriolis-effect | earth | 2D | Rotation effects on a sphere need 3D to understand |
| 🥈 9 | cochlear | biology | 2D (sparse) | Spiral cochlea is 3D anatomy |
| 🥉 10 | nacl-ionic-bond | chemistry | 2D lattice | Rock salt crystal structure in 3D |
| 🥉 11 | formation-model-of-columnar-joint | chemistry | Very sparse 2D | Hexagonal basalt columns are inherently 3D |
| 🥉 12 | ion-model | chemistry | Very sparse | Ionic crystal/solution structure in 3D |
| 🥉 13 | neuron | biology | 2D (54 draws — good art) | 3D neuron with dendrite tree would be amazing |
| 🥉 14 | cell-division | biology | 2D (49 draws) | Mitotic spindle, chromosome alignment — 3D adds depth |
| 🥉 15 | plate-tectonics | earth | 2D cross-section | Globe view with plate boundaries would be far superior |

---

## 📊 Category Summaries

### Chemistry (104 sims)
- **Strongest area overall** — largest collection with many well-built sims
- **Best:** titration-curves, chemical-bonding, 4-stroke-engine, carnot-engines
- **Worst:** cold-warm-water, conduction series (all 3 sparse), ion-model
- **Misplaced sims:** cosmic-expansion (should be astronomy), correction-of-near-sightedness (should be physics/biology), reproduction (biology), maximum-elongation-of-inner-planets (astronomy), normal-distribution (math), resistance-connection (physics)
- **3D priority:** crystal-lattice-structures, molecule, covalent-bond, nacl-ionic-bond

### Biology (24 sims)
- **Good coverage** of genetics, anatomy, ecology, cell biology
- **Best:** photosynthesis, cell-size, population-dynamics, neural-signal-transmission
- **Worst:** food-web-ecosystem (134 lines — too basic), why-are-cells-small, cochlear
- **3D priority:** dna-replication, neuron, cell-division, cochlear

### Math (25 sims)
- **Mixed quality** — fractals use pixel manipulation (fine), but many lack labels
- **Best:** area-of-circle, circumference-of-a-circle, trigonometric-functions
- **Worst:** pythagoras-tree, sierpinski-triangle, galton-board (all need more labels)
- **Note:** fractal-explorer and mandelbrot-set render via ImageData — functionally fine but appear "weak" in static analysis

### Astronomy (25 sims)
- **Generally solid** with good variety
- **Best:** stellar-classification, apparent-motion-mars/venus, stellar-lifecycle
- **Worst:** hr-diagram (only 180 lines!), solar-system (only 3 labels)
- **3D priority:** solar-system, eclipse, one-side-of-the-moon, phase-of-moon series

### Earth (11 sims)
- **Smallest category** — good topics but some underdeveloped
- **Best:** ocean-currents (21 slider refs!), seismic-waves, rock-cycle
- **Worst:** greenhouse-effect (158 lines — embarrassingly simple for such critical topic)
- **3D priority:** earths-magnetic-field, coriolis-effect, plate-tectonics

### Technology (18 sims)
- **Generally good labeling** (avg 18 fillText calls — highest of any category)
- **Best:** memory-hierarchy, neural-network-perceptron, blocklab series
- **Worst:** astar-pathfinding (5 draw calls!), dijkstra-algorithm, genetic-algorithm
- **No strong 3D candidates** — 2D is appropriate for CS algorithms

---

## 🎯 Top Priority Actions

1. **Rewrite greenhouse-effect** — 158 lines is unacceptable for the most important Earth science topic
2. **Rewrite food-web-ecosystem** — 134 lines, barely functional
3. **Rewrite hr-diagram** — 180 lines for one of astronomy's most important tools
4. **Upgrade crystal-lattice-structures to Three.js** — already has 3D math, just needs real 3D rendering
5. **Upgrade solar-system to 3D** — natural fit, high educational impact
6. **Fix conduction series** (all 3) — heat transfer is fundamental, currently barely visualized
7. **Add labels to all math fractals** — fractal-explorer, mandelbrot-set, sierpinski-triangle, pythagoras-tree
8. **Fix astar-pathfinding** — 5 draw calls is nearly blank
9. **Reclassify misplaced sims** — cosmic-expansion, normal-distribution, etc. are in wrong categories
10. **Expand dna-replication to 3D** — DNA is the poster child for 3D molecular visualization
