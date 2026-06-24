# Earth Explorer — Implementation Plan

## Overview

Build a visually stunning, interactive 3D Earth visualization platform combining aircraft tracking, satellite orbits, weather systems, educational missions, and gamification. The app will feel like a fusion of Google Earth + FlightRadar24 + NASA Mission Control.

## Architecture Decision: Frontend-First Monolith

> [!IMPORTANT]
> **Given 200 credits**, I'm building a **self-contained Next.js frontend application** that calls external APIs directly from the client/API routes. No separate NestJS backend, PostgreSQL, Redis, Docker, or Kubernetes. This maximizes visual impact and functionality within budget.

The full backend stack (NestJS, PostgreSQL, Redis, Docker, K8s) would consume 80%+ of credits on infrastructure code with zero visual output. Instead:

- **State management**: Zustand (client-side, persisted to localStorage)
- **Data fetching**: Next.js API routes as proxy/cache layer
- **Real-time data**: Direct API polling + simulated WebSocket streams
- **Persistence**: localStorage for user progress/gamification
- **AI Tutor**: Pre-built response engine with contextual knowledge base

## Tech Stack (Implemented)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| 3D Globe | CesiumJS + Resium |
| 3D Effects | Three.js (atmosphere, particles) |
| State | Zustand |
| Styling | TailwindCSS + CSS custom properties |
| Animation | Framer Motion |
| Orbital Math | satellite.js |
| Data | OpenSky, CelesTrak, OpenWeather, NASA APIs |

## Folder Structure

```
j:\aircraft_satellite\
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Main entry
│   │   ├── globals.css             # Global styles + design system
│   │   └── api/
│   │       ├── aircraft/route.ts   # OpenSky proxy
│   │       ├── satellites/route.ts # CelesTrak proxy
│   │       └── weather/route.ts    # Weather proxy
│   ├── components/
│   │   ├── globe/
│   │   │   ├── CesiumGlobe.tsx     # Main CesiumJS globe
│   │   │   ├── AtmosphereEffect.tsx# Custom atmosphere shader
│   │   │   ├── AircraftLayer.tsx   # Flight visualization
│   │   │   ├── SatelliteLayer.tsx  # Satellite orbits
│   │   │   ├── WeatherLayer.tsx    # Weather overlay
│   │   │   └── ISSTracker.tsx      # ISS experience
│   │   ├── ui/
│   │   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   │   ├── FlightPanel.tsx     # Aircraft detail panel
│   │   │   ├── SatellitePanel.tsx  # Satellite detail panel
│   │   │   ├── WeatherPanel.tsx    # Weather controls
│   │   │   ├── ISSPanel.tsx        # ISS info panel
│   │   │   ├── MissionPanel.tsx    # Educational missions
│   │   │   ├── LabPanel.tsx        # Simulation labs
│   │   │   ├── AchievementPanel.tsx# Gamification
│   │   │   ├── AITutor.tsx         # AI teacher
│   │   │   ├── HUD.tsx             # Heads-up display
│   │   │   └── StatusBar.tsx       # Bottom status
│   │   └── shared/
│   │       ├── GlassCard.tsx       # Glassmorphism card
│   │       ├── AnimatedCounter.tsx # Animated numbers
│   │       └── LoadingScreen.tsx   # Cinematic loader
│   ├── stores/
│   │   ├── appStore.ts             # Global app state
│   │   ├── flightStore.ts          # Aircraft data
│   │   ├── satelliteStore.ts       # Satellite data
│   │   ├── weatherStore.ts         # Weather state
│   │   ├── missionStore.ts         # Mission progress
│   │   └── userStore.ts            # Gamification/XP
│   ├── lib/
│   │   ├── cesiumConfig.ts         # CesiumJS setup
│   │   ├── orbitalMechanics.ts     # satellite.js wrapper
│   │   ├── flightData.ts           # Flight data processing
│   │   ├── weatherData.ts          # Weather processing
│   │   ├── missions.ts             # Mission definitions
│   │   └── achievements.ts         # Achievement system
│   └── types/
│       └── index.ts                # TypeScript types
├── public/
│   ├── textures/                   # Earth textures
│   └── models/                     # 3D models
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Phased Execution Strategy

### Phase 1: Foundation (Files: 5)
- Next.js project init with CesiumJS + TailwindCSS
- Design system (glassmorphism tokens, animations)
- CesiumJS globe with photorealistic Earth, atmosphere, day/night
- Camera system (smooth zoom, orbit, fly-to)
- Loading screen

### Phase 2: Aircraft & Satellites (Files: 6)
- Aircraft data layer with simulated + real API data
- Aircraft visualization (animated markers, trails, contrails)
- Satellite TLE parsing + orbital computation
- Satellite visualization (orbits, ground tracks)
- ISS tracker with dedicated experience
- Starlink constellation renderer

### Phase 3: Weather & Environment (Files: 3)
- Weather tile overlay (clouds, temperature)
- Wind vector animation
- City lights / aurora effects at night

### Phase 4: UI Panels & Dashboard (Files: 8)
- Sidebar navigation
- Flight detail panel
- Satellite detail panel
- ISS panel
- Weather controls
- HUD overlay
- Status bar
- Search/filter

### Phase 5: Education & Gamification (Files: 6)
- Mission framework
- 5 interactive missions (GPS, Flight Nav, SatCom, Rocket, Space)
- Simulation labs (Orbit, Flight, Weather, Rocket)
- AI Tutor with contextual knowledge
- XP/Level/Achievement system
- Progress dashboard

## Key Implementation Details

### CesiumJS Globe
- Use `Cesium.Ion` for terrain + imagery (free tier: 75k tiles/month)
- Custom atmosphere shader via Three.js overlay
- Day/night with `Cesium.SunLight`
- City lights via nighttime imagery layer

### Aircraft Tracking
- OpenSky Network REST API (free, no key needed, 10s rate limit)
- Fallback: simulated fleet of 500 aircraft with realistic routes
- Animated `Cesium.Entity` with billboard + trail polylines
- Altitude color coding (green→yellow→red)

### Satellite Visualization
- CelesTrak TLE data (free, updated daily)
- `satellite.js` for SGP4 propagation
- Animated orbit paths via `Cesium.SampledPositionProperty`
- Starlink constellation: batch render 6000+ sats with GPU instancing

### Weather
- OpenWeather tile layers (free tier: 1000 calls/day)
- Cloud cover, temperature, wind overlays
- Animated wind particles

### Educational Missions
- Self-contained interactive experiences
- Each mission: intro → tutorial → simulation → quiz → reward
- Built with React components + Framer Motion
- Orbital mechanics calculations using real physics

### AI Tutor
- Pre-built knowledge base covering aerospace topics
- Context-aware responses based on current view/selection
- 4 difficulty modes (Kids/Student/Enthusiast/Expert)
- Quiz generation from topic pool

### Gamification
- XP earned from missions, discoveries, time spent
- 7-tier progression: Cadet → Space Architect
- 50+ achievements
- Daily missions
- Streak tracking
- All persisted to localStorage

## Open Questions

> [!IMPORTANT]
> **CesiumJS Ion Token**: CesiumJS requires a free Ion access token for terrain/imagery. I'll use the default Cesium Ion assets which are free. No user action needed — I'll include a default token that works for development.

> [!WARNING]
> **API Rate Limits**: OpenSky (free) allows ~100 requests/minute. I'll implement polling at 10-second intervals with caching. For initial demo, simulated data fills gaps.

## Verification Plan

### Automated
- `npm run build` — TypeScript compilation + Next.js build
- `npm run lint` — ESLint checks

### Manual
- Launch with `npm run dev`
- Verify globe renders with atmosphere, day/night
- Verify aircraft appear and animate
- Verify satellite orbits render correctly
- Test educational missions flow
- Check gamification XP/leveling
- Confirm 60 FPS on desktop
