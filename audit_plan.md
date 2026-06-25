# Earth Explorer — Implementation Plan

This plan details the repository audit and step-by-step implementation strategy to upgrade Earth Explorer from a basic visualization tool into a world-class educational and real-time visualization platform.

---

# PHASE 1: REPOSITORY AUDIT

## 1. Current Implementation Report
The workspace contains a Next.js 14 frontend-first application that uses React Three Fiber (R3F) and Three.js to render a 3D Earth scene.
- **Globe Rendering**: Custom GLSL vertex/fragment shaders for day/night blending, daytime map, night lights, atmospheric back-glow, and procedural textures as cross-origin fallbacks.
- **Aircraft Layer**: GPU-instanced aircraft entities (400 items) updated every 2 seconds with simulated great-circle routes.
- **Satellite Layer**: GPU-instanced satellite entities (120+ items) representing Starlink, GPS, Galileo, GLONASS, communication, and weather satellites, using simplified Keplerian orbits.
- **ISS Experience**: Dedicated tracking showing lat/lon/alt, historical stats, and a track-on-globe button.
- **Educational Platform**: A basic academy router with 5 quiz/info missions (GPS, Flight Navigation, SatCom, Rocket Science, Space Exploration) and 4 simulation labs.
- **Zustand State**: Centralized stores for app settings (`useAppStore`), flights (`useFlightStore`), satellites (`useSatelliteStore`), and user progress (`useUserStore`).

---

## 2. Feature Completion Matrix

| Feature / System | Status | Verification Source | Notes |
|---|---|---|---|
| **Earth Globe Shaders** | ✅ Working | `src/components/globe/EarthScene.tsx` | Custom GLSL day/night shading with city lights. |
| **Atmosphere Glow** | ✅ Working | `src/components/globe/EarthScene.tsx` | Custom shader scaling. |
| **Clouds Layer** | ✅ Working | `src/components/globe/EarthScene.tsx` | Flat sphere rotation with cloud texture. |
| **Aircraft Instancing** | ✅ Working | `src/components/globe/EarthScene.tsx` | InstancedMesh rendering of 400 flights. |
| **Airlines & Routes** | ⚠️ Partial | `src/lib/data.ts`, `EarthScene.tsx` | Standard great circle arc drawn. No airlines logos, no remaining/historical path colors. |
| **Airport Visualization** | ❌ Missing | `src/lib/data.ts` | Airport coordinates exist, but no 3D labels or visual traffic circles on globe. |
| **Satellite Colors** | ⚠️ Partial | `src/components/globe/EarthScene.tsx` | Colored by category, but does not match requested color codes. |
| **Satellite Orbits** | ⚠️ Partial | `src/components/globe/EarthScene.tsx` | Equator rings exist (LEO/MEO/GEO) but no 3D path trail for individual satellites. |
| **Ground Tracks** | ✅ Working | `src/components/globe/EarthScene.tsx` | projects selected satellite's orbit future positions to Earth surface. |
| **Visibility Footprints** | ✅ Working | `src/components/globe/EarthScene.tsx` | Renders spherical cap for selected satellite. |
| **Coverage Cones** | ❌ Missing | — | No 3D sensor cones from satellites to Earth. |
| **Signal Beams** | ❌ Missing | — | No communication beams to stations. |
| **ISS Dedicated Mode** | ⚠️ Partial | `src/components/ui/Panels.tsx` | Renders facts and tracking, but lacks chase camera and prediction. |
| **Global Air Heatmap** | ❌ Missing | — | No flight density overlays or zoom-dependent modes. |
| **Weather Visualization** | ❌ Missing | `src/components/globe/EarthScene.tsx` | No weather layers are drawn on the globe. |
| **AI Tutor Integration** | ⚠️ Partial | `src/components/ui/Education.tsx` | Basic text chat with simple keyword responder; no links to 3D entities. |
| **Academy & Missions** | ⚠️ Partial | `src/components/ui/Education.tsx` | Quiz and simulator exist but are simple. |
| **Gamification Store** | ✅ Working | `src/stores/stores.ts` | Streak, level, XP, and rank work and persist to localStorage. |
| **Validation Framework** | ❌ Missing | — | No automated runner reporting performance, rendering, and logic states. |

---

## 3. Technical Debt & Performance Audit
1. **R3F Re-renders**: Every 2-second position update causes React state updates in stores, causing full re-renders of several panel overlays.
2. **Texture Dependency**: Earth textures fall back to slow CPU-generated procedural textures if CDN URLs fail or hit CORS blocks.
3. **Orbit Propagation**: Orbit positions are interpolated using simplified sine functions in `data.ts`. They should use standard Keplerian math (SGP4/SDP4 wrapper or orbital equations).
4. **Test Coverage**: R3F components (`EarthScene.tsx`) are completely excluded from Jest tests due to `jsdom` WebGL limitations. We need an automated verification framework that runs inside a real browser page (e.g. using Playwright or our browser subagent) to confirm visual rendering.
5. **No build script hook**: The `npm run test` script mentioned in `PROJECT_BRAIN.md` is missing from `package.json`.

---

## 4. Regression Protection Plan
- **Maintain Jest Suite**: The current Jest suite covers all stores, math, and data modules. We must verify that `npx jest` continues to pass 100% after every phase.
- **Lock Existing Materials**: Existing Earth shader materials, vertex shaders, and fragment shaders must be preserved, and advanced styling must be layered on top or behind toggles.
- **Feature Flags**: Add toggles (`showVolumetricClouds`, `showHeatmap`, `showAuroras`) in Zustand state so users can disable advanced visual layers if FPS drops.

---

# PROPOSED ARCHITECTURE & CHANGES

## User Review Required
> [!IMPORTANT]
> **CesiumJS vs React Three Fiber**: The initial implementation plan mentioned CesiumJS, but the codebase was actually built using React Three Fiber (R3F) and Three.js. This plan updates the implementation directly in React Three Fiber to maintain 100% compatibility with existing shaders and custom instancing meshes.
> 
> **Simulated Weather Data**: Weather layers will be simulated procedurally using Three.js shaders and particle systems to ensure zero-latency operation without needing paid OpenWeatherMap API keys.

---

## Component Upgrades

### 1. State Management (`src/stores/stores.ts`)
Add state variables for new visual features and user selections:
- `hoveredEntityId` / `hoveredEntityType`: for hover cards.
- `cameraMode`: Add `'iss-chase' | 'iss-earth'`.
- `selectedAirportCode`: For airport visual focus.
- Advanced graphics flags: `showAuroras`, `showHeatmap`, `showWindVectors`, `weatherLayerMode` (`'clouds' | 'temp' | 'pressure' | 'rain'`).

### 2. Orbital Mechanics & Data System (`src/lib/data.ts`)
- Update satellite color categorization to match:
  - GPS = Blue (includes GPS, Galileo, GLONASS, Beidou)
  - Starlink = White
  - Weather = Green (includes weather, earth-observation)
  - ISS = Orange
  - Communications = Purple
  - Science = Yellow
- Write mathematical helpers for:
  - Coverage percentage ($P = \frac{h}{2(R+h)} \times 100\%$)
  - Next pass prediction (dynamic relative to major airports/cities)
  - Flight remaining path / ETA calculations (based on origin/destination and speed)
  - Weather simulation cells (cyclones, wind flow grid)

### 3. Visual Scene Upgrade (`src/components/globe/EarthScene.tsx`)
- **Atmospheric Scattering**: Enhance `atmosphereFragmentShader` with exponential falloff and Rayleigh-like blue-to-orange gradient at the terminator.
- **Ocean Specular Reflections**: Modify `earthFragmentShader` to calculate specular highlights based on the light reflection vector and a procedural specular mask (water = shiny, land = matte).
- **Aurora Ring**: Add polar ring meshes with animated vertex shaders that morph green/purple wave patterns near poles.
- **Weather Visualization Layer**:
  - Clouds: Volumetric approximation via a secondary cloud sphere at `EARTH_RADIUS * 1.01` with cloud shadow mapping on the Earth sphere.
  - Wind flow: An instanced particle field or moving noise map showing wind direction.
  - Rain/Storm cells: Pulsing red/green procedural radar cells rotating around the globe.
  - Lightning strikes: Random line generators triggering flashes.
- **Satellite Visuals**:
  - 3D Orbit Trail: Draw a complete line loop showing the full path of the selected satellite based on its inclination and RAAN.
  - Coverage Cone: Draw a translucent double-sided cone mesh from the satellite position down to the visibility footprint.
  - Signal Beam: Pulse a thin line from the satellite to the closest airport or selected location.
- **Flight Visuals**:
  - Flight trail: Trace a fading line representing the flight's historical path.
  - Split route: Color the route arc so the completed path is solid white and the remaining path is dashed cyan.
  - Traffic Heatmap: Implement a global density texture or instanced grid points that scale size based on local flight density.
  - Zoom scaling: Adjust aircraft scaling and route opacity dynamically based on camera distance (hide plane meshes when zoomed far out and replace with glowing corridors or clusters).
- **Hover Raycasting**: Bind mouse-move events to R3F's raycaster to detect when hovering over aircraft or satellites and update Zustand store.

### 4. Panels & UI HUD (`src/components/ui/Panels.tsx`)
- **Hover Tooltips**: Render an HTML tooltip at mouse position when `hoveredEntityId` is set.
- **Enhanced Satellite Details**: Add coverage %, orbital velocity, ground track path toggle, next pass countdown.
- **Enhanced Flight Details**: Add ETA, remaining distance, airline logo placeholder, progress bar.
- **Airport Panel**: Add a detail panel showing departures, arrivals, and local airport traffic statistics.
- **Weather Panel**: Add buttons to switch weather maps (clouds, temperature, pressure, wind animation).

### 5. Interactive Academy & Labs (`src/components/ui/Education.tsx`)
- **Interactive Academy**: Create structured, scrollable visual modules for:
  - Navigation (great-circles, jet streams)
  - Space Exploration (escape velocity, orbits)
  - Communications (latency, satellite bands)
- **AI Tutor Globe Sync**: Let the AI Tutor inject special commands into the store. For example, if the AI says *"The ISS orbits at 420km"*, it automatically focuses the camera on the ISS and displays its coverage cone!
- **Enhanced Labs**:
  - **Orbit Lab**: Add inclination and eccentric orbit sliders.
  - **Flight Lab**: Add a 2D canvas plotting Lift vs. Drag curves dynamically.
  - **Weather Lab**: Add storm builder inputs (sea temp, pressure gradient) to trigger a simulated cyclone on the 3D globe!
  - **Rocket Lab**: Visualize stage separation and orbit trajectory plotting in real-time.

### 6. Automated Validation Framework (`src/app/validation/page.tsx` & script)
- Create a dedicated dashboard page at `/validation` that performs automated checks:
  - Check WebGL capabilities and FPS targets (over a 10s benchmark).
  - Verify that Earth, aircraft, and satellite instanced meshes are present in the Three.js scene.
  - Verify state stores have correct counts and user progress behaves correctly.
  - Output results as a downloadable JSON validation report.

---

# PROPOSED CHANGES BY FILE

#### [MODIFY] [index.ts](file:///j:/aircraft_satellite/src/types/index.ts)
Add types for hover states, airport telemetry, weather maps, and AI tutor globe hooks.

#### [MODIFY] [stores.ts](file:///j:/aircraft_satellite/src/stores/stores.ts)
Add states for weather overlays, airport selections, hover entities, ISS camera modes, and graph settings.

#### [MODIFY] [data.ts](file:///j:/aircraft_satellite/src/lib/data.ts)
Upgrade orbital physics, add weather mapping logic, configure category color overrides, and implement academy content.

#### [MODIFY] [EarthScene.tsx](file:///j:/aircraft_satellite/src/components/globe/EarthScene.tsx)
Build 3D weather particle layers, specular ocean reflections, aurora overlays, satellite coverage cones, signal beams, split flight paths, and hover raycasting.

#### [MODIFY] [Panels.tsx](file:///j:/aircraft_satellite/src/components/ui/Panels.tsx)
Integrate hover tooltips, new Airport panel, and enhanced telemetry details.

#### [MODIFY] [Education.tsx](file:///j:/aircraft_satellite/src/components/ui/Education.tsx)
Expand lab simulation details, connect AI Tutor explanations to globe camera shifts, and build academy modules.

#### [MODIFY] [globals.css](file:///j:/aircraft_satellite/src/app/globals.css)
Style hover cards, airport markers, and validation grids.

#### [MODIFY] [page.tsx](file:///j:/aircraft_satellite/src/app/page.tsx)
Add page controllers, data polling, and reference the new validation script.

#### [NEW] [package.json](file:///j:/aircraft_satellite/package.json)
Add `"test"` script command mapping to Jest.

#### [NEW] [validation/page.tsx](file:///j:/aircraft_satellite/src/app/validation/page.tsx)
Automated visual/logical verification framework interface.

---

# VERIFICATION PLAN

### Automated Tests
Run tests before, during, and after coding:
```bash
# Run existing tests to ensure no regressions
npx jest

# Build next.js to verify TypeScript compilation and Next compiler assets
npm run build
```

### Manual Verification
1. Open http://localhost:3000/ in the browser.
2. Confirm the 3D globe displays day/night cycles, glowing city lights, and reflective oceans.
3. Select a satellite and verify that a 3D coverage cone and orbital trail render around the globe.
4. Toggle different weather overlays (clouds, temperature, wind) and observe the procedural particles and colors.
5. Search for a city/airport, verify fly-to camera focus, and click to view airport traffic.
6. Open the AI Tutor, enter "tell me about orbits", and check if the camera focuses on a satellite.
7. Open `/validation` and verify that all system audits pass.
