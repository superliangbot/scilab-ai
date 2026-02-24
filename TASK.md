# SciLab AI — Build Task

## What This Is
An AI-enhanced interactive science simulation platform inspired by https://javalab.org/en/
The original site has 300+ simulations built by a Korean middle school science teacher since 1996.

We're building a modern, AI-powered remake and expansion of this concept.

## Architecture

### Tech Stack
- **Frontend:** Next.js 15 + TypeScript + Tailwind CSS
- **Simulations:** HTML5 Canvas + Three.js (3D) + Matter.js (physics engine) + D3.js (data viz)
- **AI Layer:** OpenAI API for tutoring, explanations, adaptive hints
- **Database:** PostgreSQL (simulation metadata, user progress, analytics)
- **Deployment-ready:** Docker compose

### Project Structure
```
scilab-ai/
├── README.md
├── package.json
├── docker-compose.yml
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── prisma/
│   └── schema.prisma          # DB schema
├── src/
│   ├── app/                   # Next.js app router
│   │   ├── layout.tsx
│   │   ├── page.tsx           # Landing page with simulation browser
│   │   ├── sim/[slug]/page.tsx # Individual simulation page
│   │   ├── category/[cat]/page.tsx
│   │   └── api/
│   │       ├── ai/chat/route.ts    # AI tutor endpoint
│   │       └── sims/route.ts       # Simulation metadata API
│   ├── components/
│   │   ├── SimCanvas.tsx      # Generic simulation wrapper
│   │   ├── AITutor.tsx        # AI chat sidebar
│   │   ├── SimControls.tsx    # Parameter sliders/inputs
│   │   ├── SimBrowser.tsx     # Grid of all simulations
│   │   └── CategoryNav.tsx    # Category navigation
│   ├── simulations/           # Individual simulation implementations
│   │   ├── registry.ts        # Central registry of all sims
│   │   ├── types.ts           # Shared simulation types
│   │   ├── physics/
│   │   │   ├── pendulum-wave.ts
│   │   │   ├── projectile-motion.ts
│   │   │   ├── gravity-orbits.ts
│   │   │   ├── pulley-system.ts
│   │   │   ├── buoyancy.ts
│   │   │   ├── collision-2d.ts
│   │   │   ├── spring-oscillation.ts
│   │   │   └── inclined-plane.ts
│   │   ├── electricity/
│   │   │   ├── circuit-builder.ts
│   │   │   ├── magnetic-field.ts
│   │   │   ├── lorentz-force.ts
│   │   │   ├── capacitor-charge.ts
│   │   │   └── ohms-law.ts
│   │   ├── chemistry/
│   │   │   ├── gas-laws.ts
│   │   │   ├── molecular-motion.ts
│   │   │   ├── heat-conduction.ts
│   │   │   ├── convection.ts
│   │   │   └── periodic-table.ts
│   │   ├── astronomy/
│   │   │   ├── solar-system.ts
│   │   │   ├── eclipse.ts
│   │   │   ├── moon-phases.ts
│   │   │   └── solar-wind.ts
│   │   ├── biology/
│   │   │   ├── cell-division.ts
│   │   │   ├── dna-replication.ts
│   │   │   └── ecosystem.ts
│   │   ├── waves/
│   │   │   ├── wave-interference.ts
│   │   │   ├── standing-waves.ts
│   │   │   ├── light-refraction.ts
│   │   │   └── color-mixing.ts
│   │   └── math/
│   │       ├── fractal-explorer.ts
│   │       ├── chaos-pendulum.ts
│   │       └── function-grapher.ts
│   ├── lib/
│   │   ├── ai.ts              # OpenAI integration
│   │   ├── simulation-engine.ts # Base simulation engine
│   │   └── db.ts              # Prisma client
│   └── styles/
│       └── globals.css
├── scripts/
│   └── scrape-javalab.ts      # Scraper to catalog all JavaLab sims
└── public/
    └── og-image.png
```

## Phase 1: Foundation + First 10 Simulations

Build the complete platform with these 10 working simulations:

1. **Pendulum Wave** (physics) — Multiple pendulums of different lengths creating wave patterns
2. **Projectile Motion** (physics) — Launch angle, velocity, gravity controls
3. **Gas Laws** (chemistry) — PV=nRT with particle visualization (Boyle's law, Charles's law)
4. **Circuit Builder** (electricity) — Drag-and-drop circuit components, see current flow
5. **Solar System** (astronomy) — Orbital mechanics, planet info, scale controls
6. **Wave Interference** (waves) — Two wave sources, constructive/destructive interference
7. **Molecular Motion** (chemistry) — Temperature-driven particle movement
8. **Gravity Orbits** (physics) — Place masses, watch gravitational interactions
9. **Eclipse** (astronomy) — Sun-Moon-Earth alignment visualization
10. **Fractal Explorer** (math) — Mandelbrot/Julia set zoom

### Each Simulation Must Have:
- **Interactive canvas** with real-time physics/math
- **Parameter controls** (sliders, inputs) to modify variables
- **AI Tutor panel** — Chat with AI about what's happening, ask questions, get explanations
- **Info panel** — Educational content explaining the science
- **Responsive** — Works on desktop and tablet

### AI Tutor Features:
- Contextual awareness: knows which simulation is running and current parameter values
- Can explain concepts at different levels (elementary, middle school, high school, college)
- Suggests experiments: "Try increasing the mass and see what happens to the period"
- Answers questions about the underlying science
- Uses the OpenAI chat completions API

### Platform Features:
- Category-based navigation (Physics, Chemistry, Biology, Astronomy, Waves, Math, Electricity)
- Search functionality
- Dark/light mode
- Simulation thumbnails/previews
- Mobile-responsive grid layout

## Phase 2 Roadmap (do NOT build yet, just note in README):
- User accounts + progress tracking
- Classroom mode (teacher creates assignments)
- More simulations (target 50+)
- Block coding integration (like JavaLab's Blocklab)
- AR/VR experiments
- Multiplayer collaborative sims

## Key Guidelines:
- Use HTML5 Canvas for 2D sims, Three.js for 3D
- Every sim is a self-contained module that exports a standard interface
- Physics must be accurate — use real formulas, not fake approximations
- Animations must be smooth (requestAnimationFrame, delta time)
- Code should be clean, typed, well-documented
- Include a comprehensive README.md

## Reference:
- Original site: https://javalab.org/en/
- Categories: Mechanics, Electricity & Magnetism, Light & Wave, Chemistry, Astronomy, Biology, Mathematics, Work & Energy, Atoms
