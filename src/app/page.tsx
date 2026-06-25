'use client';

import React, { useEffect, useCallback, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore, useFlightStore, useSatelliteStore, useUserStore } from '@/stores/stores';
import { generateSimulatedAircraft, generateSimulatedSatellites, updateSatellitePositions } from '@/lib/data';
import { Sidebar, HUD, StatusBar, PanelContainer } from '@/components/ui/Panels';
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
      const sats = useSatelliteStore.getState().satellites;
      const updated = updateSatellitePositions(sats, 2000);
      useSatelliteStore.getState().setSatellites(updated);

      // Update ISS position
      const iss = updated.find(s => s.category === 'iss');
      if (iss) useSatelliteStore.getState().setISSPosition({ lat: iss.latitude, lon: iss.longitude, alt: iss.altitude });

      // Slightly update aircraft positions
      const aircraft = useFlightStore.getState().aircraft;
      const updatedAircraft = aircraft.map(ac => {
        const headingRad = ac.heading * Math.PI / 180;
        const speedDeg = (ac.speed / 111320) * 2; // approximate deg per 2s update
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
  ];

  return (
    <div style={{
      position: 'fixed', bottom: 48, left: 84, zIndex: 80,
      display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 450,
    }}>
      {layers.map(l => (
        <button
          key={l.key}
          onClick={() => toggleLayer(l.key)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 500, fontFamily: 'Inter, sans-serif',
            background: l.active ? 'rgba(0, 212, 255, 0.15)' : 'rgba(15, 23, 42, 0.7)',
            color: l.active ? '#00d4ff' : '#64748b',
            backdropFilter: 'blur(12px)',
            borderWidth: 1, borderStyle: 'solid',
            borderColor: l.active ? 'rgba(0, 212, 255, 0.3)' : 'rgba(255,255,255,0.06)',
            transition: 'all 0.2s ease',
          }}
        >
          <span style={{ fontSize: 14 }}>{l.icon}</span>
          {l.label}
        </button>
      ))}
    </div>
  );
}

/* ================================================================
   UTILITY
   ================================================================ */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
