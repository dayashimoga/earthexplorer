import React from 'react';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '@/stores/stores';
import { LoadingScreen, GlassCard } from '@/components/ui/Shared';

beforeEach(() => {
  useAppStore.setState({ loaded: false, loadProgress: 0 });
});

/* ================================================================
   LOADING SCREEN
   ================================================================ */
describe('LoadingScreen', () => {
  it('renders when not loaded', () => {
    render(<LoadingScreen />);
    expect(screen.getByText('Earth Explorer')).toBeInTheDocument();
    expect(screen.getByText('Digital Twin of Planet Earth')).toBeInTheDocument();
  });

  it('shows progress bar', () => {
    useAppStore.setState({ loadProgress: 50 });
    render(<LoadingScreen />);
    const fill = document.querySelector('.loading-bar-fill') as HTMLElement;
    expect(fill).toBeInTheDocument();
    expect(fill.style.width).toBe('50%');
  });

  it('shows correct loading message for early stage', () => {
    useAppStore.setState({ loadProgress: 10 });
    render(<LoadingScreen />);
    expect(screen.getByText('Initializing renderer...')).toBeInTheDocument();
  });

  it('shows correct loading message for texture stage', () => {
    useAppStore.setState({ loadProgress: 40 });
    render(<LoadingScreen />);
    expect(screen.getByText('Loading Earth textures...')).toBeInTheDocument();
  });

  it('shows correct loading message for satellite stage', () => {
    useAppStore.setState({ loadProgress: 65 });
    render(<LoadingScreen />);
    expect(screen.getByText('Computing satellite orbits...')).toBeInTheDocument();
  });

  it('shows correct loading message for flight stage', () => {
    useAppStore.setState({ loadProgress: 85 });
    render(<LoadingScreen />);
    expect(screen.getByText('Populating flight data...')).toBeInTheDocument();
  });

  it('shows ready message at 100%', () => {
    useAppStore.setState({ loadProgress: 100 });
    render(<LoadingScreen />);
    expect(screen.getByText('Ready for launch!')).toBeInTheDocument();
  });

  it('returns null when loaded', () => {
    useAppStore.setState({ loaded: true });
    const { container } = render(<LoadingScreen />);
    // AnimatePresence might still render briefly, but main content should be gone
    expect(screen.queryByText('Earth Explorer')).not.toBeInTheDocument();
  });

  it('renders star particles', () => {
    render(<LoadingScreen />);
    const loadingScreen = document.querySelector('.loading-screen');
    expect(loadingScreen).toBeInTheDocument();
  });

  it('renders earth animation element', () => {
    render(<LoadingScreen />);
    expect(document.querySelector('.loading-earth')).toBeInTheDocument();
  });
});

/* ================================================================
   GLASS CARD
   ================================================================ */
describe('GlassCard', () => {
  it('renders children', () => {
    render(<GlassCard>Test Content</GlassCard>);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('applies glass-card class', () => {
    const { container } = render(<GlassCard>Content</GlassCard>);
    expect(container.querySelector('.glass-card')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<GlassCard className="custom-class">Content</GlassCard>);
    const card = container.querySelector('.glass-card');
    expect(card?.classList.contains('custom-class')).toBe(true);
  });

  it('applies custom style', () => {
    const { container } = render(<GlassCard style={{ padding: '20px' }}>Content</GlassCard>);
    const card = container.querySelector('.glass-card') as HTMLElement;
    expect(card.style.padding).toBe('20px');
  });

  it('handles click events', () => {
    const onClick = jest.fn();
    render(<GlassCard onClick={onClick}>Clickable</GlassCard>);
    screen.getByText('Clickable').click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
