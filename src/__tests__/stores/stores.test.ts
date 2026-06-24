import { act } from '@testing-library/react';

// Reset localStorage before each test
beforeEach(() => {
  localStorage.clear();
});

// Must import stores AFTER setting up mocks
import { useAppStore, useFlightStore, useSatelliteStore, useUserStore } from '@/stores/stores';
import type { Aircraft, Satellite } from '@/types';

/* ================================================================
   APP STORE
   ================================================================ */
describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      loaded: false, loadProgress: 0, activePanel: 'none',
      cameraMode: 'orbit', viewTarget: null,
      selectedAircraftId: null, selectedSatelliteId: null,
      showLabels: true, showOrbits: true, showWeather: true,
      showFlights: true, showSatellites: true, showStarlink: false,
      showISS: true, timeScale: 1, searchQuery: '',
    });
  });

  it('initializes with correct defaults', () => {
    const state = useAppStore.getState();
    expect(state.loaded).toBe(false);
    expect(state.activePanel).toBe('none');
    expect(state.cameraMode).toBe('orbit');
    expect(state.showFlights).toBe(true);
    expect(state.showStarlink).toBe(false);
  });

  it('setLoaded updates loaded state', () => {
    act(() => useAppStore.getState().setLoaded(true));
    expect(useAppStore.getState().loaded).toBe(true);
  });

  it('setLoadProgress updates progress', () => {
    act(() => useAppStore.getState().setLoadProgress(75));
    expect(useAppStore.getState().loadProgress).toBe(75);
  });

  it('setActivePanel toggles panel', () => {
    act(() => useAppStore.getState().setActivePanel('flights'));
    expect(useAppStore.getState().activePanel).toBe('flights');

    // Clicking same panel closes it
    act(() => useAppStore.getState().setActivePanel('flights'));
    expect(useAppStore.getState().activePanel).toBe('none');
  });

  it('setActivePanel switches between panels', () => {
    act(() => useAppStore.getState().setActivePanel('flights'));
    act(() => useAppStore.getState().setActivePanel('satellites'));
    expect(useAppStore.getState().activePanel).toBe('satellites');
  });

  it('setCameraMode updates mode', () => {
    act(() => useAppStore.getState().setCameraMode('fly-to'));
    expect(useAppStore.getState().cameraMode).toBe('fly-to');
  });

  it('setViewTarget sets target', () => {
    const target = { lat: 40, lon: -74, entityId: 'test', entityType: 'aircraft' as const };
    act(() => useAppStore.getState().setViewTarget(target));
    expect(useAppStore.getState().viewTarget).toEqual(target);
  });

  it('setViewTarget clears with null', () => {
    act(() => useAppStore.getState().setViewTarget({ lat: 0, lon: 0 }));
    act(() => useAppStore.getState().setViewTarget(null));
    expect(useAppStore.getState().viewTarget).toBeNull();
  });

  it('selectAircraft sets ID and opens panel', () => {
    act(() => useAppStore.getState().selectAircraft('AC001'));
    expect(useAppStore.getState().selectedAircraftId).toBe('AC001');
    expect(useAppStore.getState().activePanel).toBe('flights');
  });

  it('selectAircraft with null closes panel', () => {
    act(() => useAppStore.getState().selectAircraft('AC001'));
    act(() => useAppStore.getState().selectAircraft(null));
    expect(useAppStore.getState().selectedAircraftId).toBeNull();
    expect(useAppStore.getState().activePanel).toBe('none');
  });

  it('selectSatellite sets ID and opens panel', () => {
    act(() => useAppStore.getState().selectSatellite('ISS'));
    expect(useAppStore.getState().selectedSatelliteId).toBe('ISS');
    expect(useAppStore.getState().activePanel).toBe('satellites');
  });

  it('toggleLayer toggles boolean layers', () => {
    expect(useAppStore.getState().showStarlink).toBe(false);
    act(() => useAppStore.getState().toggleLayer('showStarlink'));
    expect(useAppStore.getState().showStarlink).toBe(true);
    act(() => useAppStore.getState().toggleLayer('showStarlink'));
    expect(useAppStore.getState().showStarlink).toBe(false);
  });

  it('toggleLayer works for all layer types', () => {
    const layers = ['showFlights', 'showSatellites', 'showISS', 'showOrbits', 'showWeather'];
    for (const layer of layers) {
      const initial = (useAppStore.getState() as any)[layer];
      act(() => useAppStore.getState().toggleLayer(layer));
      expect((useAppStore.getState() as any)[layer]).toBe(!initial);
    }
  });

  it('setSearchQuery updates query', () => {
    act(() => useAppStore.getState().setSearchQuery('Boeing'));
    expect(useAppStore.getState().searchQuery).toBe('Boeing');
  });

  it('setTimeScale updates time scale', () => {
    act(() => useAppStore.getState().setTimeScale(2));
    expect(useAppStore.getState().timeScale).toBe(2);
  });
});

/* ================================================================
   FLIGHT STORE
   ================================================================ */
describe('useFlightStore', () => {
  beforeEach(() => {
    useFlightStore.setState({ aircraft: [], totalCount: 0, lastUpdate: 0 });
  });

  it('initializes with empty state', () => {
    const state = useFlightStore.getState();
    expect(state.aircraft).toHaveLength(0);
    expect(state.totalCount).toBe(0);
  });

  it('setAircraft updates aircraft list and count', () => {
    const mockAircraft: Aircraft[] = [
      { id: 'AC1', callsign: 'TEST1', flightNumber: 'TS001', airline: 'Test Air',
        origin: 'JFK', destination: 'LAX', latitude: 40, longitude: -74,
        altitude: 10000, speed: 250, heading: 270, verticalRate: 0,
        aircraftType: 'B737', category: 'commercial', onGround: false,
        lastUpdate: Date.now(), trail: [] },
    ];
    act(() => useFlightStore.getState().setAircraft(mockAircraft));
    expect(useFlightStore.getState().aircraft).toHaveLength(1);
    expect(useFlightStore.getState().totalCount).toBe(1);
    expect(useFlightStore.getState().lastUpdate).toBeGreaterThan(0);
  });
});

/* ================================================================
   SATELLITE STORE
   ================================================================ */
describe('useSatelliteStore', () => {
  beforeEach(() => {
    useSatelliteStore.setState({ satellites: [], issPosition: null, totalCount: 0, lastUpdate: 0 });
  });

  it('initializes with empty state', () => {
    const state = useSatelliteStore.getState();
    expect(state.satellites).toHaveLength(0);
    expect(state.issPosition).toBeNull();
  });

  it('setSatellites updates list', () => {
    const sats: Satellite[] = [
      { id: 'ISS', name: 'ISS', noradId: 25544, category: 'iss',
        latitude: 20, longitude: 30, altitude: 420, speed: 7.66,
        inclination: 51.6, period: 92, orbitType: 'LEO',
        tle1: '', tle2: '', visible: true },
    ];
    act(() => useSatelliteStore.getState().setSatellites(sats));
    expect(useSatelliteStore.getState().satellites).toHaveLength(1);
    expect(useSatelliteStore.getState().totalCount).toBe(1);
  });

  it('setISSPosition updates position', () => {
    act(() => useSatelliteStore.getState().setISSPosition({ lat: 25, lon: 50, alt: 420 }));
    expect(useSatelliteStore.getState().issPosition).toEqual({ lat: 25, lon: 50, alt: 420 });
  });
});

/* ================================================================
   USER STORE
   ================================================================ */
describe('useUserStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useUserStore.setState({
      xp: 0, level: 1, rank: 'Cadet',
      completedMissions: [], achievements: [],
      streak: 0, lastActive: Date.now(),
      totalFlightsTracked: 0, totalSatellitesViewed: 0,
      totalMissionsCompleted: 0, dailyMissionCompleted: false,
      tutorMode: 'student', tutorMessages: [],
      activeMissionId: null, activeMissionStep: 0,
    });
  });

  it('initializes with cadet rank', () => {
    const state = useUserStore.getState();
    expect(state.rank).toBe('Cadet');
    expect(state.level).toBe(1);
    expect(state.xp).toBe(0);
  });

  it('addXP increases XP and recalculates level', () => {
    act(() => useUserStore.getState().addXP(100));
    expect(useUserStore.getState().xp).toBe(100);
    expect(useUserStore.getState().level).toBe(1);
  });

  it('addXP promotes rank at thresholds', () => {
    act(() => useUserStore.getState().addXP(500));
    expect(useUserStore.getState().rank).toBe('Pilot');
    act(() => useUserStore.getState().addXP(1000));
    expect(useUserStore.getState().rank).toBe('Flight Officer');
    act(() => useUserStore.getState().addXP(2000));
    expect(useUserStore.getState().rank).toBe('Mission Controller');
  });

  it('addXP reaches Astronaut rank', () => {
    act(() => useUserStore.getState().addXP(12000));
    expect(useUserStore.getState().rank).toBe('Astronaut');
  });

  it('addXP reaches Space Architect rank', () => {
    act(() => useUserStore.getState().addXP(20000));
    expect(useUserStore.getState().rank).toBe('Space Architect');
  });

  it('completeMission adds mission and XP', () => {
    act(() => useUserStore.getState().completeMission('gps-101'));
    expect(useUserStore.getState().completedMissions).toContain('gps-101');
    expect(useUserStore.getState().xp).toBe(200);
    expect(useUserStore.getState().totalMissionsCompleted).toBe(1);
  });

  it('completeMission prevents duplicates', () => {
    act(() => useUserStore.getState().completeMission('gps-101'));
    act(() => useUserStore.getState().completeMission('gps-101'));
    expect(useUserStore.getState().completedMissions).toHaveLength(1);
    expect(useUserStore.getState().xp).toBe(200); // Only 200, not 400
  });

  it('completeMission resets active mission', () => {
    act(() => useUserStore.getState().setActiveMission('gps-101', 2));
    act(() => useUserStore.getState().completeMission('gps-101'));
    expect(useUserStore.getState().activeMissionId).toBeNull();
    expect(useUserStore.getState().activeMissionStep).toBe(0);
  });

  it('unlockAchievement adds achievement and XP', () => {
    act(() => useUserStore.getState().unlockAchievement('first-flight'));
    expect(useUserStore.getState().achievements).toContain('first-flight');
    expect(useUserStore.getState().xp).toBe(100);
  });

  it('unlockAchievement prevents duplicates', () => {
    act(() => useUserStore.getState().unlockAchievement('first-flight'));
    act(() => useUserStore.getState().unlockAchievement('first-flight'));
    expect(useUserStore.getState().achievements).toHaveLength(1);
    expect(useUserStore.getState().xp).toBe(100);
  });

  it('updateStreak increments on consecutive days', () => {
    const yesterday = Date.now() - 86400000;
    useUserStore.setState({ lastActive: yesterday, streak: 3 });
    act(() => useUserStore.getState().updateStreak());
    expect(useUserStore.getState().streak).toBe(4);
  });

  it('updateStreak resets on gap days', () => {
    const twoDaysAgo = Date.now() - 2 * 86400000;
    useUserStore.setState({ lastActive: twoDaysAgo, streak: 5 });
    act(() => useUserStore.getState().updateStreak());
    expect(useUserStore.getState().streak).toBe(1);
  });

  it('updateStreak stays same on same day', () => {
    useUserStore.setState({ lastActive: Date.now(), streak: 3 });
    act(() => useUserStore.getState().updateStreak());
    expect(useUserStore.getState().streak).toBe(3);
  });

  it('setTutorMode updates mode', () => {
    act(() => useUserStore.getState().setTutorMode('expert'));
    expect(useUserStore.getState().tutorMode).toBe('expert');
  });

  it('addTutorMessage appends message', () => {
    const msg = { id: '1', role: 'user' as const, content: 'test', timestamp: Date.now() };
    act(() => useUserStore.getState().addTutorMessage(msg));
    expect(useUserStore.getState().tutorMessages).toHaveLength(1);
    expect(useUserStore.getState().tutorMessages[0].content).toBe('test');
  });

  it('addTutorMessage limits to 51 messages', () => {
    for (let i = 0; i < 60; i++) {
      act(() => useUserStore.getState().addTutorMessage({
        id: String(i), role: 'user', content: `msg ${i}`, timestamp: Date.now(),
      }));
    }
    expect(useUserStore.getState().tutorMessages.length).toBeLessThanOrEqual(51);
  });

  it('setActiveMission sets mission and step', () => {
    act(() => useUserStore.getState().setActiveMission('rocket-101', 3));
    expect(useUserStore.getState().activeMissionId).toBe('rocket-101');
    expect(useUserStore.getState().activeMissionStep).toBe(3);
  });

  it('setActiveMission defaults step to 0', () => {
    act(() => useUserStore.getState().setActiveMission('gps-101'));
    expect(useUserStore.getState().activeMissionStep).toBe(0);
  });

  it('advanceMissionStep increments step', () => {
    act(() => useUserStore.getState().setActiveMission('gps-101', 0));
    act(() => useUserStore.getState().advanceMissionStep());
    expect(useUserStore.getState().activeMissionStep).toBe(1);
    act(() => useUserStore.getState().advanceMissionStep());
    expect(useUserStore.getState().activeMissionStep).toBe(2);
  });
});
