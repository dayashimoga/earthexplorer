# 🧠 PROJECT BRAIN — Earth Explorer

> **Single Source of Truth** | Last updated: 2026-06-24

## 1. Project Overview

**Earth Explorer** is an interactive 3D aerospace visualization and educational platform. It renders a procedurally-textured Earth with day/night shading, atmosphere, and clouds, overlaid with simulated aircraft/satellite layers, and an educational system with missions, labs, AI tutor, and gamification.

**Vision**: Google Earth + FlightRadar24 + NASA Mission Control + Interactive Aerospace Academy

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| 3D Rendering | React Three Fiber + Three.js |
| 3D Helpers | @react-three/drei |
| State | Zustand (persisted user store) |
| Animation | Framer Motion |
| Styling | TailwindCSS + globals.css design system |
| Orbital Math | satellite.js + custom lib/data.ts |
| Testing | Jest 30 + jsdom |

## 3. Architecture

```
src/
├── app/
│   ├── page.tsx          # Main page (data init, intervals, UI composition)
│   ├── layout.tsx         # Root layout
│   ├── globals.css        # Full design system (glassmorphism, panels, HUD)
│   └── api/aircraft/      # OpenSky API proxy (available but unused)
├── components/
│   ├── globe/
│   │   └── EarthScene.tsx # Core 3D scene (Earth, Aircraft, Satellites, Orbits, Footprints, Camera)
│   └── ui/
│       ├── Panels.tsx     # Sidebar, HUD, StatusBar, Flight/Satellite/ISS/Weather panels
│       ├── Education.tsx  # Missions, Labs (Orbit/Rocket/Flight/Weather), AI Tutor, Achievements
│       └── Shared.tsx     # Loading screen
├── lib/
│   └── data.ts            # Orbital mechanics, simulation data, missions, achievements, AI tutor KB
├── stores/
│   └── stores.ts          # Zustand: AppStore, FlightStore, SatelliteStore, UserStore
└── types/
    └── index.ts           # TypeScript interfaces for all entities
```

## 4. Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| Earth Rendering (day/night/atmosphere/clouds) | ✅ | Custom GLSL shaders, CDN + procedural textures |
| Aircraft Layer (400 simulated) | ✅ | Instanced 3D meshes, altitude/realistic coloring, camera-adaptive scaling, detailed airliner geometry (fuselage, wings, engines) |
| Satellite Layer (120+ simulated) | ✅ | Instanced meshes, category/realistic coloring, real-time orbital motion, detailed satellite geometry (body, solar panels, dish, mast) |
| ISS Tracking | ✅ | Live position, HTML label, dedicated panel |
| Orbit Rings (LEO/MEO/GEO) | ✅ | Line loops with labels |
| Satellite Footprints | ✅ | Spherical cap geometry for selected satellite |
| Ground Tracks | ✅ | Animated orbit prediction lines |
| Flight Routes | ✅ | Great circle arcs for selected aircraft |
| Sidebar Navigation | ✅ | 8-item nav with rank badge |
| HUD (Search + Stats) | ✅ | Universal search (flights + satellites), live counters |
| Flight Detail Panel | ✅ | Full telemetry, category filters, track on globe |
| Satellite Detail Panel | ✅ | Orbital parameters, NORAD ID, position, search filtering |
| ISS Panel | ✅ | Position, quick facts, track button |
| Weather Panel | ⚠️ | Toggle only, no globe visualization |
| Layer Toggles | ✅ | 7 toggleable layers (including Realistic Style color mode) |
| Mission System (5 missions) | ✅ | Multi-step with info/quiz/simulation, XP rewards |
| Orbit Simulator Lab | ✅ | Interactive altitude slider with physics |
| Rocket Lab | ✅ | Thrust/angle/fuel, physics simulation |
| Flight Lab | ✅ | Speed/altitude/drag/lift physics |
| Weather Lab | ✅ | Pressure/temp/humidity with weather prediction |
| AI Tutor | ✅ | 4 modes (kids→expert), keyword matching, 6 topic domains |
| Gamification (XP/Level/Rank/Streak) | ✅ | Persisted, 7 ranks, localStorage |
| Achievements (20) | ✅ | Unlockable via missions/labs/exploration |
| Loading Screen | ✅ | Cinematic animated loader |
| Earth Rotation | ✅ | Slow continuous rotation |
| Camera Controls | ✅ | OrbitControls + smooth fly-to |

## 5. Data Flow

```
Simulated Data (lib/data.ts)
    ├─> FlightStore (400 aircraft, 2s position updates)
    ├─> SatelliteStore (120+ satellites, 2s orbital updates)
    └─> UserStore (XP, rank, missions, achievements — persisted)
         │
         ├─> EarthScene (R3F Canvas) — reads stores, renders 3D
         ├─> Panels (Sidebar/HUD/Flight/Sat/ISS/Weather)
         └─> Education (Missions/Labs/Tutor/Achievements)
```

## 6. Key Design Decisions

1. **Simulated Data**: All aircraft/satellite data is generated client-side for zero-dependency operation. OpenSky API proxy exists but is not connected to the main page.
2. **Custom Shaders**: Earth uses custom GLSL vertex/fragment shaders (not drei materials) for precise day/night/atmosphere control.
3. **Instanced Rendering**: Aircraft and satellites use `InstancedMesh` for GPU-efficient rendering of 500+ objects.
4. **Camera-Adaptive Scaling**: Object sizes scale with camera distance so they remain visible at all zoom levels.
5. **Tilted Coordinate System**: All 3D objects are children of a rotation group with Earth's axial tilt applied.

## 7. Build & Run

```bash
npm install          # Install dependencies
npm run dev          # Development server (port 3000)
npm run build        # Production build
npm run test         # Run 191 tests
```

## 8. GitHub

- **Repository**: https://github.com/dayashimoga/earthexplorer.git
- **Branch**: main
