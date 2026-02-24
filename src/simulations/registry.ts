import type { SimulationConfig, SimulationFactory, Category } from "./types";

// Simulation configs (static metadata — no code imports needed for browsing)
export const simulationConfigs: SimulationConfig[] = [
  {
    slug: "pendulum-wave",
    title: "Pendulum Wave",
    category: "physics",
    description: "Multiple pendulums of different lengths creating mesmerizing wave patterns.",
    longDescription:
      "A pendulum wave is a device where several pendulums of monotonically increasing lengths (and thus different periods) are started simultaneously. As they swing, they create beautiful visual wave patterns. The effect relies on the relationship T = 2π√(L/g) — each pendulum's period depends on its length. When carefully tuned, the pendulums cycle through various patterns before eventually realigning.",
    parameters: [
      { key: "numPendulums", label: "Number of Pendulums", min: 5, max: 30, step: 1, defaultValue: 15 },
      { key: "gravity", label: "Gravity", min: 1, max: 20, step: 0.1, defaultValue: 9.81, unit: "m/s²" },
      { key: "amplitude", label: "Amplitude", min: 10, max: 60, step: 1, defaultValue: 30, unit: "°" },
      { key: "lengthDelta", label: "Length Delta", min: 0.01, max: 0.1, step: 0.005, defaultValue: 0.04, unit: "m" },
    ],
    thumbnailColor: "#3b82f6",
    icon: "🎵",
  },
  {
    slug: "projectile-motion",
    title: "Projectile Motion",
    category: "physics",
    description: "Launch projectiles with adjustable angle, velocity, and gravity.",
    longDescription:
      "Projectile motion is the motion of an object thrown or projected into the air, subject only to gravity. The path (trajectory) follows a parabolic curve described by x(t) = v₀cos(θ)t and y(t) = v₀sin(θ)t - ½gt². This simulation lets you explore how launch angle, initial velocity, and gravity affect range, maximum height, and flight time.",
    parameters: [
      { key: "angle", label: "Launch Angle", min: 0, max: 90, step: 1, defaultValue: 45, unit: "°" },
      { key: "velocity", label: "Initial Velocity", min: 5, max: 100, step: 1, defaultValue: 40, unit: "m/s" },
      { key: "gravity", label: "Gravity", min: 1, max: 20, step: 0.1, defaultValue: 9.81, unit: "m/s²" },
      { key: "mass", label: "Mass", min: 0.1, max: 10, step: 0.1, defaultValue: 1, unit: "kg" },
    ],
    thumbnailColor: "#ef4444",
    icon: "🎯",
  },
  {
    slug: "gas-laws",
    title: "Gas Laws",
    category: "chemistry",
    description: "PV=nRT with particle visualization — Boyle's, Charles's, and Gay-Lussac's laws.",
    longDescription:
      "The ideal gas law PV = nRT relates pressure (P), volume (V), amount of substance (n), gas constant (R), and temperature (T). This simulation visualizes gas particles in a container, showing how changing temperature, volume, or number of particles affects pressure. Watch particles collide with walls — the collective force of these collisions IS pressure.",
    parameters: [
      { key: "temperature", label: "Temperature", min: 50, max: 1000, step: 10, defaultValue: 300, unit: "K" },
      { key: "volume", label: "Volume", min: 20, max: 100, step: 1, defaultValue: 60, unit: "%" },
      { key: "numParticles", label: "Particles", min: 10, max: 200, step: 5, defaultValue: 80 },
    ],
    thumbnailColor: "#10b981",
    icon: "🫧",
  },
  {
    slug: "circuit-builder",
    title: "Circuit Builder",
    category: "electricity",
    description: "Build circuits with resistors, batteries, and switches — see current flow.",
    longDescription:
      "Explore electrical circuits by placing batteries, resistors, and wires on a grid. The simulation applies Ohm's Law (V = IR) and Kirchhoff's circuit laws to calculate current flow through each component. Watch animated charges flow through the circuit and observe how adding components in series vs parallel affects total resistance and current.",
    parameters: [
      { key: "voltage", label: "Battery Voltage", min: 1, max: 24, step: 0.5, defaultValue: 9, unit: "V" },
      { key: "resistance1", label: "Resistor 1", min: 1, max: 100, step: 1, defaultValue: 10, unit: "Ω" },
      { key: "resistance2", label: "Resistor 2", min: 1, max: 100, step: 1, defaultValue: 20, unit: "Ω" },
      { key: "circuitType", label: "Circuit Type (0=Series,1=Parallel)", min: 0, max: 1, step: 1, defaultValue: 0 },
    ],
    thumbnailColor: "#f59e0b",
    icon: "⚡",
  },
  {
    slug: "solar-system",
    title: "Solar System",
    category: "astronomy",
    description: "Orbital mechanics with adjustable time scale and planet information.",
    longDescription:
      "Explore our solar system with this orbital mechanics simulation. Planets orbit the Sun following Kepler's laws of planetary motion. The simulation uses Newton's law of gravitation F = GMm/r² to compute orbital paths. Adjust the time scale to watch years pass in seconds, and click on planets to learn about their properties.",
    parameters: [
      { key: "timeScale", label: "Time Scale", min: 0.1, max: 50, step: 0.1, defaultValue: 5, unit: "×" },
      { key: "zoom", label: "Zoom", min: 0.2, max: 3, step: 0.1, defaultValue: 1, unit: "×" },
      { key: "showOrbits", label: "Show Orbits (0/1)", min: 0, max: 1, step: 1, defaultValue: 1 },
      { key: "showLabels", label: "Show Labels (0/1)", min: 0, max: 1, step: 1, defaultValue: 1 },
    ],
    thumbnailColor: "#8b5cf6",
    icon: "🪐",
  },
  {
    slug: "wave-interference",
    title: "Wave Interference",
    category: "waves",
    description: "Two wave sources showing constructive and destructive interference patterns.",
    longDescription:
      "Wave interference occurs when two waves overlap. When crests meet crests (constructive interference), the amplitude increases. When crests meet troughs (destructive interference), they cancel out. This simulation shows two point sources emitting circular waves, creating the classic interference pattern. The resulting pattern depends on wavelength, source separation, and phase difference.",
    parameters: [
      { key: "wavelength", label: "Wavelength", min: 10, max: 80, step: 1, defaultValue: 30, unit: "px" },
      { key: "amplitude", label: "Amplitude", min: 0.1, max: 2, step: 0.1, defaultValue: 1 },
      { key: "separation", label: "Source Separation", min: 20, max: 300, step: 5, defaultValue: 150, unit: "px" },
      { key: "frequency", label: "Frequency", min: 0.5, max: 5, step: 0.1, defaultValue: 2, unit: "Hz" },
    ],
    thumbnailColor: "#06b6d4",
    icon: "🌊",
  },
  {
    slug: "molecular-motion",
    title: "Molecular Motion",
    category: "chemistry",
    description: "Temperature-driven particle movement demonstrating kinetic molecular theory.",
    longDescription:
      "Kinetic molecular theory explains that temperature is a measure of the average kinetic energy of molecules. Higher temperature means faster-moving particles. This simulation shows molecules bouncing around in a container, with their speeds following the Maxwell-Boltzmann distribution. Watch how temperature affects particle speed, collision frequency, and pressure on the container walls.",
    parameters: [
      { key: "temperature", label: "Temperature", min: 10, max: 1000, step: 10, defaultValue: 300, unit: "K" },
      { key: "numMolecules", label: "Molecules", min: 10, max: 300, step: 10, defaultValue: 100 },
      { key: "moleculeSize", label: "Molecule Size", min: 2, max: 8, step: 0.5, defaultValue: 4, unit: "px" },
    ],
    thumbnailColor: "#ec4899",
    icon: "🔬",
  },
  {
    slug: "gravity-orbits",
    title: "Gravity Orbits",
    category: "physics",
    description: "Place masses in space and watch gravitational interactions unfold.",
    longDescription:
      "Newton's law of universal gravitation states F = Gm₁m₂/r². This simulation lets you place masses in 2D space and watch them interact gravitationally. Create binary star systems, launch satellites, or set up complex multi-body interactions. The simulation uses numerical integration (Verlet method) to compute trajectories with good energy conservation.",
    parameters: [
      { key: "gravity", label: "Gravitational Constant", min: 0.1, max: 10, step: 0.1, defaultValue: 2 },
      { key: "trailLength", label: "Trail Length", min: 0, max: 500, step: 10, defaultValue: 200 },
      { key: "timeStep", label: "Time Step", min: 0.1, max: 3, step: 0.1, defaultValue: 1, unit: "×" },
    ],
    thumbnailColor: "#6366f1",
    icon: "🌌",
  },
  {
    slug: "eclipse",
    title: "Eclipse",
    category: "astronomy",
    description: "Sun-Moon-Earth alignment visualization showing solar and lunar eclipses.",
    longDescription:
      "An eclipse occurs when one celestial body passes into the shadow of another. A solar eclipse happens when the Moon passes between the Sun and Earth, blocking sunlight. A lunar eclipse occurs when Earth passes between the Sun and Moon, casting its shadow on the Moon. This simulation visualizes these alignments with accurate relative sizes and orbital mechanics.",
    parameters: [
      { key: "moonOrbitSpeed", label: "Moon Orbit Speed", min: 0.1, max: 5, step: 0.1, defaultValue: 1, unit: "×" },
      { key: "moonDistance", label: "Moon Distance", min: 0.5, max: 2, step: 0.05, defaultValue: 1, unit: "×" },
      { key: "viewAngle", label: "View Angle", min: 0, max: 90, step: 1, defaultValue: 15, unit: "°" },
      { key: "showShadows", label: "Show Shadows (0/1)", min: 0, max: 1, step: 1, defaultValue: 1 },
    ],
    thumbnailColor: "#1e293b",
    icon: "🌑",
  },
  {
    slug: "fractal-explorer",
    title: "Fractal Explorer",
    category: "math",
    description: "Explore Mandelbrot and Julia sets with interactive zoom.",
    longDescription:
      "Fractals are infinitely complex patterns that are self-similar across different scales. The Mandelbrot set is defined by iterating z = z² + c for each point c in the complex plane — points that don't diverge are in the set. Julia sets are related: for a fixed c, which starting points z₀ don't diverge? Zoom into the boundary to discover infinite complexity.",
    parameters: [
      { key: "maxIterations", label: "Max Iterations", min: 20, max: 500, step: 10, defaultValue: 100 },
      { key: "colorScheme", label: "Color Scheme (0-4)", min: 0, max: 4, step: 1, defaultValue: 0 },
      { key: "juliaReal", label: "Julia Real (c)", min: -2, max: 2, step: 0.01, defaultValue: -0.7 },
      { key: "juliaImag", label: "Julia Imaginary (c)", min: -2, max: 2, step: 0.01, defaultValue: 0.27 },
    ],
    thumbnailColor: "#a855f7",
    icon: "🌀",
  },
  // ── Batch 1 simulations (15 new) ──────────────────────────────────
  {
    slug: "four-stroke-engine",
    title: "Four-Stroke Engine",
    category: "chemistry",
    description: "Interactive Otto cycle engine with piston, valves, crankshaft, and real-time PV diagram.",
    longDescription: "The four-stroke Otto cycle is the thermodynamic cycle used in most gasoline engines. It consists of four strokes: Intake (fuel-air mixture drawn in), Compression (adiabatic compression with PV^γ = const, γ=1.4), Power (spark ignition and adiabatic expansion), and Exhaust (burned gases expelled). This simulation visualizes the complete mechanical system — piston, connecting rod, crankshaft, valves, and spark plug — alongside a real-time Pressure-Volume diagram showing the Otto cycle. The ideal thermal efficiency is η = 1 − 1/r^(γ−1) where r is the compression ratio.",
    parameters: [
      { key: "rpm", label: "Engine Speed", min: 100, max: 3000, step: 100, defaultValue: 600, unit: "RPM" },
      { key: "numParticles", label: "Particles", min: 10, max: 100, step: 5, defaultValue: 40 },
    ],
    thumbnailColor: "#e85d26",
    icon: "🔧",
  },
  {
    slug: "abo-blood-type",
    title: "ABO Blood Type Inheritance",
    category: "biology",
    description: "Punnett square visualization of ABO blood type genetics with animated allele inheritance.",
    longDescription: "ABO blood type is determined by a single gene with three alleles: A, B, and O. A and B are codominant — both are expressed when present together, producing type AB. Both A and B are dominant over O. This simulation animates a Punnett square cross between two parents, showing how alleles separate and recombine to produce offspring with predictable blood type ratios.",
    parameters: [
      { key: "parent1", label: "Parent 1 Genotype (0=AA,1=AO,2=BB,3=BO,4=OO,5=AB)", min: 0, max: 5, step: 1, defaultValue: 1 },
      { key: "parent2", label: "Parent 2 Genotype (0=AA,1=AO,2=BB,3=BO,4=OO,5=AB)", min: 0, max: 5, step: 1, defaultValue: 3 },
      { key: "animationSpeed", label: "Animation Speed", min: 0.5, max: 3, step: 0.5, defaultValue: 1, unit: "×" },
    ],
    thumbnailColor: "#ec4899",
    icon: "🩸",
  },
  {
    slug: "absorption-emission-light",
    title: "Absorption & Emission of Light",
    category: "physics",
    description: "Visualize atoms absorbing and emitting photons with Bohr model energy levels.",
    longDescription: "When a photon with just the right energy strikes an atom, it can be absorbed, causing an electron to jump from a lower energy level to a higher one. After a short time, the electron spontaneously drops back, emitting a new photon. This simulation uses the Bohr model (E_n = -13.6/n² eV) to show discrete energy levels, photon absorption and emission, and the relationship between photon energy and wavelength/color.",
    parameters: [
      { key: "photonEnergy", label: "Photon Energy Level", min: 1, max: 3, step: 1, defaultValue: 1 },
      { key: "emissionRate", label: "Photon Rate", min: 0.5, max: 5, step: 0.5, defaultValue: 2, unit: "/s" },
      { key: "numAtoms", label: "Number of Atoms", min: 1, max: 5, step: 1, defaultValue: 3 },
      { key: "speed", label: "Animation Speed", min: 0.5, max: 3, step: 0.5, defaultValue: 1, unit: "×" },
    ],
    thumbnailColor: "#7c3aed",
    icon: "✨",
  },
  {
    slug: "ac-generator",
    title: "AC Generator",
    category: "electricity",
    description: "Visualize an AC power generator using electromagnetic induction.",
    longDescription: "An AC generator converts mechanical energy into electrical energy using electromagnetic induction. A coil rotates in a magnetic field, and the changing magnetic flux induces an EMF described by ε = NBAω sin(ωt), where N is the number of turns, B is the magnetic field strength, A is the coil area, and ω is the angular velocity.",
    parameters: [
      { key: "rpm", label: "Rotation Speed", min: 30, max: 300, step: 10, defaultValue: 60, unit: "RPM" },
      { key: "turns", label: "Number of Turns", min: 1, max: 20, step: 1, defaultValue: 10 },
      { key: "fieldStrength", label: "Magnetic Field", min: 0.1, max: 2, step: 0.1, defaultValue: 1, unit: "T" },
      { key: "coilArea", label: "Coil Area", min: 0.01, max: 0.1, step: 0.01, defaultValue: 0.05, unit: "m²" },
    ],
    thumbnailColor: "#f97316",
    icon: "⚡",
  },
  {
    slug: "activity-series-metals",
    title: "Activity Series of Metals",
    category: "chemistry",
    description: "Visualize metal reactivity by immersing a metal plate into another metal's ion solution.",
    longDescription: "The activity series ranks metals by their tendency to lose electrons. A more reactive metal displaces a less reactive one from solution. For example, Zn + Cu²⁺ → Zn²⁺ + Cu. This simulation lets you pick any metal plate and ion solution to see whether a reaction occurs, with animated ion exchange and deposit formation. Activity series: Al > Zn > Fe > Pb > Cu > Ag.",
    parameters: [
      { key: "metalPlate", label: "Metal Plate (0=Zn,1=Cu,2=Fe,3=Ag,4=Al,5=Pb)", min: 0, max: 5, step: 1, defaultValue: 0 },
      { key: "solutionMetal", label: "Solution Ion (0=Zn²⁺,1=Cu²⁺,2=Fe²⁺,3=Ag⁺,4=Al³⁺,5=Pb²⁺)", min: 0, max: 5, step: 1, defaultValue: 1 },
      { key: "speed", label: "Reaction Speed", min: 0.5, max: 3, step: 0.5, defaultValue: 1, unit: "×" },
    ],
    thumbnailColor: "#14b8a6",
    icon: "🧪",
  },
  {
    slug: "addition-of-force",
    title: "Addition of Force",
    category: "physics",
    description: "Visualize vector addition of two forces using the parallelogram method.",
    longDescription: "The parallelogram law of vector addition states that if two forces acting at a point are represented by two adjacent sides of a parallelogram, then their resultant is the diagonal. Given F₁ and F₂ at angles θ₁ and θ₂, the resultant has components Rₓ = F₁cos(θ₁) + F₂cos(θ₂) and Rᵧ = F₁sin(θ₁) + F₂sin(θ₂), with magnitude |R| = √(Rₓ² + Rᵧ²).",
    parameters: [
      { key: "magnitude1", label: "Force 1 Magnitude", min: 1, max: 20, step: 0.5, defaultValue: 8, unit: "N" },
      { key: "angle1", label: "Force 1 Angle", min: 0, max: 360, step: 5, defaultValue: 30, unit: "°" },
      { key: "magnitude2", label: "Force 2 Magnitude", min: 1, max: 20, step: 0.5, defaultValue: 6, unit: "N" },
      { key: "angle2", label: "Force 2 Angle", min: 0, max: 360, step: 5, defaultValue: 120, unit: "°" },
    ],
    thumbnailColor: "#f43f5e",
    icon: "↔️",
  },
  {
    slug: "addition-polymerization",
    title: "Addition Polymerization",
    category: "chemistry",
    description: "Visualize monomers linking into polymers through addition polymerization with ball-and-stick models.",
    longDescription: "Addition polymerization occurs when monomers with C=C double bonds open those bonds to form new single bonds with adjacent monomers, creating polymer chains with no byproducts. This simulation shows the process for six common polymers: Polyethylene (PE), PVC, Polypropylene (PP), Polystyrene (PS), Polyacrylonitrile (PAN), and Polyvinyl Acetate (PVA).",
    parameters: [
      { key: "polymerType", label: "Polymer Type (0=PE,1=PVC,2=PP,3=PS,4=PAN,5=PVA)", min: 0, max: 5, step: 1, defaultValue: 0 },
      { key: "chainLength", label: "Chain Length", min: 1, max: 8, step: 1, defaultValue: 3 },
      { key: "showLabels", label: "Show Atom Labels (0/1)", min: 0, max: 1, step: 1, defaultValue: 1 },
    ],
    thumbnailColor: "#0d9488",
    icon: "🧱",
  },
  {
    slug: "air-conditioner",
    title: "Air Conditioner / Heat Pump",
    category: "chemistry",
    description: "Vapor-compression refrigeration cycle with animated refrigerant flow and thermodynamics.",
    longDescription: "An air conditioner uses the vapor-compression refrigeration cycle to move heat from a cold reservoir to a hot one. The cycle has four stages: evaporator (absorbs heat), compressor (raises pressure/temperature), condenser (releases heat), and expansion valve (adiabatic cooling). COP = Q_cold / W_input measures efficiency. In heat pump mode the cycle reverses.",
    parameters: [
      { key: "mode", label: "Mode (0=AC, 1=Heat Pump)", min: 0, max: 1, step: 1, defaultValue: 0 },
      { key: "compressorPower", label: "Compressor Power", min: 0.5, max: 3, step: 0.5, defaultValue: 1, unit: "×" },
      { key: "outdoorTemp", label: "Outdoor Temp", min: -10, max: 45, step: 1, defaultValue: 35, unit: "°C" },
      { key: "indoorTemp", label: "Indoor Temp", min: 15, max: 35, step: 1, defaultValue: 25, unit: "°C" },
    ],
    thumbnailColor: "#0ea5e9",
    icon: "❄️",
  },
  {
    slug: "air-pressure",
    title: "Air Pressure & Wind",
    category: "physics",
    description: "Visualize how atmospheric pressure differences create wind with Coriolis effect.",
    longDescription: "Atmospheric pressure differences drive wind. Air flows from high to low pressure via the pressure gradient force (F = -∇P). The Coriolis effect deflects moving air — right in the Northern Hemisphere, left in the Southern. This creates clockwise outward spirals from high-pressure and counterclockwise inward spirals to low-pressure systems (reversed in the Southern Hemisphere).",
    parameters: [
      { key: "coriolisEffect", label: "Coriolis Effect", min: 0, max: 100, step: 5, defaultValue: 70, unit: "%" },
      { key: "pressureDiff", label: "Pressure Difference", min: 5, max: 40, step: 5, defaultValue: 20, unit: "hPa" },
      { key: "hemisphere", label: "Hemisphere (0=North, 1=South)", min: 0, max: 1, step: 1, defaultValue: 0 },
      { key: "windSpeed", label: "Wind Speed Scale", min: 0.5, max: 3, step: 0.5, defaultValue: 1, unit: "×" },
    ],
    thumbnailColor: "#1e6091",
    icon: "🌬️",
  },
  {
    slug: "alkane-compound",
    title: "Alkane Compounds",
    category: "chemistry",
    description: "Visualize alkane molecular structures with ball-and-stick models from methane to decane.",
    longDescription: "Alkanes are saturated hydrocarbons with the general formula CₙH₂ₙ₊₂, containing only single C-C and C-H bonds. Each carbon is sp³ hybridized with tetrahedral geometry (109.5° bond angles). This simulation renders 2D ball-and-stick models of alkanes from methane (CH₄) to decane (C₁₀H₂₂), showing the characteristic zig-zag carbon backbone.",
    parameters: [
      { key: "carbonCount", label: "Number of Carbons", min: 1, max: 10, step: 1, defaultValue: 3 },
      { key: "showLabels", label: "Show Atom Labels (0/1)", min: 0, max: 1, step: 1, defaultValue: 1 },
      { key: "bondLength", label: "Bond Length Scale", min: 0.5, max: 2, step: 0.1, defaultValue: 1, unit: "×" },
      { key: "rotation", label: "Auto Rotate (0/1)", min: 0, max: 1, step: 1, defaultValue: 1 },
    ],
    thumbnailColor: "#4ade80",
    icon: "⚛️",
  },
  {
    slug: "am-fm-modulation",
    title: "AM & FM Modulation",
    category: "physics",
    description: "Visualize amplitude and frequency modulation of radio waves side by side.",
    longDescription: "Amplitude Modulation (AM) and Frequency Modulation (FM) are two fundamental techniques for encoding information onto carrier waves. In AM, the carrier's amplitude varies with the message signal. In FM, the carrier's frequency varies instead. AM is simpler but more susceptible to noise, while FM provides better noise immunity at the cost of greater bandwidth.",
    parameters: [
      { key: "messageFreq", label: "Message Frequency", min: 0.5, max: 5, step: 0.5, defaultValue: 1, unit: "Hz" },
      { key: "carrierFreq", label: "Carrier Frequency", min: 5, max: 30, step: 1, defaultValue: 15, unit: "Hz" },
      { key: "amIndex", label: "AM Modulation Index", min: 0.1, max: 1, step: 0.1, defaultValue: 0.7 },
      { key: "fmIndex", label: "FM Modulation Index", min: 0.5, max: 10, step: 0.5, defaultValue: 5 },
    ],
    thumbnailColor: "#6366f1",
    icon: "📡",
  },
  {
    slug: "ammeter",
    title: "Ammeter",
    category: "electricity",
    description: "Visualize the internal structure and operation of an analog ammeter with moving coil mechanism.",
    longDescription: "An analog ammeter measures electric current by detecting the magnetic force on a current-carrying coil. A coil in a permanent magnetic field experiences torque T = NBIA sin(θ), balanced by a spring torque T = kθ. At equilibrium, deflection is proportional to current: θ = NBIA/k. A low-resistance shunt resistor allows measuring large currents while keeping coil current small.",
    parameters: [
      { key: "current", label: "Current", min: 0, max: 5, step: 0.1, defaultValue: 2.5, unit: "A" },
      { key: "range", label: "Range (0=500mA, 1=5A)", min: 0, max: 1, step: 1, defaultValue: 1 },
      { key: "showInternal", label: "Show Internal (0/1)", min: 0, max: 1, step: 1, defaultValue: 1 },
      { key: "voltage", label: "Battery Voltage", min: 1, max: 12, step: 0.5, defaultValue: 9, unit: "V" },
    ],
    thumbnailColor: "#eab308",
    icon: "⚡",
  },
  {
    slug: "apparent-motion-mars",
    title: "Apparent Motion of Mars",
    category: "astronomy",
    description: "Visualize why Mars appears to move backward (retrograde motion) in Earth's sky.",
    longDescription: "Mars occasionally appears to reverse direction across the night sky — this is retrograde motion. It occurs because Earth orbits faster than Mars. When Earth overtakes Mars near opposition, Mars appears to drift westward even though both planets orbit in the same direction. This simulation shows orbital mechanics and the resulting apparent path with prograde and retrograde segments color-coded.",
    parameters: [
      { key: "speed", label: "Animation Speed", min: 0.5, max: 5, step: 0.5, defaultValue: 1, unit: "×" },
      { key: "showSightLines", label: "Show Sight Lines (0/1)", min: 0, max: 1, step: 1, defaultValue: 1 },
      { key: "trailLength", label: "Trail Length", min: 50, max: 500, step: 50, defaultValue: 200 },
      { key: "showLabels", label: "Show Labels (0/1)", min: 0, max: 1, step: 1, defaultValue: 1 },
    ],
    thumbnailColor: "#dc2626",
    icon: "⭐",
  },
  {
    slug: "apparent-motion-venus",
    title: "Apparent Motion of Venus",
    category: "astronomy",
    description: "Visualize Venus's apparent motion from Earth, showing its phases, elongation, and morning/evening star cycle.",
    longDescription: "Venus orbits inside Earth's orbit (0.723 AU), so it never strays far from the Sun — maximum elongation is about 47°. Its phase and apparent size change dramatically through its cycle: small and nearly full near superior conjunction, half-illuminated at greatest elongation, and a large thin crescent near inferior conjunction. Venus alternates between 'evening star' and 'morning star' over its 584-day synodic period.",
    parameters: [
      { key: "speed", label: "Animation Speed", min: 0.5, max: 5, step: 0.5, defaultValue: 1, unit: "×" },
      { key: "showPhase", label: "Show Phase Detail (0/1)", min: 0, max: 1, step: 1, defaultValue: 1 },
      { key: "trailLength", label: "Trail Length", min: 50, max: 500, step: 50, defaultValue: 200 },
      { key: "showElongation", label: "Show Elongation (0/1)", min: 0, max: 1, step: 1, defaultValue: 1 },
    ],
    thumbnailColor: "#daa520",
    icon: "✨",
  },
  {
    slug: "element-game",
    title: "Element Symbol Game",
    category: "chemistry",
    description: "Educational bubble game for learning chemical element symbols from the periodic table.",
    longDescription: "Test your knowledge of the periodic table! Bubbles with element symbols float upward. A target element is displayed — when the matching bubble enters the match zone, it auto-pops. Elements are color-coded by category (alkali metals, noble gases, transition metals, etc.) and a mini periodic table highlights the current target. Adjust difficulty and element range to customize the challenge.",
    parameters: [
      { key: "difficulty", label: "Difficulty (1=Easy, 2=Medium, 3=Hard)", min: 1, max: 3, step: 1, defaultValue: 1 },
      { key: "elementRange", label: "Element Range (1=1-20, 2=1-50, 3=1-103)", min: 1, max: 3, step: 1, defaultValue: 1 },
      { key: "speed", label: "Game Speed", min: 0.5, max: 3, step: 0.5, defaultValue: 1, unit: "×" },
      { key: "showNames", label: "Show Element Names (0/1)", min: 0, max: 1, step: 1, defaultValue: 1 },
    ],
    thumbnailColor: "#8b5cf6",
    icon: "🧪",
  },
];

// Lazy-loaded simulation factories
const simulationFactories: Record<string, () => Promise<SimulationFactory>> = {
  "pendulum-wave": () => import("./physics/pendulum-wave").then((m) => m.default),
  "projectile-motion": () => import("./physics/projectile-motion").then((m) => m.default),
  "gas-laws": () => import("./chemistry/gas-laws").then((m) => m.default),
  "circuit-builder": () => import("./electricity/circuit-builder").then((m) => m.default),
  "solar-system": () => import("./astronomy/solar-system").then((m) => m.default),
  "wave-interference": () => import("./waves/wave-interference").then((m) => m.default),
  "molecular-motion": () => import("./chemistry/molecular-motion").then((m) => m.default),
  "gravity-orbits": () => import("./physics/gravity-orbits").then((m) => m.default),
  "eclipse": () => import("./astronomy/eclipse").then((m) => m.default),
  "fractal-explorer": () => import("./math/fractal-explorer").then((m) => m.default),
  "four-stroke-engine": () => import("./chemistry/four-stroke-engine").then((m) => m.default),
  "abo-blood-type": () => import("./biology/abo-blood-type").then((m) => m.default),
  "absorption-emission-light": () => import("./physics/absorption-emission-light").then((m) => m.default),
  "ac-generator": () => import("./electricity/ac-generator").then((m) => m.default),
  "activity-series-metals": () => import("./chemistry/activity-series-metals").then((m) => m.default),
  "addition-of-force": () => import("./physics/addition-of-force").then((m) => m.default),
  "addition-polymerization": () => import("./chemistry/addition-polymerization").then((m) => m.default),
  "air-conditioner": () => import("./chemistry/air-conditioner").then((m) => m.default),
  "air-pressure": () => import("./physics/air-pressure").then((m) => m.default),
  "alkane-compound": () => import("./chemistry/alkane-compound").then((m) => m.default),
  "am-fm-modulation": () => import("./physics/am-fm-modulation").then((m) => m.default),
  "ammeter": () => import("./electricity/ammeter").then((m) => m.default),
  "apparent-motion-mars": () => import("./astronomy/apparent-motion-mars").then((m) => m.default),
  "apparent-motion-venus": () => import("./astronomy/apparent-motion-venus").then((m) => m.default),
  "element-game": () => import("./chemistry/element-game").then((m) => m.default),
};

export function getSimConfig(slug: string): SimulationConfig | undefined {
  return simulationConfigs.find((s) => s.slug === slug);
}

export async function loadSimulation(slug: string): Promise<SimulationFactory | null> {
  const loader = simulationFactories[slug];
  if (!loader) return null;
  return loader();
}

export function getSimsByCategory(category: Category): SimulationConfig[] {
  return simulationConfigs.filter((s) => s.category === category);
}

export const categories: { key: Category; label: string; icon: string; color: string }[] = [
  { key: "physics", label: "Physics", icon: "⚛️", color: "#3b82f6" },
  { key: "chemistry", label: "Chemistry", icon: "🧪", color: "#10b981" },
  { key: "electricity", label: "Electricity", icon: "⚡", color: "#f59e0b" },
  { key: "astronomy", label: "Astronomy", icon: "🔭", color: "#8b5cf6" },
  { key: "waves", label: "Waves", icon: "🌊", color: "#06b6d4" },
  { key: "math", label: "Mathematics", icon: "📐", color: "#a855f7" },
  { key: "biology", label: "Biology", icon: "🧬", color: "#ec4899" },
];
