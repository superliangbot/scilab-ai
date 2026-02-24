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
