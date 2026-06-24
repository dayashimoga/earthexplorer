import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useAppStore, useUserStore } from '@/stores/stores';
import { MissionPanel, LabPanel, AcademyPanel, AchievementPanel, EducationPanelRouter } from '@/components/ui/Education';

beforeEach(() => {
  localStorage.clear();
  useUserStore.setState({
    xp: 1000, level: 5, rank: 'Flight Officer', streak: 3,
    completedMissions: [], achievements: ['first-flight'],
    lastActive: Date.now(), totalFlightsTracked: 0,
    totalSatellitesViewed: 0, totalMissionsCompleted: 0,
    dailyMissionCompleted: false, tutorMode: 'student',
    tutorMessages: [], activeMissionId: null, activeMissionStep: 0,
  });
  useAppStore.setState({ activePanel: 'missions' });
});

/* ================================================================
   MISSION PANEL
   ================================================================ */
describe('MissionPanel', () => {
  it('renders mission list', () => {
    render(<MissionPanel />);
    expect(screen.getByText('🎯 Missions')).toBeInTheDocument();
    expect(screen.getByText('How GPS Works')).toBeInTheDocument();
    expect(screen.getByText('Flight Navigation')).toBeInTheDocument();
    expect(screen.getByText('Satellite Communications')).toBeInTheDocument();
    expect(screen.getByText(/Rocket Science/)).toBeInTheDocument();
    expect(screen.getByText(/Space Exploration/)).toBeInTheDocument();
  });

  it('shows mission count', () => {
    render(<MissionPanel />);
    expect(screen.getByText('0/5')).toBeInTheDocument();
  });

  it('shows XP rewards', () => {
    render(<MissionPanel />);
    expect(screen.getByText('+250 XP')).toBeInTheDocument();
  });

  it('clicking a mission opens it', () => {
    render(<MissionPanel />);
    fireEvent.click(screen.getByText('How GPS Works'));
    expect(useUserStore.getState().activeMissionId).toBe('gps-101');
  });

  it('shows active mission content', () => {
    useUserStore.setState({ activeMissionId: 'gps-101', activeMissionStep: 0 });
    render(<MissionPanel />);
    expect(screen.getByText('The GPS Constellation')).toBeInTheDocument();
    expect(screen.getByText('→ Next Step')).toBeInTheDocument();
  });

  it('advances mission steps', () => {
    useUserStore.setState({ activeMissionId: 'gps-101', activeMissionStep: 0 });
    render(<MissionPanel />);
    fireEvent.click(screen.getByText('→ Next Step'));
    expect(useUserStore.getState().activeMissionStep).toBe(1);
  });

  it('shows quiz on quiz step', () => {
    useUserStore.setState({ activeMissionId: 'gps-101', activeMissionStep: 3 });
    render(<MissionPanel />);
    expect(screen.getByText('2 satellites')).toBeInTheDocument();
    expect(screen.getByText('4 satellites')).toBeInTheDocument();
  });

  it('handles correct quiz answer', () => {
    useUserStore.setState({ activeMissionId: 'gps-101', activeMissionStep: 3, xp: 0 });
    render(<MissionPanel />);
    fireEvent.click(screen.getByText('4 satellites')); // correctAnswer = 2 (0-indexed)
    expect(screen.getByText(/Correct/)).toBeInTheDocument();
    expect(useUserStore.getState().xp).toBe(50);
  });

  it('handles wrong quiz answer', () => {
    useUserStore.setState({ activeMissionId: 'gps-101', activeMissionStep: 3, xp: 0 });
    render(<MissionPanel />);
    fireEvent.click(screen.getByText('2 satellites'));
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(useUserStore.getState().xp).toBe(0);
  });

  it('shows progress bar during mission', () => {
    useUserStore.setState({ activeMissionId: 'gps-101', activeMissionStep: 2 });
    render(<MissionPanel />);
    expect(screen.getByText('Step 3 of 5')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('completes mission on last step', () => {
    useUserStore.setState({ activeMissionId: 'gps-101', activeMissionStep: 4, xp: 0 });
    render(<MissionPanel />);
    fireEvent.click(screen.getByText('🏆 Complete Mission'));
    expect(useUserStore.getState().completedMissions).toContain('gps-101');
    expect(useUserStore.getState().activeMissionId).toBeNull();
  });

  it('shows locked missions', () => {
    useUserStore.setState({ level: 1 });
    render(<MissionPanel />);
    // Some missions require higher levels
    const lockedTexts = screen.queryAllByText(/Level \d+ required/);
    expect(lockedTexts.length).toBeGreaterThan(0);
  });

  it('shows completed missions', () => {
    useUserStore.setState({ completedMissions: ['gps-101'] });
    render(<MissionPanel />);
    expect(screen.getByText('1/5')).toBeInTheDocument();
  });

  it('shows orbit simulation on simulation step', () => {
    useUserStore.setState({ activeMissionId: 'gps-101', activeMissionStep: 4 }); // simulation step
    render(<MissionPanel />);
    expect(screen.getByText('🔬 Orbit Simulator')).toBeInTheDocument();
  });

  it('close button deactivates mission', () => {
    useUserStore.setState({ activeMissionId: 'gps-101', activeMissionStep: 0 });
    render(<MissionPanel />);
    fireEvent.click(screen.getByText('✕'));
    expect(useUserStore.getState().activeMissionId).toBeNull();
  });
});

/* ================================================================
   LAB PANEL
   ================================================================ */
describe('LabPanel', () => {
  it('renders lab list', () => {
    render(<LabPanel />);
    expect(screen.getByText('🔬 Simulation Labs')).toBeInTheDocument();
    expect(screen.getByText('Orbit Lab')).toBeInTheDocument();
    expect(screen.getByText('Flight Lab')).toBeInTheDocument();
    expect(screen.getByText('Rocket Lab')).toBeInTheDocument();
    expect(screen.getByText('Weather Lab')).toBeInTheDocument();
  });

  it('clicking orbit lab opens it', () => {
    render(<LabPanel />);
    fireEvent.click(screen.getByText('Orbit Lab'));
    expect(screen.getByText('🌍 Orbit Lab')).toBeInTheDocument();
    expect(screen.getByText('🔬 Orbit Simulator')).toBeInTheDocument();
  });

  it('orbit simulator has altitude slider', () => {
    render(<LabPanel />);
    fireEvent.click(screen.getByText('Orbit Lab'));
    expect(screen.getByText('Altitude')).toBeInTheDocument();
    const slider = document.querySelector('input[type="range"]');
    expect(slider).toBeInTheDocument();
  });

  it('clicking rocket lab opens it', () => {
    render(<LabPanel />);
    fireEvent.click(screen.getByText('Rocket Lab'));
    expect(screen.getByText('🚀 Rocket Lab')).toBeInTheDocument();
    expect(screen.getByText('🚀 LAUNCH')).toBeInTheDocument();
  });
});

/* ================================================================
   ACADEMY (AI TUTOR) PANEL
   ================================================================ */
describe('AcademyPanel', () => {
  it('renders tutor interface', () => {
    render(<AcademyPanel />);
    expect(screen.getByText('📚 AI Tutor')).toBeInTheDocument();
  });

  it('shows mode selector', () => {
    render(<AcademyPanel />);
    expect(screen.getByText(/Kids/)).toBeInTheDocument();
    expect(screen.getByText(/Student/)).toBeInTheDocument();
    expect(screen.getByText(/Enthusiast/)).toBeInTheDocument();
    expect(screen.getByText(/Expert/)).toBeInTheDocument();
  });

  it('shows welcome message with suggested topics', () => {
    render(<AcademyPanel />);
    expect(screen.getByText('Welcome to the AI Tutor!')).toBeInTheDocument();
    expect(screen.getByText('How do orbits work?')).toBeInTheDocument();
  });

  it('changes tutor mode', () => {
    render(<AcademyPanel />);
    fireEvent.click(screen.getByText(/Expert/));
    expect(useUserStore.getState().tutorMode).toBe('expert');
  });

  it('suggested topic sends message', () => {
    render(<AcademyPanel />);
    fireEvent.click(screen.getByText('How do orbits work?'));
    // Should add user message
    expect(useUserStore.getState().tutorMessages.length).toBeGreaterThanOrEqual(1);
  });

  it('has input field', () => {
    render(<AcademyPanel />);
    const input = document.querySelector('.tutor-input');
    expect(input).toBeInTheDocument();
  });

  it('send button exists', () => {
    render(<AcademyPanel />);
    expect(screen.getByText('Send')).toBeInTheDocument();
  });
});

/* ================================================================
   ACHIEVEMENT PANEL
   ================================================================ */
describe('AchievementPanel', () => {
  it('renders progress section', () => {
    render(<AchievementPanel />);
    expect(screen.getByText('🏆 Progress')).toBeInTheDocument();
  });

  it('shows user rank', () => {
    render(<AchievementPanel />);
    expect(screen.getByText('Flight Officer')).toBeInTheDocument();
  });

  it('shows level', () => {
    render(<AchievementPanel />);
    expect(screen.getByText('Level 5')).toBeInTheDocument();
  });

  it('shows XP', () => {
    render(<AchievementPanel />);
    const xpElements = screen.getAllByText('1,000');
    expect(xpElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows streak', () => {
    render(<AchievementPanel />);
    const streakElements = screen.getAllByText('3');
    expect(streakElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows achievements list', () => {
    render(<AchievementPanel />);
    expect(screen.getByText('First Flight')).toBeInTheDocument();
    expect(screen.getByText('Satellite Spotter')).toBeInTheDocument();
    expect(screen.getByText('ISS Hunter')).toBeInTheDocument();
  });

  it('shows unlocked achievement count', () => {
    render(<AchievementPanel />);
    expect(screen.getByText((content, element) => {
      return element?.tagName === 'DIV' && element.textContent?.replace(/\s+/g, ' ').trim() === '🏅 Achievements (1/20)';
    })).toBeInTheDocument();
  });

  it('shows stat grid', () => {
    render(<AchievementPanel />);
    expect(screen.getByText('Total XP')).toBeInTheDocument();
    expect(screen.getByText('Day Streak')).toBeInTheDocument();
    expect(screen.getByText('Missions')).toBeInTheDocument();
    expect(screen.getByText('Achievements')).toBeInTheDocument();
  });
});

/* ================================================================
   EDUCATION PANEL ROUTER
   ================================================================ */
describe('EducationPanelRouter', () => {
  it('routes to missions panel', () => {
    render(<EducationPanelRouter panel="missions" />);
    expect(screen.getByText('🎯 Missions')).toBeInTheDocument();
  });

  it('routes to labs panel', () => {
    render(<EducationPanelRouter panel="labs" />);
    expect(screen.getByText('🔬 Simulation Labs')).toBeInTheDocument();
  });

  it('routes to academy panel', () => {
    render(<EducationPanelRouter panel="academy" />);
    expect(screen.getByText('📚 AI Tutor')).toBeInTheDocument();
  });

  it('routes to achievements panel', () => {
    render(<EducationPanelRouter panel="achievements" />);
    expect(screen.getByText('🏆 Progress')).toBeInTheDocument();
  });

  it('returns null for unknown panel', () => {
    const { container } = render(<EducationPanelRouter panel="unknown" />);
    expect(container.innerHTML).toBe('');
  });

  it('handles rocket launch simulation with fake timers', () => {
    jest.useFakeTimers();
    render(<LabPanel />);
    fireEvent.click(screen.getByText('Rocket Lab'));
    const launchBtn = screen.getByText('🚀 LAUNCH');
    fireEvent.click(launchBtn);
    
    // Advance timers to trigger interval updates inside act
    act(() => {
      jest.advanceTimersByTime(200);
    });
    
    // Check that flight state is active
    expect(screen.getByText('Rocket in flight...')).toBeInTheDocument();
    
    jest.useRealTimers();
  });

  it('suggested topic sends message and advances timers for tutor response', () => {
    jest.useFakeTimers();
    render(<AcademyPanel />);
    fireEvent.click(screen.getByText('How do orbits work?'));
    expect(useUserStore.getState().tutorMessages.length).toBe(1);
    
    // Advance timers for the tutor response inside act
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(useUserStore.getState().tutorMessages.length).toBe(2);
    
    jest.useRealTimers();
  });
});
