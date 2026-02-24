# SciLab AI

An AI-enhanced interactive science simulation platform. Explore physics, chemistry, astronomy, and more through interactive simulations with an AI tutor to guide your learning.

Inspired by [JavaLab](https://javalab.org/en/) — a site with 300+ science simulations built by a Korean middle school science teacher since 1996.

## Features

### Interactive Simulations (Phase 1)

| # | Simulation | Category | Description |
|---|-----------|----------|-------------|
| 1 | Pendulum Wave | Physics | Multiple pendulums creating wave patterns using T = 2pi*sqrt(L/g) |
| 2 | Projectile Motion | Physics | Launch angle, velocity, gravity controls with parabolic trajectories |
| 3 | Gas Laws | Chemistry | PV=nRT with particle visualization (Boyle's, Charles's, Gay-Lussac's laws) |
| 4 | Circuit Builder | Electricity | Series/parallel circuits with Ohm's Law and animated current flow |
| 5 | Solar System | Astronomy | Orbital mechanics with real planetary data and Kepler's laws |
| 6 | Wave Interference | Waves | Two-source interference with constructive/destructive patterns |
| 7 | Molecular Motion | Chemistry | Kinetic molecular theory with Maxwell-Boltzmann distributions |
| 8 | Gravity Orbits | Physics | N-body gravitational simulation with Verlet integration |
| 9 | Eclipse | Astronomy | Sun-Moon-Earth alignment with shadow cones |
| 10 | Fractal Explorer | Math | Mandelbrot/Julia sets with smooth coloring |

### Platform Features

- **AI Tutor** — Chat with an AI that understands the current simulation and parameter state
- **Category Navigation** — Browse by Physics, Chemistry, Electricity, Astronomy, Waves, Math
- **Search** — Find simulations by name or description
- **Dark/Light Mode** — Toggle between themes
- **Responsive Design** — Works on desktop and tablet
- **Real-time Controls** — Adjust parameters with sliders and see instant results

### AI Tutor

The AI tutor is contextually aware of:
- Which simulation is currently running
- Current parameter values and state
- Can explain concepts at different levels (elementary through college)
- Suggests experiments to try
- Powered by OpenAI GPT-4o-mini

## Tech Stack

- **Frontend:** Next.js 15 + TypeScript + Tailwind CSS 4
- **Simulations:** HTML5 Canvas 2D
- **AI Layer:** OpenAI API (GPT-4o-mini)
- **Database:** PostgreSQL + Prisma ORM
- **Deployment:** Docker Compose

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- PostgreSQL (or use Docker)
- OpenAI API key (optional, for AI tutor)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/superliangbot/scilab-ai.git
cd scilab-ai

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your OpenAI API key and database URL

# Generate Prisma client
npx prisma generate

# Push database schema (if using PostgreSQL)
npx prisma db push

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to start exploring!

### Docker

```bash
# Set your OpenAI API key
export OPENAI_API_KEY=sk-your-key-here

# Start everything
docker compose up -d

# The app will be available at http://localhost:3000
```

## Project Structure

```
scilab-ai/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Landing page with simulation browser
│   │   ├── sim/[slug]/page.tsx # Individual simulation page
│   │   ├── category/[cat]/     # Category-filtered view
│   │   └── api/                # API routes (AI chat, sim metadata)
│   ├── components/             # React components
│   │   ├── SimCanvas.tsx       # Canvas animation loop wrapper
│   │   ├── AITutor.tsx         # AI chat sidebar
│   │   ├── SimControls.tsx     # Parameter sliders
│   │   ├── SimBrowser.tsx      # Simulation grid with search
│   │   └── ...
│   ├── simulations/            # Self-contained simulation engines
│   │   ├── types.ts            # SimulationEngine interface
│   │   ├── registry.ts         # Central config + lazy loading
│   │   ├── physics/            # Pendulum Wave, Projectile, Gravity Orbits
│   │   ├── chemistry/          # Gas Laws, Molecular Motion
│   │   ├── electricity/        # Circuit Builder
│   │   ├── astronomy/          # Solar System, Eclipse
│   │   ├── waves/              # Wave Interference
│   │   └── math/               # Fractal Explorer
│   └── lib/                    # Utilities (AI, DB, engine)
├── prisma/schema.prisma        # Database schema
├── docker-compose.yml          # Docker setup
└── Dockerfile
```

## How Simulations Work

Each simulation is a self-contained module that implements the `SimulationEngine` interface:

```typescript
interface SimulationEngine {
  init(canvas: HTMLCanvasElement): void;
  update(dt: number, params: Record<string, number>): void;
  render(): void;
  reset(): void;
  destroy(): void;
  getStateDescription(): string;  // For AI tutor context
  resize(width: number, height: number): void;
}
```

Simulations are lazy-loaded — only the code for the active simulation is downloaded.

## Phase 2 Roadmap

- User accounts + progress tracking
- Classroom mode (teacher creates assignments)
- More simulations (target: 50+)
- Block coding integration
- AR/VR experiments
- Multiplayer collaborative simulations

## License

MIT
