'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Aircraft, Satellite, ActivePanel, CameraMode, ViewTarget, UserProgress, UserRank, TutorMessage, TutorMode } from '@/types';

/* ===== APP STORE ===== */
interface AppState {
  loaded: boolean;
  loadProgress: number;
  activePanel: ActivePanel;
  cameraMode: CameraMode;
  viewTarget: ViewTarget | null;
  selectedAircraftId: string | null;
  selectedSatelliteId: string | null;
  showLabels: boolean;
  showOrbits: boolean;
  showWeather: boolean;
  showFlights: boolean;
  showSatellites: boolean;
  showStarlink: boolean;
  showISS: boolean;
  timeScale: number;
  searchQuery: string;
  realisticColors: boolean;
  setLoaded: (v: boolean) => void;
  setLoadProgress: (v: number) => void;
  setActivePanel: (p: ActivePanel) => void;
  setCameraMode: (m: CameraMode) => void;
  setViewTarget: (t: ViewTarget | null) => void;
  selectAircraft: (id: string | null) => void;
  selectSatellite: (id: string | null) => void;
  toggleLayer: (layer: string) => void;
  setSearchQuery: (q: string) => void;
  setTimeScale: (s: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  loaded: false, loadProgress: 0,
  activePanel: 'none',
  cameraMode: 'orbit',
  viewTarget: null,
  selectedAircraftId: null, selectedSatelliteId: null,
  showLabels: true, showOrbits: true, showWeather: true,
  showFlights: true, showSatellites: true, showStarlink: false, showISS: true,
  timeScale: 1, searchQuery: '',
  realisticColors: false,
  setLoaded: (v) => set({ loaded: v }),
  setLoadProgress: (v) => set({ loadProgress: v }),
  setActivePanel: (p) => set((s) => ({ activePanel: s.activePanel === p ? 'none' : p })),
  setCameraMode: (m) => set({ cameraMode: m }),
  setViewTarget: (t) => set({ viewTarget: t }),
  selectAircraft: (id) => set({ selectedAircraftId: id, activePanel: id ? 'flights' : 'none' }),
  selectSatellite: (id) => set({ selectedSatelliteId: id, activePanel: id ? 'satellites' : 'none' }),
  toggleLayer: (layer) => set((s) => ({ ...s, [layer]: !(s as any)[layer] })),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setTimeScale: (s) => set({ timeScale: s }),
}));

/* ===== FLIGHT STORE ===== */
interface FlightState {
  aircraft: Aircraft[];
  totalCount: number;
  lastUpdate: number;
  setAircraft: (a: Aircraft[]) => void;
}

export const useFlightStore = create<FlightState>((set) => ({
  aircraft: [], totalCount: 0, lastUpdate: 0,
  setAircraft: (a) => set({ aircraft: a, totalCount: a.length, lastUpdate: Date.now() }),
}));

/* ===== SATELLITE STORE ===== */
interface SatelliteState {
  satellites: Satellite[];
  issPosition: { lat: number; lon: number; alt: number } | null;
  totalCount: number;
  lastUpdate: number;
  setSatellites: (s: Satellite[]) => void;
  setISSPosition: (p: { lat: number; lon: number; alt: number }) => void;
}

export const useSatelliteStore = create<SatelliteState>((set) => ({
  satellites: [], issPosition: null, totalCount: 0, lastUpdate: 0,
  setSatellites: (s) => set({ satellites: s, totalCount: s.length, lastUpdate: Date.now() }),
  setISSPosition: (p) => set({ issPosition: p }),
}));

/* ===== USER STORE (persisted) ===== */
interface UserState extends UserProgress {
  tutorMode: TutorMode;
  tutorMessages: TutorMessage[];
  activeMissionId: string | null;
  activeMissionStep: number;
  addXP: (amount: number) => void;
  completeMission: (id: string) => void;
  unlockAchievement: (id: string) => void;
  updateStreak: () => void;
  setTutorMode: (m: TutorMode) => void;
  addTutorMessage: (msg: TutorMessage) => void;
  setActiveMission: (id: string | null, step?: number) => void;
  advanceMissionStep: () => void;
}

const RANK_THRESHOLDS: [number, UserRank][] = [
  [0, 'Cadet'], [500, 'Pilot'], [1500, 'Flight Officer'],
  [3500, 'Mission Controller'], [7000, 'Orbital Engineer'],
  [12000, 'Astronaut'], [20000, 'Space Architect'],
];

function getRank(xp: number): { rank: UserRank; level: number } {
  let rank: UserRank = 'Cadet';
  for (const [threshold, r] of RANK_THRESHOLDS) {
    if (xp >= threshold) rank = r;
  }
  const level = Math.floor(xp / 200) + 1;
  return { rank, level };
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      xp: 0, level: 1, rank: 'Cadet',
      completedMissions: [], achievements: [],
      streak: 0, lastActive: Date.now(),
      totalFlightsTracked: 0, totalSatellitesViewed: 0, totalMissionsCompleted: 0,
      dailyMissionCompleted: false,
      tutorMode: 'student', tutorMessages: [],
      activeMissionId: null, activeMissionStep: 0,

      addXP: (amount) => set((s) => {
        const newXP = s.xp + amount;
        const { rank, level } = getRank(newXP);
        return { xp: newXP, rank, level };
      }),

      completeMission: (id) => set((s) => {
        if (s.completedMissions.includes(id)) return s;
        const newXP = s.xp + 200;
        const { rank, level } = getRank(newXP);
        return {
          completedMissions: [...s.completedMissions, id],
          totalMissionsCompleted: s.totalMissionsCompleted + 1,
          xp: newXP, rank, level,
          activeMissionId: null, activeMissionStep: 0,
        };
      }),

      unlockAchievement: (id) => set((s) => {
        if (s.achievements.includes(id)) return s;
        const newXP = s.xp + 100;
        const { rank, level } = getRank(newXP);
        return { achievements: [...s.achievements, id], xp: newXP, rank, level };
      }),

      updateStreak: () => set((s) => {
        const now = Date.now();
        const dayMs = 86400000;
        const lastDay = Math.floor(s.lastActive / dayMs);
        const today = Math.floor(now / dayMs);
        const streak = today - lastDay === 1 ? s.streak + 1 : today === lastDay ? s.streak : 1;
        return { streak, lastActive: now };
      }),

      setTutorMode: (m) => set({ tutorMode: m }),
      addTutorMessage: (msg) => set((s) => ({ tutorMessages: [...s.tutorMessages.slice(-50), msg] })),
      setActiveMission: (id, step = 0) => set({ activeMissionId: id, activeMissionStep: step }),
      advanceMissionStep: () => set((s) => ({ activeMissionStep: s.activeMissionStep + 1 })),
    }),
    { name: 'earth-explorer-user' }
  )
);
