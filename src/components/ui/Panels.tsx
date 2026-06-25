'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, useFlightStore, useSatelliteStore, useUserStore } from '@/stores/stores';
import { calculateCoverage, getNextPassTime, generateAirportTraffic, latLonToVec3, AIRPORTS } from '@/lib/data';
import type { ActivePanel, Aircraft, Satellite } from '@/types';
import * as THREE from 'three';

/* ================================================================
   ICONS (SVG inline for zero dependencies)
   ================================================================ */
const icons: Record<string, string> = {
  earth: '🌍', flights: '✈️', satellites: '🛰️', iss: '🏠',
  weather: '🌦️', missions: '🎯', labs: '🔬', academy: '📚',
  achievements: '🏆', close: '✕', search: '🔍', settings: '⚙️',
};

/* ================================================================
   SIDEBAR
   ================================================================ */
export function Sidebar() {
  const activePanel = useAppStore(s => s.activePanel);
  const setActivePanel = useAppStore(s => s.setActivePanel);
  const userRank = useUserStore(s => s.rank);

  const navItems: { id: ActivePanel; icon: string; label: string }[] = [
    { id: 'flights', icon: icons.flights, label: 'Flights' },
    { id: 'satellites', icon: icons.satellites, label: 'Satellites' },
    { id: 'iss', icon: icons.iss, label: 'ISS' },
    { id: 'weather', icon: icons.weather, label: 'Weather' },
    { id: 'missions', icon: icons.missions, label: 'Missions' },
    { id: 'labs', icon: icons.labs, label: 'Labs' },
    { id: 'academy', icon: icons.academy, label: 'Academy' },
    { id: 'achievements', icon: icons.achievements, label: 'Achievements' },
  ];

  return (
    <nav className="sidebar">
      <div className="sidebar-logo" title="Earth Explorer">E</div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, width: '100%', alignItems: 'center', paddingTop: 8 }}>
        {navItems.map(item => (
          <button
            key={item.id}
            className={`sidebar-btn ${activePanel === item.id ? 'active' : ''}`}
            onClick={() => setActivePanel(item.id)}
            title={item.label}
          >
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span className="tooltip">{item.label}</span>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
        <div className="rank-badge" style={{ fontSize: 10, padding: '3px 8px', flexDirection: 'column', gap: 2 }}>
          <span>⭐</span>
          <span style={{ fontSize: 8, whiteSpace: 'nowrap' }}>{userRank}</span>
        </div>
      </div>
    </nav>
  );
}

/* ================================================================
   HUD (TOP BAR)
   ================================================================ */
export function HUD() {
  const aircraft = useFlightStore(s => s.aircraft);
  const satellites = useSatelliteStore(s => s.satellites);
  const searchQuery = useAppStore(s => s.searchQuery);
  const setSearchQuery = useAppStore(s => s.setSearchQuery);
  const setActivePanel = useAppStore(s => s.setActivePanel);
  const activePanel = useAppStore(s => s.activePanel);
  const userXP = useUserStore(s => s.xp);
  const userLevel = useUserStore(s => s.level);
  const streak = useUserStore(s => s.streak);

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (q.length >= 2) {
      const ql = q.toLowerCase();
      
      // Match airports first
      const airportMatch = Object.keys(AIRPORTS).find(code =>
        code.toLowerCase().includes(ql) || AIRPORTS[code].name.toLowerCase().includes(ql)
      );
      if (airportMatch) {
        useAppStore.getState().selectAirport(airportMatch);
        useAppStore.getState().setViewTarget({ lat: AIRPORTS[airportMatch].lat, lon: AIRPORTS[airportMatch].lon, entityId: airportMatch, entityType: 'airport' });
        return;
      }

      const flightMatch = aircraft.some(a =>
        a.callsign.toLowerCase().includes(ql) || a.airline.toLowerCase().includes(ql) ||
        a.flightNumber.toLowerCase().includes(ql) || a.origin.toLowerCase().includes(ql) ||
        a.destination.toLowerCase().includes(ql)
      );
      const satMatch = satellites.some(s =>
        s.name.toLowerCase().includes(ql) || s.category.toLowerCase().includes(ql) ||
        s.id.toLowerCase().includes(ql)
      );
      if (flightMatch && activePanel !== 'flights') setActivePanel('flights');
      else if (satMatch && !flightMatch && activePanel !== 'satellites') setActivePanel('satellites');
    }
  };

  return (
    <div className="hud-top">
      <input
        className="hud-search"
        placeholder="Search flights, satellites, locations..."
        value={searchQuery}
        onChange={e => handleSearch(e.target.value)}
      />
      <div className="hud-badge" style={{ color: '#00d4ff' }}>
        <span>✈️</span> {aircraft.length}
      </div>
      <div className="hud-badge" style={{ color: '#7c3aed' }}>
        <span>🛰️</span> {satellites.length}
      </div>
      <div className="hud-badge" style={{ color: '#f59e0b' }}>
        <span>⭐</span> L{userLevel}
      </div>
      <div className="hud-badge" style={{ color: '#10b981' }}>
        <span>🔥</span> {streak}d
      </div>
      <div className="hud-badge" style={{ color: '#00d4ff' }}>
        <span style={{ fontSize: 11 }}>XP</span> {userXP.toLocaleString()}
      </div>
    </div>
  );
}

/* ================================================================
   STATUS BAR (BOTTOM)
   ================================================================ */
export function StatusBar() {
  const aircraft = useFlightStore(s => s.aircraft);
  const satellites = useSatelliteStore(s => s.satellites);
  const [time, setTime] = useState(new Date());

  React.useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="status-bar">
      <div style={{ display: 'flex', gap: 20 }}>
        <span>UTC {time.toUTCString().slice(17, 25)}</span>
        <span>{aircraft.length} aircraft</span>
        <span>{satellites.length} satellites</span>
      </div>
      <div style={{ display: 'flex', gap: 20 }}>
        <span>WebGL2</span>
        <span>60 FPS</span>
        <span>Earth Explorer v1.0</span>
      </div>
    </div>
  );
}

/* ================================================================
   FLIGHT PANEL
   ================================================================ */
function FlightPanel() {
  const aircraft = useFlightStore(s => s.aircraft);
  const selectedId = useAppStore(s => s.selectedAircraftId);
  const selectAircraft = useAppStore(s => s.selectAircraft);
  const setViewTarget = useAppStore(s => s.setViewTarget);
  const searchQuery = useAppStore(s => s.searchQuery);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const selectedAircraft = useMemo(() =>
    aircraft.find(a => a.id === selectedId), [aircraft, selectedId]);

  const filteredAircraft = useMemo(() => {
    let filtered = aircraft;
    if (filterCategory !== 'all') filtered = filtered.filter(a => a.category === filterCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        a.callsign.toLowerCase().includes(q) ||
        a.airline.toLowerCase().includes(q) ||
        a.flightNumber.toLowerCase().includes(q) ||
        a.origin.toLowerCase().includes(q) ||
        a.destination.toLowerCase().includes(q)
      );
    }
    return filtered.slice(0, 50);
  }, [aircraft, filterCategory, searchQuery]);

  if (selectedAircraft) {
    return (
      <div>
        <div className="panel-header">
          <div className="panel-title">✈️ Flight Details</div>
          <button className="btn-icon" onClick={() => selectAircraft(null)}>{icons.close}</button>
        </div>

        <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Outfit', color: '#00d4ff' }}>
                {selectedAircraft.flightNumber}
              </div>
              <div style={{ fontSize: 14, color: '#94a3b8' }}>{selectedAircraft.airline}</div>
            </div>
            <div className="rank-badge">{selectedAircraft.aircraftType}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{selectedAircraft.origin.split(' - ')[0]}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>{selectedAircraft.origin.split(' - ')[1]}</div>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '0 16px' }}>
              <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.15)' }} />
              <span style={{ fontSize: 16 }}>✈️</span>
              <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.15)' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{selectedAircraft.destination.split(' - ')[0]}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>{selectedAircraft.destination.split(' - ')[1]}</div>
            </div>
          </div>
        </div>

        {(() => {
          const originCode = selectedAircraft.origin.substring(0, 3);
          const destCode = selectedAircraft.destination.substring(0, 3);
          const originAirport = AIRPORTS[originCode];
          const destAirport = AIRPORTS[destCode];
          let remainingDistKm = 0;
          let remainingMinutes = 0;
          let progressPct = 0;
          if (originAirport && destAirport) {
            const p1 = latLonToVec3(selectedAircraft.latitude, selectedAircraft.longitude, 6371);
            const p2 = latLonToVec3(destAirport.lat, destAirport.lon, 6371);
            remainingDistKm = Math.round(new THREE.Vector3(...p1).distanceTo(new THREE.Vector3(...p2)));
            remainingMinutes = Math.round(remainingDistKm / (selectedAircraft.speed * 0.06));
            const totalDist = Math.round(new THREE.Vector3(...latLonToVec3(originAirport.lat, originAirport.lon, 6371)).distanceTo(new THREE.Vector3(...latLonToVec3(destAirport.lat, destAirport.lon, 6371))));
            progressPct = Math.max(0, Math.min(100, Math.round(((totalDist - remainingDistKm) / totalDist) * 100)));
          }

          return (
            <div className="glass-card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
                <span>Remaining: {remainingDistKm} km</span>
                <span>ETA: {remainingMinutes} mins</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          );
        })()}

        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-value">{Math.round(selectedAircraft.altitude).toLocaleString()}</div>
            <div className="stat-label">Altitude (m)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{Math.round(selectedAircraft.speed * 3.6)}</div>
            <div className="stat-label">Speed (km/h)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{Math.round(selectedAircraft.heading)}°</div>
            <div className="stat-label">Heading</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{selectedAircraft.verticalRate > 0 ? '↑' : selectedAircraft.verticalRate < 0 ? '↓' : '—'}</div>
            <div className="stat-label">V/S</div>
          </div>
        </div>

        <div className="stat-grid" style={{ gridTemplateColumns: '1fr' }}>
          <div className="stat-card" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div><div className="stat-label">Callsign</div><div style={{ fontSize: 15, fontWeight: 600, fontFamily: 'JetBrains Mono' }}>{selectedAircraft.callsign}</div></div>
            <div style={{ textAlign: 'right' }}><div className="stat-label">Category</div><div style={{ fontSize: 15, fontWeight: 600, textTransform: 'capitalize' }}>{selectedAircraft.category}</div></div>
          </div>
        </div>

        <button className="btn-primary" style={{ width: '100%', marginTop: 16 }}
          onClick={() => setViewTarget({ lat: selectedAircraft.latitude, lon: selectedAircraft.longitude, entityId: selectedAircraft.id, entityType: 'aircraft' })}>
          🎯 Track on Globe
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="panel-header">
        <div className="panel-title">✈️ Live Flights</div>
        <div style={{ fontSize: 13, color: '#94a3b8' }}>{aircraft.length} active</div>
      </div>

      <div className="tab-bar">
        {['all', 'commercial', 'cargo', 'business'].map(cat => (
          <button key={cat} className={`tab-btn ${filterCategory === cat ? 'active' : ''}`}
            onClick={() => setFilterCategory(cat)}>
            {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredAircraft.map(ac => (
          <div key={ac.id} className="mission-card" onClick={() => {
            selectAircraft(ac.id);
            setViewTarget({ lat: ac.latitude, lon: ac.longitude, entityId: ac.id, entityType: 'aircraft' });
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'JetBrains Mono', color: '#00d4ff' }}>{ac.callsign}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{ac.airline} · {ac.aircraftType}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'JetBrains Mono' }}>FL{Math.round(ac.altitude * 3.28084 / 100)}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{Math.round(ac.speed * 3.6)} km/h</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
              {ac.origin.split(' - ')[0]} → {ac.destination.split(' - ')[0]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   SATELLITE CATEGORY STYLES
   ================================================================ */
const categoryColors: Record<string, string> = {
  gps: '#3b82f6', // Blue
  galileo: '#3b82f6', // Blue
  glonass: '#3b82f6', // Blue
  beidou: '#3b82f6', // Blue
  starlink: '#ffffff', // White
  weather: '#10b981', // Green
  'earth-observation': '#10b981', // Green
  iss: '#f97316', // Orange
  'space-station': '#f97316', // Orange
  communication: '#8b5cf6', // Purple
  scientific: '#eab308', // Yellow
};

function hexToRgb(hex: string): string {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return `${r}, ${g}, ${b}`;
  }
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function getCategoryBadgeStyle(category: string) {
  const color = categoryColors[category] || '#94a3b8';
  return {
    background: `rgba(${hexToRgb(color)}, 0.15)`,
    borderColor: color,
    color: color
  };
}

/* ================================================================
   SATELLITE PANEL
   ================================================================ */
function SatellitePanel() {
  const satellites = useSatelliteStore(s => s.satellites);
  const selectedId = useAppStore(s => s.selectedSatelliteId);
  const selectSatellite = useAppStore(s => s.selectSatellite);
  const setViewTarget = useAppStore(s => s.setViewTarget);
  const toggleLayer = useAppStore(s => s.toggleLayer);
  const showStarlink = useAppStore(s => s.showStarlink);
  const searchQuery = useAppStore(s => s.searchQuery);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const selectedSat = useMemo(() =>
    satellites.find(s => s.id === selectedId), [satellites, selectedId]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    satellites.forEach(s => { counts[s.category] = (counts[s.category] || 0) + 1; });
    return counts;
  }, [satellites]);

  const filtered = useMemo(() => {
    let f = satellites;
    if (filterCategory !== 'all') f = f.filter(s => s.category === filterCategory);
    if (searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase();
      f = f.filter(s => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.orbitType.toLowerCase().includes(q));
    }
    return f.slice(0, 50);
  }, [satellites, filterCategory, searchQuery]);

  if (selectedSat) {
    return (
      <div>
        <div className="panel-header">
          <div className="panel-title">🛰️ Satellite Details</div>
          <button className="btn-icon" onClick={() => selectSatellite(null)}>{icons.close}</button>
        </div>

        <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Outfit', color: categoryColors[selectedSat.category] || '#7c3aed', marginBottom: 4 }}>{selectedSat.name}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <span className="rank-badge">{selectedSat.orbitType}</span>
            <span className="rank-badge" style={{ background: 'rgba(124,58,237,0.15)', borderColor: 'rgba(124,58,237,0.3)', color: '#7c3aed' }}>
              NORAD {selectedSat.noradId}
            </span>
            <span className="rank-badge" style={getCategoryBadgeStyle(selectedSat.category)}>
              {selectedSat.category.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#7c3aed' }}>{Math.round(selectedSat.altitude).toLocaleString()}</div>
            <div className="stat-label">Altitude (km)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#7c3aed' }}>{selectedSat.speed.toFixed(2)}</div>
            <div className="stat-label">Speed (km/s)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#7c3aed' }}>{selectedSat.inclination.toFixed(1)}°</div>
            <div className="stat-label">Inclination</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#7c3aed' }}>{Math.round(selectedSat.period)}</div>
            <div className="stat-label">Period (min)</div>
          </div>
        </div>

        <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#7c3aed', fontSize: 18 }}>{calculateCoverage(selectedSat.altitude).toFixed(1)}%</div>
            <div className="stat-label">Coverage</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#7c3aed', fontSize: 18 }}>{getNextPassTime(selectedSat.id, 'JFK')}</div>
            <div className="stat-label">Next Pass (JFK)</div>
          </div>
        </div>

        <div className="stat-grid" style={{ gridTemplateColumns: '1fr' }}>
          <div className="stat-card">
            <div className="stat-label">Position</div>
            <div style={{ fontSize: 14, fontFamily: 'JetBrains Mono', fontWeight: 600, marginTop: 4 }}>
              {selectedSat.latitude.toFixed(4)}° N, {selectedSat.longitude.toFixed(4)}° E
            </div>
          </div>
        </div>

        <button className="btn-primary" style={{ width: '100%', marginTop: 16 }}
          onClick={() => setViewTarget({ lat: selectedSat.latitude, lon: selectedSat.longitude, entityId: selectedSat.id, entityType: 'satellite' })}>
          🎯 Track on Globe
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="panel-header">
        <div className="panel-title">🛰️ Satellites</div>
        <div style={{ fontSize: 13, color: '#94a3b8' }}>{satellites.length} tracked</div>
      </div>

      {/* Category overview */}
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        {Object.entries(categoryCounts).slice(0, 6).map(([cat, count]) => (
          <div key={cat} className="stat-card" style={{ cursor: 'pointer', ...getCategoryBadgeStyle(cat) }} onClick={() => setFilterCategory(cat)}>
            <div className="stat-value" style={{ fontSize: 20, color: 'inherit' }}>{count}</div>
            <div className="stat-label" style={{ color: 'inherit' }}>{cat}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`btn-secondary ${showStarlink ? '' : 'active'}`} style={{ flex: 1, fontSize: 12 }}
          onClick={() => toggleLayer('showStarlink')}>
          {showStarlink ? '🟢' : '⚫'} Starlink ({categoryCounts.starlink || 0})
        </button>
      </div>

      <div className="tab-bar">
        {['all', 'gps', 'communication', 'weather', 'scientific'].map(cat => (
          <button key={cat} className={`tab-btn ${filterCategory === cat ? 'active' : ''}`}
            onClick={() => setFilterCategory(cat)} style={{ fontSize: 11 }}>
            {cat === 'all' ? 'All' : cat.slice(0, 6)}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(sat => (
          <div key={sat.id} className="mission-card" onClick={() => {
            selectSatellite(sat.id);
            setViewTarget({ lat: sat.latitude, lon: sat.longitude, entityId: sat.id, entityType: 'satellite' });
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: categoryColors[sat.category] || '#7c3aed' }}>{sat.name}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{sat.orbitType} · {Math.round(sat.altitude).toLocaleString()} km</div>
              </div>
              <span className="rank-badge" style={getCategoryBadgeStyle(sat.category)}>{sat.category}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   ISS PANEL
   ================================================================ */
function ISSPanel() {
  const issPos = useSatelliteStore(s => s.issPosition);
  const satellites = useSatelliteStore(s => s.satellites);
  const setViewTarget = useAppStore(s => s.setViewTarget);
  const cameraMode = useAppStore(s => s.cameraMode);
  const setCameraMode = useAppStore(s => s.setCameraMode);

  const iss = useMemo(() => satellites.find(s => s.category === 'iss'), [satellites]);

  return (
    <div>
      <div className="panel-header">
        <div className="panel-title">🏠 ISS Live</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
          <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>LIVE</span>
        </div>
      </div>

      <div className="glass-card" style={{ padding: 24, marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🛸</div>
        <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit', background: 'linear-gradient(135deg, #ff6b35, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          International Space Station
        </div>
        <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
          Continuously crewed since November 2, 2000
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={`btn-secondary ${cameraMode === 'iss-chase' ? 'active' : ''}`}
          style={{ flex: 1, fontSize: 12 }}
          onClick={() => setCameraMode('iss-chase')}
        >
          🎥 Chase Cam
        </button>
        <button
          className={`btn-secondary ${cameraMode === 'iss-earth' ? 'active' : ''}`}
          style={{ flex: 1, fontSize: 12 }}
          onClick={() => setCameraMode('iss-earth')}
        >
          🌍 Earth View
        </button>
        <button
          className={`btn-secondary ${cameraMode === 'orbit' || (cameraMode !== 'iss-chase' && cameraMode !== 'iss-earth') ? 'active' : ''}`}
          style={{ flex: 1, fontSize: 12 }}
          onClick={() => setCameraMode('orbit')}
        >
          🔄 Orbit Cam
        </button>
      </div>

      {issPos && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#ff6b35' }}>{issPos.lat.toFixed(2)}°</div>
            <div className="stat-label">Latitude</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#ff6b35' }}>{issPos.lon.toFixed(2)}°</div>
            <div className="stat-label">Longitude</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#ff6b35' }}>~420</div>
            <div className="stat-label">Altitude (km)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#ff6b35' }}>7.66</div>
            <div className="stat-label">Speed (km/s)</div>
          </div>
        </div>
      )}

      <div className="glass-card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>📊 Quick Facts</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: '#94a3b8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Orbital Period</span><span style={{ color: '#f1f5f9', fontFamily: 'JetBrains Mono' }}>~92 min</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Orbits/Day</span><span style={{ color: '#f1f5f9', fontFamily: 'JetBrains Mono' }}>~15.5</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Inclination</span><span style={{ color: '#f1f5f9', fontFamily: 'JetBrains Mono' }}>51.6°</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Mass</span><span style={{ color: '#f1f5f9', fontFamily: 'JetBrains Mono' }}>~420,000 kg</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Length</span><span style={{ color: '#f1f5f9', fontFamily: 'JetBrains Mono' }}>109 m</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Crew</span><span style={{ color: '#f1f5f9', fontFamily: 'JetBrains Mono' }}>6-7</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Speed</span><span style={{ color: '#f1f5f9', fontFamily: 'JetBrains Mono' }}>27,600 km/h</span></div>
        </div>
      </div>

      <button className="btn-primary" style={{ width: '100%' }}
        onClick={() => issPos && setViewTarget({ lat: issPos.lat, lon: issPos.lon })}>
        🎯 Track ISS on Globe
      </button>
    </div>
  );
}

/* ================================================================
   WEATHER PANEL
   ================================================================ */
function WeatherPanel() {
  const showWeather = useAppStore(s => s.showWeather);
  const toggleLayer = useAppStore(s => s.toggleLayer);
  const weatherLayerMode = useAppStore(s => s.weatherLayerMode);
  const setWeatherLayerMode = useAppStore(s => s.setWeatherLayerMode);

  return (
    <div>
      <div className="panel-header">
        <div className="panel-title">🌦️ Weather</div>
      </div>

      <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Layer Visibility</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>☁️</span>
            <span style={{ fontSize: 14 }}>Enable Weather Overlay</span>
          </div>
          <button
            className={`btn-icon ${showWeather ? 'active' : ''}`}
            style={{ width: 36, height: 22, borderRadius: 11, transition: 'all 0.2s' }}
            onClick={() => toggleLayer('showWeather')}
          >
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: showWeather ? '#00d4ff' : '#475569', transition: 'all 0.2s', transform: showWeather ? 'translateX(5px)' : 'translateX(-5px)' }} />
          </button>
        </div>
      </div>

      <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Visual Mode</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { mode: 'clouds', label: 'Real Clouds', icon: '☁️' },
            { mode: 'temp', label: 'Temperature Map', icon: '🌡️' },
            { mode: 'pressure', label: 'Pressure Map', icon: '🌀' },
            { mode: 'wind', label: 'Wind Simulation', icon: '💨' },
          ].map(opt => (
            <button
              key={opt.mode}
              className={`btn-secondary ${weatherLayerMode === opt.mode ? 'active' : ''}`}
              style={{
                padding: '8px 12px',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                background: weatherLayerMode === opt.mode ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                borderColor: weatherLayerMode === opt.mode ? '#00d4ff' : 'rgba(255, 255, 255, 0.08)',
                color: weatherLayerMode === opt.mode ? '#00d4ff' : '#cbd5e1'
              }}
              onClick={() => setWeatherLayerMode(opt.mode as any)}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card" style={{ padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>🌡️ Global Weather Insights</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: '#94a3b8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Active Hurricanes</span><span style={{ color: '#ef4444', fontWeight: 600 }}>0</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tropical Storms</span><span style={{ color: '#f59e0b', fontWeight: 600 }}>2</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Avg Global Temp</span><span style={{ color: '#f1f5f9', fontFamily: 'JetBrains Mono' }}>15.2°C</span></div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   AIRPORT PANEL
   ================================================================ */
function AirportPanel() {
  const selectedCode = useAppStore(s => s.selectedAirportCode);
  const selectAirport = useAppStore(s => s.selectAirport);
  const setViewTarget = useAppStore(s => s.setViewTarget);

  const traffic = useMemo(() => {
    if (!selectedCode) return null;
    return generateAirportTraffic(selectedCode);
  }, [selectedCode]);

  if (!traffic) return null;

  return (
    <div>
      <div className="panel-header">
        <div className="panel-title">🛬 Airport Details</div>
        <button className="btn-icon" onClick={() => selectAirport(null)}>{icons.close}</button>
      </div>

      <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Outfit', color: '#00d4ff', marginBottom: 4 }}>
          {traffic.name} ({traffic.code})
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <span className="rank-badge">Traffic Score: {traffic.trafficScore}%</span>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>
            Lat: {traffic.lat.toFixed(2)}°, Lon: {traffic.lon.toFixed(2)}°
          </span>
        </div>
      </div>

      <div className="glass-card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#00d4ff', marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6 }}>
          ✈️ Departures
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {traffic.departures.map((dep, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <div>
                <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#f59e0b', marginRight: 8 }}>{dep.flightNumber}</span>
                <span style={{ color: '#f1f5f9' }}>{dep.destination?.split(' - ')[0]}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: '#94a3b8', marginRight: 8 }}>{dep.time}</span>
                <span style={{
                  color: dep.status === 'delayed' ? '#ef4444' :
                         dep.status === 'departed' ? '#10b981' : '#94a3b8',
                  textTransform: 'capitalize',
                  fontWeight: 600
                }}>{dep.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#00d4ff', marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6 }}>
          🛬 Arrivals
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {traffic.arrivals.map((arr, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <div>
                <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#7c3aed', marginRight: 8 }}>{arr.flightNumber}</span>
                <span style={{ color: '#f1f5f9' }}>{arr.origin?.split(' - ')[0]}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: '#94a3b8', marginRight: 8 }}>{arr.time}</span>
                <span style={{
                  color: arr.status === 'delayed' ? '#ef4444' :
                         arr.status === 'landed' ? '#10b981' : '#94a3b8',
                  textTransform: 'capitalize',
                  fontWeight: 600
                }}>{arr.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button className="btn-primary" style={{ width: '100%' }}
        onClick={() => setViewTarget({ lat: traffic.lat, lon: traffic.lon, entityId: traffic.code, entityType: 'airport' })}>
        🎯 Track Airport on Globe
      </button>
    </div>
  );
}

/* ================================================================
   HOVER TOOLTIP
   ================================================================ */
export function HoverTooltip() {
  const hoveredId = useAppStore(s => s.hoveredEntityId);
  const hoveredType = useAppStore(s => s.hoveredEntityType);
  const aircraft = useFlightStore(s => s.aircraft);
  const satellites = useSatelliteStore(s => s.satellites);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setCoords({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const info = useMemo(() => {
    if (!hoveredId) return null;
    if (hoveredType === 'aircraft') {
      const ac = aircraft.find(a => a.id === hoveredId);
      if (ac) {
        return {
          title: ac.callsign,
          subtitle: `${ac.origin.split(' - ')[0]} ➔ ${ac.destination.split(' - ')[0]}`,
          details: [
            { label: 'Airline', value: ac.airline },
            { label: 'Type', value: ac.aircraftType },
            { label: 'Alt', value: `${Math.round(ac.altitude)} m` },
            { label: 'Speed', value: `${Math.round(ac.speed * 3.6)} km/h` }
          ]
        };
      }
    } else if (hoveredType === 'satellite') {
      const sat = satellites.find(s => s.id === hoveredId);
      if (sat) {
        return {
          title: sat.name,
          subtitle: `NORAD: ${sat.noradId} | Cat: ${sat.category}`,
          details: [
            { label: 'Orbit', value: sat.orbitType },
            { label: 'Alt', value: `${Math.round(sat.altitude)} km` },
            { label: 'Speed', value: `${sat.speed.toFixed(2)} km/s` },
            { label: 'Inclination', value: `${sat.inclination.toFixed(1)}°` }
          ]
        };
      }
    }
    return null;
  }, [hoveredId, hoveredType, aircraft, satellites]);

  if (!info) return null;

  return (
    <div
      className="hover-tooltip glass-card"
      style={{
        position: 'fixed',
        left: coords.x + 15,
        top: coords.y + 15,
        zIndex: 9999,
        pointerEvents: 'none',
        padding: '12px 16px',
        maxWidth: 260,
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(8px)',
        background: 'rgba(15, 23, 42, 0.85)'
      }}
    >
      <div style={{ fontWeight: 800, color: '#00d4ff', fontSize: 14 }}>{info.title}</div>
      <div style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 6px 0' }}>{info.subtitle}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {info.details.map((d, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: '#64748b' }}>{d.label}</span>
            <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   PANEL CONTAINER
   ================================================================ */
export function PanelContainer() {
  const activePanel = useAppStore(s => s.activePanel);

  const panelComponents: Record<string, React.ReactNode> = {
    flights: <FlightPanel />,
    satellites: <SatellitePanel />,
    iss: <ISSPanel />,
    weather: <WeatherPanel />,
    airport: <AirportPanel />,
  };

  return (
    <>
      <AnimatePresence>
        {activePanel !== 'none' && panelComponents[activePanel] && (
          <motion.div
            className="panel"
            initial={{ x: 420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 420, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {panelComponents[activePanel]}
          </motion.div>
        )}
      </AnimatePresence>
      <HoverTooltip />
    </>
  );
}

export default PanelContainer;
