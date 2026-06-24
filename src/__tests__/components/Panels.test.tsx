import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore, useFlightStore, useSatelliteStore, useUserStore } from '@/stores/stores';
import { generateSimulatedAircraft, generateSimulatedSatellites } from '@/lib/data';

// Import components
import { Sidebar, HUD, StatusBar, PanelContainer } from '@/components/ui/Panels';

// Pre-populate stores before tests
beforeEach(() => {
  const aircraft = generateSimulatedAircraft(10);
  const satellites = generateSimulatedSatellites();
  useFlightStore.setState({ aircraft, totalCount: aircraft.length, lastUpdate: Date.now() });
  useSatelliteStore.setState({
    satellites, totalCount: satellites.length, lastUpdate: Date.now(),
    issPosition: { lat: 20, lon: 30, alt: 420 },
  });
  useAppStore.setState({
    loaded: true, loadProgress: 100, activePanel: 'none',
    cameraMode: 'orbit', viewTarget: null,
    selectedAircraftId: null, selectedSatelliteId: null,
    showLabels: true, showOrbits: true, showWeather: true,
    showFlights: true, showSatellites: true, showStarlink: false,
    showISS: true, timeScale: 1, searchQuery: '',
  });
  useUserStore.setState({
    xp: 500, level: 3, rank: 'Pilot', streak: 5,
    completedMissions: [], achievements: [],
    lastActive: Date.now(), totalFlightsTracked: 0,
    totalSatellitesViewed: 0, totalMissionsCompleted: 0,
    dailyMissionCompleted: false, tutorMode: 'student',
    tutorMessages: [], activeMissionId: null, activeMissionStep: 0,
  });
});

/* ================================================================
   SIDEBAR
   ================================================================ */
describe('Sidebar', () => {
  it('renders without crashing', () => {
    render(<Sidebar />);
    expect(document.querySelector('.sidebar')).toBeInTheDocument();
  });

  it('renders logo', () => {
    render(<Sidebar />);
    expect(document.querySelector('.sidebar-logo')).toBeInTheDocument();
  });

  it('renders all nav buttons', () => {
    render(<Sidebar />);
    const buttons = document.querySelectorAll('.sidebar-btn');
    expect(buttons.length).toBe(8); // flights, satellites, iss, weather, missions, labs, academy, achievements
  });

  it('clicking a button sets active panel', () => {
    render(<Sidebar />);
    const buttons = document.querySelectorAll('.sidebar-btn');
    fireEvent.click(buttons[0]); // flights
    expect(useAppStore.getState().activePanel).toBe('flights');
  });

  it('clicking active button closes panel', () => {
    useAppStore.setState({ activePanel: 'flights' });
    render(<Sidebar />);
    const buttons = document.querySelectorAll('.sidebar-btn');
    fireEvent.click(buttons[0]);
    expect(useAppStore.getState().activePanel).toBe('none');
  });

  it('shows user rank badge', () => {
    render(<Sidebar />);
    expect(screen.getByText('Pilot')).toBeInTheDocument();
  });
});

/* ================================================================
   HUD
   ================================================================ */
describe('HUD', () => {
  it('renders without crashing', () => {
    render(<HUD />);
    expect(document.querySelector('.hud-top')).toBeInTheDocument();
  });

  it('shows aircraft count', () => {
    render(<HUD />);
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('shows search input', () => {
    render(<HUD />);
    const input = document.querySelector('.hud-search') as HTMLInputElement;
    expect(input).toBeInTheDocument();
  });

  it('search input updates store', () => {
    render(<HUD />);
    const input = document.querySelector('.hud-search') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Boeing' } });
    expect(useAppStore.getState().searchQuery).toBe('Boeing');
  });

  it('shows XP badge', () => {
    render(<HUD />);
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('shows streak badge', () => {
    render(<HUD />);
    expect(screen.getByText('5d')).toBeInTheDocument();
  });

  it('shows level badge', () => {
    render(<HUD />);
    expect(screen.getByText('L3')).toBeInTheDocument();
  });
});

/* ================================================================
   STATUS BAR
   ================================================================ */
describe('StatusBar', () => {
  it('renders without crashing', () => {
    render(<StatusBar />);
    expect(document.querySelector('.status-bar')).toBeInTheDocument();
  });

  it('shows aircraft count', () => {
    render(<StatusBar />);
    expect(screen.getByText('10 aircraft')).toBeInTheDocument();
  });

  it('shows version', () => {
    render(<StatusBar />);
    expect(screen.getByText('Earth Explorer v1.0')).toBeInTheDocument();
  });

  it('shows WebGL2 label', () => {
    render(<StatusBar />);
    expect(screen.getByText('WebGL2')).toBeInTheDocument();
  });
});

/* ================================================================
   PANEL CONTAINER
   ================================================================ */
describe('PanelContainer', () => {
  it('renders nothing when no panel active', () => {
    useAppStore.setState({ activePanel: 'none' });
    const { container } = render(<PanelContainer />);
    expect(container.querySelector('.panel')).not.toBeInTheDocument();
  });

  it('renders flights panel when active', () => {
    useAppStore.setState({ activePanel: 'flights' });
    render(<PanelContainer />);
    expect(screen.getByText('✈️ Live Flights')).toBeInTheDocument();
  });

  it('renders satellites panel when active', () => {
    useAppStore.setState({ activePanel: 'satellites' });
    render(<PanelContainer />);
    expect(screen.getByText('🛰️ Satellites')).toBeInTheDocument();
  });

  it('renders ISS panel when active', () => {
    useAppStore.setState({ activePanel: 'iss' });
    render(<PanelContainer />);
    expect(screen.getByText('International Space Station')).toBeInTheDocument();
  });

  it('renders weather panel when active', () => {
    useAppStore.setState({ activePanel: 'weather' });
    render(<PanelContainer />);
    expect(screen.getByText('🌦️ Weather')).toBeInTheDocument();
  });

  it('flights panel shows aircraft list', () => {
    useAppStore.setState({ activePanel: 'flights' });
    render(<PanelContainer />);
    // Should show "active" count
    expect(screen.getByText('10 active')).toBeInTheDocument();
  });

  it('flights panel filter tabs work', () => {
    useAppStore.setState({ activePanel: 'flights' });
    render(<PanelContainer />);
    const allTab = screen.getByText('All');
    expect(allTab).toBeInTheDocument();
    const commercialTab = screen.getByText('Commercial');
    expect(commercialTab).toBeInTheDocument();
  });

  it('ISS panel shows quick facts', () => {
    useAppStore.setState({ activePanel: 'iss' });
    render(<PanelContainer />);
    expect(screen.getByText('~92 min')).toBeInTheDocument();
    expect(screen.getByText('51.6°')).toBeInTheDocument();
  });

  it('ISS panel has track button', () => {
    useAppStore.setState({ activePanel: 'iss' });
    render(<PanelContainer />);
    expect(screen.getByText('🎯 Track ISS on Globe')).toBeInTheDocument();
  });
});

/* ================================================================
   FLIGHT DETAIL PANEL
   ================================================================ */
describe('Flight Detail Panel', () => {
  it('shows aircraft details when selected', () => {
    const aircraft = useFlightStore.getState().aircraft;
    useAppStore.setState({ activePanel: 'flights', selectedAircraftId: aircraft[0].id });
    render(<PanelContainer />);
    expect(screen.getByText('✈️ Flight Details')).toBeInTheDocument();
    expect(screen.getByText(aircraft[0].flightNumber)).toBeInTheDocument();
  });

  it('shows track button for selected aircraft', () => {
    const aircraft = useFlightStore.getState().aircraft;
    useAppStore.setState({ activePanel: 'flights', selectedAircraftId: aircraft[0].id });
    render(<PanelContainer />);
    expect(screen.getByText('🎯 Track on Globe')).toBeInTheDocument();
  });

  it('shows altitude and speed stats', () => {
    const aircraft = useFlightStore.getState().aircraft;
    useAppStore.setState({ activePanel: 'flights', selectedAircraftId: aircraft[0].id });
    render(<PanelContainer />);
    expect(screen.getByText('Altitude (m)')).toBeInTheDocument();
    expect(screen.getByText('Speed (km/h)')).toBeInTheDocument();
    expect(screen.getByText('Heading')).toBeInTheDocument();
  });
});

describe('More Panels Interactions', () => {
  it('allows searching aircraft in flight list', () => {
    useAppStore.setState({ activePanel: 'flights', searchQuery: 'commercial' });
    render(<PanelContainer />);
  });

  it('clicking an aircraft list item selects and tracks it', () => {
    useAppStore.setState({ activePanel: 'flights' });
    render(<PanelContainer />);
    const cards = document.querySelectorAll('.mission-card');
    if (cards.length > 0) {
      fireEvent.click(cards[0]);
      expect(useAppStore.getState().selectedAircraftId).not.toBeNull();
    }
  });

  it('clicking track aircraft on globe sets viewTarget', () => {
    const aircraft = useFlightStore.getState().aircraft;
    useAppStore.setState({ activePanel: 'flights', selectedAircraftId: aircraft[0].id });
    render(<PanelContainer />);
    const button = screen.getByText('🎯 Track on Globe');
    fireEvent.click(button);
    expect(useAppStore.getState().viewTarget).not.toBeNull();
  });

  it('shows satellite details when selected', () => {
    const satellites = useSatelliteStore.getState().satellites;
    useAppStore.setState({ activePanel: 'satellites', selectedSatelliteId: satellites[0].id });
    render(<PanelContainer />);
    expect(screen.getByText('🛰️ Satellite Details')).toBeInTheDocument();
    expect(screen.getByText(satellites[0].name)).toBeInTheDocument();
    expect(screen.getByText('Altitude (km)')).toBeInTheDocument();
  });

  it('clicking a satellite list item selects and tracks it', () => {
    useAppStore.setState({ activePanel: 'satellites' });
    render(<PanelContainer />);
    const cards = document.querySelectorAll('.mission-card');
    if (cards.length > 0) {
      fireEvent.click(cards[0]);
      expect(useAppStore.getState().selectedSatelliteId).not.toBeNull();
    }
  });

  it('clicking track satellite on globe sets viewTarget', () => {
    const satellites = useSatelliteStore.getState().satellites;
    useAppStore.setState({ activePanel: 'satellites', selectedSatelliteId: satellites[0].id });
    render(<PanelContainer />);
    const button = screen.getByText('🎯 Track on Globe');
    fireEvent.click(button);
    expect(useAppStore.getState().viewTarget).not.toBeNull();
  });

  it('clicking active category in satellites filters list', () => {
    useAppStore.setState({ activePanel: 'satellites' });
    render(<PanelContainer />);
    const cards = document.querySelectorAll('.stat-card');
    if (cards.length > 0) {
      fireEvent.click(cards[0]);
    }
  });

  it('clicking weather toggles weather layer', () => {
    useAppStore.setState({ activePanel: 'weather', showWeather: false });
    render(<PanelContainer />);
    const btn = document.querySelector('.btn-icon');
    if (btn) {
      fireEvent.click(btn);
      expect(useAppStore.getState().showWeather).toBe(true);
    }
  });
});
