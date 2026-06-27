'use client';

import React, { useEffect, useCallback, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore, useFlightStore, useSatelliteStore, useUserStore } from '@/stores/stores';
import { generateSimulatedAircraft, generateSimulatedSatellites, updateSatellitePositions, AIRPORTS } from '@/lib/data';
import { Sidebar, HUD, StatusBar, PanelContainer, SimulationControls } from '@/components/ui/Panels';
import { EducationPanelRouter } from '@/components/ui/Education';
import { LoadingScreen } from '@/components/ui/Shared';

// Dynamic import for Three.js globe (no SSR)
const EarthScene = lazy(() => import('@/components/globe/EarthScene'));

/* ================================================================
   MAIN PAGE
   ================================================================ */
export default function EarthExplorerPage() {
  const loaded = useAppStore(s => s.loaded);
  const setLoaded = useAppStore(s => s.setLoaded);
  const setLoadProgress = useAppStore(s => s.setLoadProgress);
  const setAircraft = useFlightStore(s => s.setAircraft);
  const setSatellites = useSatelliteStore(s => s.setSatellites);
  const setISSPosition = useSatelliteStore(s => s.setISSPosition);
  const updateStreak = useUserStore(s => s.updateStreak);
  const activePanel = useAppStore(s => s.activePanel);

  // Initialize data
  const initializeData = useCallback(async () => {
    // Simulate loading progress
    setLoadProgress(10);
    await sleep(300);
    setLoadProgress(25);

    // Generate aircraft
    const aircraft = generateSimulatedAircraft(400);
    setAircraft(aircraft);
    setLoadProgress(50);
    await sleep(300);

    // Generate satellites
    const satellites = generateSimulatedSatellites();
    setSatellites(satellites);
    setLoadProgress(75);
    await sleep(300);

    // Set ISS position
    const iss = satellites.find(s => s.category === 'iss');
    if (iss) setISSPosition({ lat: iss.latitude, lon: iss.longitude, alt: iss.altitude });

    setLoadProgress(95);
    await sleep(500);
    setLoadProgress(100);
    await sleep(300);

    // Update user streak
    updateStreak();

    setLoaded(true);
  }, [setLoaded, setLoadProgress, setAircraft, setSatellites, setISSPosition, updateStreak]);

  useEffect(() => {
    initializeData();
  }, [initializeData]);

  // Update satellite positions every 2 seconds
  useEffect(() => {
    if (!loaded) return;
    const interval = setInterval(() => {
      const state = useAppStore.getState();
      if (state.isPaused) return;

      const timeScale = state.timeScale;
      // If realtime, keep simulatedTime in sync with actual clock
      if (state.isRealtimeData) {
        useAppStore.setState({ simulatedTime: Date.now() / 1000 });
      }
      const currentSimTime = useAppStore.getState().simulatedTime;

      const sats = useSatelliteStore.getState().satellites;
      const updated = updateSatellitePositions(sats, 2000 * timeScale, currentSimTime);
      useSatelliteStore.getState().setSatellites(updated);

      // Update ISS position
      const iss = updated.find(s => s.category === 'iss');
      if (iss) useSatelliteStore.getState().setISSPosition({ lat: iss.latitude, lon: iss.longitude, alt: iss.altitude });

      // Slightly update aircraft positions
      const aircraft = useFlightStore.getState().aircraft;
      const updatedAircraft = aircraft.map(ac => {
        const headingRad = ac.heading * Math.PI / 180;
        const speedDeg = (ac.speed / 111320) * 2 * timeScale; // approximate deg per 2s update scaled
        const cosLat = Math.cos(ac.latitude * Math.PI / 180);
        let newLat = ac.latitude + Math.cos(headingRad) * speedDeg;
        let newLon = ac.longitude + Math.sin(headingRad) * speedDeg / (cosLat > 0.1 ? cosLat : 1.0);
        
        // Wrap coordinates
        if (newLon > 180) newLon -= 360;
        if (newLon < -180) newLon += 360;
        if (newLat > 85) newLat = 85; // clamp to standard flight ceiling
        if (newLat < -85) newLat = -85;
        
        return {
          ...ac,
          latitude: newLat,
          longitude: newLon,
          lastUpdate: Date.now(),
        };
      });
      useFlightStore.getState().setAircraft(updatedAircraft);
    }, 2000);

    return () => clearInterval(interval);
  }, [loaded]);

  const isRealtimeData = useAppStore(s => s.isRealtimeData);

  // Poll real-time flight data when isRealtimeData is enabled
  useEffect(() => {
    if (!loaded) return;
    if (!isRealtimeData) {
      // Re-initialize with simulated flights if disabled
      const aircraft = generateSimulatedAircraft(400);
      setAircraft(aircraft);
      return;
    }

    let active = true;
    const fetchRealtimeFlights = async () => {
      try {
        const res = await fetch('/api/aircraft');
        if (!res.ok) throw new Error('Failed to fetch realtime flight data');
        const data = await res.json();
        
        if (!active) return;
        
        if (data && Array.isArray(data.states)) {
          const mapped = data.states
            .filter((state: any) => state[5] !== null && state[6] !== null) // valid lat/lon
            .slice(0, 400) // limit count
            .map((state: any) => {
              const icao24 = state[0];
              const callsign = state[1]?.trim() || `AC${icao24.toUpperCase()}`;
              const altitude = state[7] || state[13] || 10000;
              const speed = state[9] || 250;
              const heading = state[10] || 0;
              
              // Seed airport origins and destinations procedurally since OpenSky only returns positions
              const seed = icao24.charCodeAt(0) + icao24.charCodeAt(1);
              const airportKeys = Object.keys(AIRPORTS);
              const originKey = airportKeys[seed % airportKeys.length];
              const destKey = airportKeys[(seed + 7) % airportKeys.length];
              const origin = AIRPORTS[originKey];
              const dest = AIRPORTS[destKey];

              return {
                id: icao24,
                callsign,
                flightNumber: callsign,
                airline: getAirlineNameFromICAO(callsign.substring(0, 3)),
                origin: `${originKey} - ${origin.name}`,
                destination: `${destKey} - ${dest.name}`,
                latitude: state[6],
                longitude: state[5],
                altitude,
                speed,
                heading,
                verticalRate: state[11] || 0,
                aircraftType: 'Commercial',
                category: 'commercial',
                onGround: state[8] || false,
                lastUpdate: Date.now(),
                trail: [],
              };
            });

          if (mapped.length > 0) {
            setAircraft(mapped);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchRealtimeFlights();
    const pollInterval = setInterval(fetchRealtimeFlights, 15000);

    return () => {
      active = false;
      clearInterval(pollInterval);
    };
  }, [loaded, isRealtimeData, setAircraft]);

  const isEducationPanel = ['missions', 'labs', 'academy', 'achievements'].includes(activePanel);

  return (
    <main style={{ width: '100%', height: '100vh', position: 'relative', overflow: 'hidden', background: '#000008' }}>
      {/* Loading Screen */}
      <LoadingScreen />

      {/* 3D Globe */}
      {loaded && (
        <Suspense fallback={
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 14 }}>
            Initializing WebGL...
          </div>
        }>
          <EarthScene />
        </Suspense>
      )}

      {/* UI Overlay */}
      {loaded && (
        <>
          {/* Sidebar Navigation */}
          <Sidebar />

          {/* HUD Top Bar */}
          <HUD />

          {/* Simulation Playback Controls */}
          <SimulationControls />

          {/* Data Panels (flights, satellites, ISS, weather) */}
          <PanelContainer />

          {/* Education Panels (missions, labs, academy, achievements) */}
          <AnimatePresence>
            {isEducationPanel && (
              <motion.div
                className="panel"
                initial={{ x: 420, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 420, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              >
                <EducationPanelRouter panel={activePanel} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Status Bar */}
          <StatusBar />

          {/* Layer toggle shortcuts */}
          <LayerToggles />
        </>
      )}
    </main>
  );
}

/* ================================================================
   LAYER TOGGLES (bottom left)
   ================================================================ */
function LayerToggles() {
  const toggleLayer = useAppStore(s => s.toggleLayer);
  const showFlights = useAppStore(s => s.showFlights);
  const showSatellites = useAppStore(s => s.showSatellites);
  const showStarlink = useAppStore(s => s.showStarlink);
  const showISS = useAppStore(s => s.showISS);
  const showOrbits = useAppStore(s => s.showOrbits);
  const showWeather = useAppStore(s => s.showWeather);
  const realisticColors = useAppStore(s => s.realisticColors);
  const showAuroras = useAppStore(s => s.showAuroras);
  const showHeatmap = useAppStore(s => s.showHeatmap);
  const isRealtimeData = useAppStore(s => s.isRealtimeData);

  const [isOpen, setIsOpen] = React.useState(false);

  const layers = [
    { key: 'showFlights', label: 'Flights', icon: '✈️', active: showFlights },
    { key: 'showSatellites', label: 'Satellites', icon: '🛰️', active: showSatellites },
    { key: 'showStarlink', label: 'Starlink', icon: '⭐', active: showStarlink },
    { key: 'showISS', label: 'ISS', icon: '🏠', active: showISS },
    { key: 'showOrbits', label: 'Orbits', icon: '⭕', active: showOrbits },
    { key: 'showWeather', label: 'Weather', icon: '☁️', active: showWeather },
    { key: 'showAuroras', label: 'Auroras', icon: '🌌', active: showAuroras },
    { key: 'showHeatmap', label: 'Heatmap', icon: '🔥', active: showHeatmap },
    { key: 'realisticColors', label: 'Realistic Style', icon: '🎨', active: realisticColors },
    { key: 'isRealtimeData', label: 'Realtime Data', icon: '📡', active: isRealtimeData },
  ];

  // Auto close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const clickAway = () => setIsOpen(false);
    window.addEventListener('click', clickAway);
    return () => window.removeEventListener('click', clickAway);
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
        style={{
          position: 'fixed', bottom: 48, left: 84, zIndex: 80,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', borderRadius: 14, cursor: 'pointer',
          fontSize: 13, fontWeight: 700, fontFamily: 'Inter, sans-serif',
          background: 'rgba(15, 23, 42, 0.85)', color: '#00d4ff',
          backdropFilter: 'blur(20px)', border: '1px solid rgba(0, 212, 255, 0.3)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)', transition: 'all 0.2s ease',
        }}
        className="layers-toggle-btn"
      >
        <span style={{ fontSize: 16 }}>🥞</span>
        <span>Layers</span>
      </button>
    );
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', bottom: 48, left: 84, zIndex: 85,
        display: 'flex', flexDirection: 'column', gap: 10,
        padding: 16, borderRadius: 16, maxWidth: 360, width: 'calc(100% - 100px)',
        background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
        animation: 'fadeIn 0.2s ease-out',
      }}
      className="layers-popover"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>🗺️ Map Layers</span>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: 'transparent', border: 'none', color: '#94a3b8',
            cursor: 'pointer', fontSize: 14, fontWeight: 700, padding: 4
          }}
        >✕</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {layers.map(l => (
          <button
            key={l.key}
            onClick={() => toggleLayer(l.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 500, fontFamily: 'Inter, sans-serif',
              background: l.active ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255, 255, 255, 0.02)',
              color: l.active ? '#00d4ff' : '#94a3b8',
              borderWidth: 1, borderStyle: 'solid',
              borderColor: l.active ? 'rgba(0, 212, 255, 0.3)' : 'rgba(255,255,255,0.04)',
              transition: 'all 0.2s ease',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 13 }}>{l.icon}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   UTILITY
   ================================================================ */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getAirlineNameFromICAO(icao: string): string {
  const mapping: Record<string, string> = {
    AAL: 'American Airlines',
    BAW: 'British Airways',
    DLH: 'Lufthansa',
    UAE: 'Emirates',
    SIA: 'Singapore Airlines',
    QFA: 'Qantas',
    ANA: 'ANA',
    AFR: 'Air France',
    CPA: 'Cathay Pacific',
    JAL: 'Japan Airlines',
    FDX: 'FedEx',
    UPS: 'UPS Airlines',
    GTI: 'Atlas Air',
    NJE: 'NetJets',
    VJT: 'VistaJet',
  };
  return mapping[icao.toUpperCase()] || 'Commercial Flight';
}
