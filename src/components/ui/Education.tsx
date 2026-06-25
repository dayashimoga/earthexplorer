'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, useUserStore } from '@/stores/stores';
import { MISSIONS, ACHIEVEMENTS, getAITutorResponse, orbitalPeriod, orbitalVelocity, escapeVelocity } from '@/lib/data';
import type { Mission, MissionStep, TutorMode } from '@/types';

/* ================================================================
   MISSION PANEL
   ================================================================ */
export function MissionPanel() {
  const completedMissions = useUserStore(s => s.completedMissions);
  const activeMissionId = useUserStore(s => s.activeMissionId);
  const activeMissionStep = useUserStore(s => s.activeMissionStep);
  const setActiveMission = useUserStore(s => s.setActiveMission);
  const advanceMissionStep = useUserStore(s => s.advanceMissionStep);
  const completeMission = useUserStore(s => s.completeMission);
  const addXP = useUserStore(s => s.addXP);
  const unlockAchievement = useUserStore(s => s.unlockAchievement);
  const userLevel = useUserStore(s => s.level);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizResult, setQuizResult] = useState<'correct' | 'wrong' | null>(null);

  const activeMission = useMemo(() =>
    MISSIONS.find(m => m.id === activeMissionId), [activeMissionId]);

  const currentStep = activeMission?.steps[activeMissionStep];

  const handleQuizAnswer = (index: number) => {
    if (!currentStep || quizAnswer !== null) return;
    setQuizAnswer(index);
    if (index === currentStep.correctAnswer) {
      setQuizResult('correct');
      addXP(50);
    } else {
      setQuizResult('wrong');
    }
  };

  const handleNextStep = () => {
    if (!activeMission) return;
    setQuizAnswer(null);
    setQuizResult(null);
    if (activeMissionStep >= activeMission.steps.length - 1) {
      completeMission(activeMission.id);
      // Unlock mission-specific achievements
      const achievementMap: Record<string, string> = {
        'gps-101': 'gps-master', 'flight-nav': 'navigator',
        'satcom-101': 'communicator', 'rocket-101': 'rocket-scientist',
        'space-explore': 'deep-space',
      };
      if (achievementMap[activeMission.id]) unlockAchievement(achievementMap[activeMission.id]);
      if (completedMissions.length === 0) unlockAchievement('mission-1');
      if (completedMissions.length === 4) unlockAchievement('mission-5');
    } else {
      advanceMissionStep();
    }
  };

  // Active mission view
  if (activeMission && currentStep) {
    return (
      <div>
        <div className="panel-header">
          <div className="panel-title">{activeMission.icon} {activeMission.title}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-icon" title="Back to List" onClick={() => setActiveMission(null)}>←</button>
            <button className="btn-icon" title="Close Panel" onClick={() => { setActiveMission(null); useAppStore.getState().setActivePanel('none'); }}>✕</button>
          </div>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
            <span>Step {activeMissionStep + 1} of {activeMission.steps.length}</span>
            <span>{Math.round((activeMissionStep + 1) / activeMission.steps.length * 100)}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(activeMissionStep + 1) / activeMission.steps.length * 100}%` }} />
          </div>
        </div>

        {/* Step content */}
        <motion.div key={currentStep.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'rgba(0,212,255,0.15)', color: '#00d4ff', fontWeight: 600, textTransform: 'uppercase' }}>
                {currentStep.type}
              </span>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{currentStep.title}</span>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.8, color: '#cbd5e1' }}>
              {currentStep.content}
            </div>
          </div>

          {/* Quiz */}
          {currentStep.type === 'quiz' && currentStep.quizOptions && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {currentStep.quizOptions.map((option, i) => (
                <button
                  key={i}
                  className="mission-card"
                  style={{
                    textAlign: 'left', cursor: quizAnswer !== null ? 'default' : 'pointer',
                    borderColor: quizAnswer === i
                      ? i === currentStep.correctAnswer ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)'
                      : quizAnswer !== null && i === currentStep.correctAnswer ? 'rgba(16,185,129,0.3)' : undefined,
                    background: quizAnswer === i
                      ? i === currentStep.correctAnswer ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'
                      : undefined,
                  }}
                  onClick={() => handleQuizAnswer(i)}
                >
                  <span style={{ fontSize: 14 }}>{option}</span>
                </button>
              ))}
              {quizResult && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 600,
                    background: quizResult === 'correct' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    color: quizResult === 'correct' ? '#10b981' : '#ef4444',
                    border: `1px solid ${quizResult === 'correct' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  }}>
                  {quizResult === 'correct' ? '✅ Correct! +50 XP' : '❌ Not quite. The correct answer is highlighted above.'}
                </motion.div>
              )}
            </div>
          )}

          {/* Simulation placeholder for interactive steps */}
          {currentStep.type === 'simulation' && currentStep.simulation && (
            <OrbitSimulator config={currentStep.simulation} />
          )}
        </motion.div>

        <button className="btn-primary" style={{ width: '100%' }} onClick={handleNextStep}>
          {activeMissionStep >= activeMission.steps.length - 1 ? '🏆 Complete Mission' : '→ Next Step'}
        </button>
      </div>
    );
  }

  // Mission list
  return (
    <div>
      <div className="panel-header">
        <div className="panel-title">🎯 Missions</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>{completedMissions.length}/{MISSIONS.length}</div>
          <button className="btn-icon" title="Close Panel" onClick={() => useAppStore.getState().setActivePanel('none')}>✕</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {MISSIONS.map(mission => {
          const completed = completedMissions.includes(mission.id);
          const locked = userLevel < mission.unlockLevel;
          return (
            <div
              key={mission.id}
              className={`mission-card ${completed ? '' : 'active'}`}
              style={{ opacity: locked ? 0.5 : 1, cursor: locked ? 'not-allowed' : 'pointer' }}
              onClick={() => !locked && !completed && setActiveMission(mission.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'start' }}>
                  <span style={{ fontSize: 28 }}>{mission.icon}</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: completed ? '#10b981' : '#f1f5f9' }}>
                      {completed ? '✓ ' : locked ? '🔒 ' : ''}{mission.title}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, lineHeight: 1.5 }}>{mission.description}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <span className="rank-badge" style={{ fontSize: 10 }}>{mission.difficulty}</span>
                      <span className="rank-badge" style={{ fontSize: 10, background: 'rgba(0,212,255,0.1)', borderColor: 'rgba(0,212,255,0.3)', color: '#00d4ff' }}>
                        +{mission.xpReward} XP
                      </span>
                      {locked && <span style={{ fontSize: 10, color: '#ef4444' }}>Level {mission.unlockLevel} required</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================
   ORBIT SIMULATOR (used in missions & labs)
   ================================================================ */
function OrbitSimulator({ config }: { config?: any }) {
  const [altitude, setAltitude] = useState(400); // km
  const [eccentricity, setEccentricity] = useState(0.05);
  const [inclination, setInclination] = useState(28.5);

  const period = orbitalPeriod(altitude);
  const velocity = orbitalVelocity(altitude);
  const escape = escapeVelocity(altitude);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Draw grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy);
      ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height);
      ctx.stroke();

      // Earth radius = 6371 km
      // Scale: 6371 km = 35 pixels
      const scale = 35 / 6371;

      // Semi-major axis
      const Rp = 6371 + altitude; // Perigee distance
      const a = Rp / (1 - eccentricity); // Semi-major axis
      const b = a * Math.sqrt(1 - eccentricity * eccentricity);
      const c = a * eccentricity; // focus distance

      const apix = a * scale;
      const bpix = b * scale;
      const cpix = c * scale;

      // Earth is at focus (cx - cpix, cy)
      ctx.beginPath();
      ctx.arc(cx - cpix, cy, 35, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(cx - cpix - 8, cy - 8, 4, cx - cpix, cy, 35);
      grad.addColorStop(0, '#3b82f6');
      grad.addColorStop(1, '#1d4ed8');
      ctx.fillStyle = grad;
      ctx.fill();

      // Draw Orbit line
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, apix, bpix, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Satellite position: True anomaly E
      time += 0.012 * (1 + eccentricity);
      const E = time;
      const satX = cx + apix * Math.cos(E);
      const satY = cy + bpix * Math.sin(E);

      // Draw satellite
      ctx.beginPath();
      ctx.arc(satX, satY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#00d4ff';
      ctx.shadowColor = '#00d4ff';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Labels
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Perigee: ${Math.round(altitude)} km`, 10, 20);
      const Ra = a * (1 + eccentricity) - 6371;
      ctx.fillText(`Apogee:  ${Math.round(Ra)} km`, 10, 34);

      animationFrameId = requestAnimationFrame(render);
    };
    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [altitude, eccentricity]);

  return (
    <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>🔬 Orbit Simulator</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>
            <span>Altitude</span>
            <span style={{ color: '#00d4ff', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{altitude.toLocaleString()} km</span>
          </div>
          <input type="range" min={160} max={36000} value={altitude}
            onChange={e => setAltitude(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#00d4ff' }} />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>
            <span>Eccentricity</span>
            <span style={{ color: '#00d4ff', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{eccentricity.toFixed(2)}</span>
          </div>
          <input type="range" min={0.0} max={0.7} step={0.01} value={eccentricity}
            onChange={e => setEccentricity(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#00d4ff' }} />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>
            <span>Inclination</span>
            <span style={{ color: '#00d4ff', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{inclination.toFixed(1)}°</span>
          </div>
          <input type="range" min={0.0} max={90.0} step={0.5} value={inclination}
            onChange={e => setInclination(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#00d4ff' }} />
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 16 }}>
        <div className="stat-card" style={{ padding: 12 }}>
          <div className="stat-value" style={{ fontSize: 15, color: '#00d4ff' }}>{velocity.toFixed(2)}</div>
          <div className="stat-label" style={{ fontSize: 9 }}>Orbital V (km/s)</div>
        </div>
        <div className="stat-card" style={{ padding: 12 }}>
          <div className="stat-value" style={{ fontSize: 15, color: '#7c3aed' }}>{period.toFixed(1)}</div>
          <div className="stat-label" style={{ fontSize: 9 }}>Period (min)</div>
        </div>
        <div className="stat-card" style={{ padding: 12 }}>
          <div className="stat-value" style={{ fontSize: 15, color: '#f59e0b' }}>{escape.toFixed(2)}</div>
          <div className="stat-label" style={{ fontSize: 9 }}>Escape V (km/s)</div>
        </div>
      </div>

      {/* Visual orbit representation */}
      <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '10px' }}>
        <canvas ref={canvasRef} width={240} height={180} style={{ display: 'block', maxWidth: '100%' }} />
      </div>
    </div>
  );
}

/* ================================================================
   LABS PANEL
   ================================================================ */
export function LabPanel() {
  const [activeLab, setActiveLab] = useState<string | null>(null);
  const addXP = useUserStore(s => s.addXP);
  const unlockAchievement = useUserStore(s => s.unlockAchievement);

  const labs = [
    { id: 'orbit', name: 'Orbit Lab', icon: '🌍', description: 'Change altitude, inclination, and velocity to explore orbital mechanics.' },
    { id: 'flight', name: 'Flight Lab', icon: '✈️', description: 'Adjust aircraft parameters and observe flight dynamics.' },
    { id: 'rocket', name: 'Rocket Lab', icon: '🚀', description: 'Design rocket stages and attempt orbital insertion.' },
    { id: 'weather', name: 'Weather Lab', icon: '🌪️', description: 'Manipulate pressure and temperature to observe weather formation.' },
  ];

  if (activeLab === 'orbit') {
    return (
      <div>
        <div className="panel-header">
          <div className="panel-title">🌍 Orbit Lab</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-icon" title="Back to List" onClick={() => { setActiveLab(null); addXP(25); unlockAchievement('orbit-lab'); }}>←</button>
            <button className="btn-icon" title="Close Panel" onClick={() => useAppStore.getState().setActivePanel('none')}>✕</button>
          </div>
        </div>
        <OrbitSimulator />
        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
            <strong style={{ color: '#f1f5f9' }}>Key Insights:</strong><br/>
            • Lower orbits = faster speeds but more atmospheric drag<br/>
            • GEO at 35,786 km has a period of exactly 24 hours<br/>
            • The ISS at 420 km orbits in ~92 minutes at 7.66 km/s<br/>
            • Escape velocity is always √2 × orbital velocity
          </div>
        </div>
      </div>
    );
  }

  if (activeLab === 'rocket') {
    return <RocketLab onClose={() => setActiveLab(null)} />;
  }

  if (activeLab === 'flight') {
    return <FlightLab onClose={() => { setActiveLab(null); addXP(25); }} />;
  }

  if (activeLab === 'weather') {
    return <WeatherLab onClose={() => { setActiveLab(null); addXP(25); }} />;
  }

  return (
    <div>
      <div className="panel-header">
        <div className="panel-title">🔬 Simulation Labs</div>
        <button className="btn-icon" title="Close Panel" onClick={() => useAppStore.getState().setActivePanel('none')}>✕</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {labs.map(lab => (
          <div key={lab.id} className="mission-card active" onClick={() => setActiveLab(lab.id)}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'start' }}>
              <span style={{ fontSize: 32 }}>{lab.icon}</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{lab.name}</div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>{lab.description}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   FLIGHT LAB
   ================================================================ */
function FlightLab({ onClose }: { onClose: () => void }) {
  const [speed, setSpeed] = useState(250); // m/s
  const [altitude, setAltitude] = useState(10000); // meters
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // Physics calculations
  const airDensity = 1.225 * Math.exp(-altitude / 8500); // exponential atmosphere model
  const machNumber = speed / (340 * Math.sqrt(Math.max(0.1, 1 - altitude / 44000)));
  const liftCoeff = 0.3 + (speed > 100 ? 0.2 : 0);
  const dragForce = 0.5 * airDensity * speed * speed * 0.02 * 150;
  const liftForce = 0.5 * airDensity * speed * speed * liftCoeff * 150;
  const weight = 75000 * 9.81;
  const canFly = liftForce > weight;
  const stallSpeed = Math.sqrt((2 * weight) / (airDensity * liftCoeff * 150));
  const range = (speed / Math.max(1, dragForce / 1000)) * 3600 * 15 / 1000;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width;
    const h = canvas.height;

    // Draw graph axes
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 10); ctx.lineTo(40, h - 30); // Y-axis
    ctx.lineTo(w - 10, h - 30); // X-axis
    ctx.stroke();

    // Draw Stall Boundary curve
    ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
    ctx.beginPath();
    ctx.moveTo(40, h - 30);
    for (let altVal = 0; altVal <= 18000; altVal += 1000) {
      const rho = 1.225 * Math.exp(-altVal / 8500);
      const stallSp = Math.sqrt((2 * weight) / (rho * liftCoeff * 150)) * 3.6; // km/h
      const x = 40 + (stallSp / 1200) * (w - 50);
      const y = h - 30 - (altVal / 18000) * (h - 40);
      if (x < w - 10) ctx.lineTo(x, y);
      else ctx.lineTo(w - 10, y);
    }
    ctx.lineTo(40, 10);
    ctx.closePath();
    ctx.fill();

    // Draw current state dot
    const curX = 40 + ((speed * 3.6) / 1200) * (w - 50);
    const curY = h - 30 - (altitude / 18000) * (h - 40);
    ctx.beginPath();
    ctx.arc(curX, curY, 6, 0, Math.PI * 2);
    ctx.fillStyle = canFly ? '#10b981' : '#ef4444';
    ctx.shadowColor = canFly ? '#10b981' : '#ef4444';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Axis Labels
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '9px sans-serif';
    ctx.fillText("Speed (km/h)", w / 2 - 20, h - 10);
    ctx.save();
    ctx.translate(15, h / 2 - 20);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Altitude (m)", 0, 0);
    ctx.restore();
  }, [speed, altitude, canFly, liftCoeff, weight]);

  return (
    <div>
      <div className="panel-header">
        <div className="panel-title">✈️ Flight Dynamics Lab</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-icon" title="Back to List" onClick={onClose}>←</button>
          <button className="btn-icon" title="Close Panel" onClick={() => useAppStore.getState().setActivePanel('none')}>✕</button>
        </div>
      </div>

      <div className="glass-card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: '#94a3b8' }}>Airspeed</span>
            <span style={{ color: '#00d4ff', fontFamily: 'JetBrains Mono' }}>{Math.round(speed * 3.6)} km/h ({speed} m/s)</span>
          </div>
          <input type="range" min={20} max={340} value={speed} onChange={e => setSpeed(Number(e.target.value))} style={{ width: '100%', accentColor: '#00d4ff' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b' }}>
            <span>72 km/h (taxi)</span><span>1,224 km/h (Mach 1)</span>
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: '#94a3b8' }}>Altitude</span>
            <span style={{ color: '#7c3aed', fontFamily: 'JetBrains Mono' }}>{altitude.toLocaleString()} m (FL{Math.round(altitude * 3.28084 / 100)})</span>
          </div>
          <input type="range" min={0} max={18000} value={altitude} onChange={e => setAltitude(Number(e.target.value))} style={{ width: '100%', accentColor: '#7c3aed' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b' }}>
            <span>Sea level</span><span>18,000 m (FL590)</span>
          </div>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 12 }}>
        <div className="stat-card" style={{ padding: 12 }}>
          <div className="stat-value" style={{ fontSize: 16, color: machNumber > 0.85 ? '#ef4444' : '#00d4ff' }}>{machNumber.toFixed(2)}</div>
          <div className="stat-label" style={{ fontSize: 10 }}>Mach #</div>
        </div>
        <div className="stat-card" style={{ padding: 12 }}>
          <div className="stat-value" style={{ fontSize: 16, color: '#7c3aed' }}>{airDensity.toFixed(3)}</div>
          <div className="stat-label" style={{ fontSize: 10 }}>Air ρ (kg/m³)</div>
        </div>
        <div className="stat-card" style={{ padding: 12 }}>
          <div className="stat-value" style={{ fontSize: 16, color: '#f59e0b' }}>{Math.round(stallSpeed * 3.6)}</div>
          <div className="stat-label" style={{ fontSize: 10 }}>Stall (km/h)</div>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 12 }}>
        <div className="stat-card" style={{ padding: 12 }}>
          <div className="stat-value" style={{ fontSize: 16, color: canFly ? '#10b981' : '#ef4444' }}>{(liftForce / 1000).toFixed(1)} kN</div>
          <div className="stat-label" style={{ fontSize: 10 }}>Lift Force</div>
        </div>
        <div className="stat-card" style={{ padding: 12 }}>
          <div className="stat-value" style={{ fontSize: 16, color: '#ef4444' }}>{(dragForce / 1000).toFixed(1)} kN</div>
          <div className="stat-label" style={{ fontSize: 10 }}>Drag Force</div>
        </div>
      </div>

      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '10px', marginBottom: 12 }}>
        <canvas ref={canvasRef} width={240} height={140} style={{ display: 'block', maxWidth: '100%' }} />
      </div>

      <div className="glass-card" style={{ padding: 12, marginBottom: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: canFly ? '#10b981' : '#ef4444' }}>
          {canFly ? '✅ Flight Sustained — Lift > Weight' : '❌ STALL — Increase speed or decrease altitude'}
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
          Est. range: {Math.round(range).toLocaleString()} km · Weight: {(weight / 1000).toFixed(0)} kN
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   WEATHER LAB
   ================================================================ */
function WeatherLab({ onClose }: { onClose: () => void }) {
  const [pressure, setPressure] = useState(1013); // hPa
  const [temperature, setTemperature] = useState(20); // °C
  const [humidity, setHumidity] = useState(60); // %
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // Physics calculations
  const tempK = temperature + 273.15;
  const airDensity = (pressure * 100) / (287.05 * tempK);
  const dewPoint = temperature - ((100 - humidity) / 5);
  const cloudBase = Math.max(0, (temperature - dewPoint) * 125);
  const satVaporPressure = 6.112 * Math.exp((17.67 * temperature) / (temperature + 243.5));
  const actualVaporPressure = (humidity / 100) * satVaporPressure;
  const isStormRisk = pressure < 1000 && humidity > 80 && temperature > 25;
  const isFogRisk = Math.abs(temperature - dewPoint) < 2.5;
  const windEstimate = Math.max(0, (1013 - pressure) * 2.5);

  const weatherType = pressure < 990 ? '🌀 Tropical Storm Risk'
    : pressure < 1000 && humidity > 80 ? '🌧️ Heavy Rain / Thunderstorm'
    : pressure < 1005 ? '🌦️ Rainy / Overcast'
    : pressure < 1020 ? '⛅ Partly Cloudy'
    : '☀️ Clear / Fair Weather';

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    // Wind Circulation Particles
    const particles: { r: number; angle: number; speed: number }[] = [];
    for (let i = 0; i < 40; i++) {
      particles.push({
        r: 20 + Math.random() * 80,
        angle: Math.random() * Math.PI * 2,
        speed: (0.015 + Math.random() * 0.02) * Math.max(0.1, (1020 - pressure) * 0.08)
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Draw thermal background
      const tNorm = Math.max(0, Math.min(1, (temperature + 30) / 80));
      const bgGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 120);
      bgGrad.addColorStop(0, tNorm > 0.5 ? `rgba(239, 68, 68, ${0.12 * tNorm})` : `rgba(59, 130, 246, ${0.12 * (1 - tNorm)})`);
      bgGrad.addColorStop(1, 'rgba(15, 23, 42, 0.4)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const isLow = pressure < 1013;
      const circDirection = isLow ? -1 : 1;

      particles.forEach(p => {
        p.angle += p.speed * circDirection;
        if (isLow) {
          p.r -= 0.2;
          if (p.r < 8) p.r = 80 + Math.random() * 20;
        } else {
          p.r += 0.2;
          if (p.r > 100) p.r = 10 + Math.random() * 15;
        }

        const x = cx + Math.cos(p.angle) * p.r;
        const y = cy + Math.sin(p.angle) * p.r;

        ctx.beginPath();
        ctx.arc(x, y, 2 + (humidity / 100) * 2, 0, Math.PI * 2);
        ctx.fillStyle = isLow ? 'rgba(0, 212, 255, 0.65)' : 'rgba(245, 158, 11, 0.65)';
        ctx.fill();
      });

      // Center mark
      ctx.fillStyle = isLow ? '#00d4ff' : '#f59e0b';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isLow ? 'L' : 'H', cx, cy);

      animationFrameId = requestAnimationFrame(render);
    };
    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [pressure, temperature, humidity]);

  return (
    <div>
      <div className="panel-header">
        <div className="panel-title">🌪️ Weather Simulation Lab</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-icon" title="Back to List" onClick={onClose}>←</button>
          <button className="btn-icon" title="Close Panel" onClick={() => useAppStore.getState().setActivePanel('none')}>✕</button>
        </div>
      </div>

      <div className="glass-card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: '#94a3b8' }}>Pressure</span>
            <span style={{ color: '#00d4ff', fontFamily: 'JetBrains Mono' }}>{pressure} hPa</span>
          </div>
          <input type="range" min={960} max={1050} value={pressure} onChange={e => setPressure(Number(e.target.value))} style={{ width: '100%', accentColor: '#00d4ff' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b' }}>
            <span>960 hPa (hurricane)</span><span>1050 hPa (strong high)</span>
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: '#94a3b8' }}>Temperature</span>
            <span style={{ color: '#ef4444', fontFamily: 'JetBrains Mono' }}>{temperature}°C ({(temperature * 9/5 + 32).toFixed(0)}°F)</span>
          </div>
          <input type="range" min={-30} max={50} value={temperature} onChange={e => setTemperature(Number(e.target.value))} style={{ width: '100%', accentColor: '#ef4444' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b' }}>
            <span>-30°C (polar)</span><span>50°C (desert)</span>
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: '#94a3b8' }}>Humidity</span>
            <span style={{ color: '#10b981', fontFamily: 'JetBrains Mono' }}>{humidity}%</span>
          </div>
          <input type="range" min={5} max={100} value={humidity} onChange={e => setHumidity(Number(e.target.value))} style={{ width: '100%', accentColor: '#10b981' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b' }}>
            <span>5% (desert)</span><span>100% (saturated)</span>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '10px', marginBottom: 12 }}>
        <canvas ref={canvasRef} width={240} height={140} style={{ display: 'block', maxWidth: '100%' }} />
      </div>

      <div className="glass-card" style={{ padding: 16, textAlign: 'center', marginBottom: 12, background: isStormRisk ? 'rgba(239,68,68,0.1)' : isFogRisk ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)' }}>
        <div style={{ fontSize: 24, marginBottom: 4 }}>{weatherType.split(' ')[0]}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: isStormRisk ? '#ef4444' : isFogRisk ? '#f59e0b' : '#10b981' }}>
          {weatherType.split(' ').slice(1).join(' ')}
        </div>
        {isFogRisk && <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4 }}>⚠️ Fog/Mist likely (Dew point ≈ Temperature)</div>}
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 12 }}>
        <div className="stat-card" style={{ padding: 12 }}>
          <div className="stat-value" style={{ fontSize: 16, color: '#00d4ff' }}>{dewPoint.toFixed(1)}°</div>
          <div className="stat-label" style={{ fontSize: 10 }}>Dew Point</div>
        </div>
        <div className="stat-card" style={{ padding: 12 }}>
          <div className="stat-value" style={{ fontSize: 16, color: '#7c3aed' }}>{cloudBase.toLocaleString()} m</div>
          <div className="stat-label" style={{ fontSize: 10 }}>Cloud Base</div>
        </div>
        <div className="stat-card" style={{ padding: 12 }}>
          <div className="stat-value" style={{ fontSize: 16, color: '#f59e0b' }}>{Math.round(windEstimate)}</div>
          <div className="stat-label" style={{ fontSize: 10 }}>Wind (km/h)</div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   ROCKET LAB
   ================================================================ */
function RocketLab({ onClose }: { onClose: () => void }) {
  const [thrust, setThrust] = useState(70);
  const [angle, setAngle] = useState(80);
  const [fuel, setFuel] = useState(85);
  const [launched, setLaunched] = useState(false);
  const [altitude, setAltitude] = useState(0);
  const [velocity, setVelocity] = useState(0);
  const [downrange, setDownrange] = useState(0);
  const [stagingMsg, setStagingMsg] = useState('Ready for Launch');
  const [flightPath, setFlightPath] = useState<{ x: number; y: number }[]>([]);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const timerRef = React.useRef<any>(null);
  const addXP = useUserStore(s => s.addXP);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (!launched) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width;
    const h = canvas.height;

    // Draw axes
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(35, 10); ctx.lineTo(35, h - 25); ctx.lineTo(w - 10, h - 25);
    ctx.stroke();

    // Plot flight path
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    flightPath.forEach((pt, i) => {
      const px = 35 + (pt.x / 500) * (w - 55);
      const py = h - 25 - (pt.y / 350) * (h - 35);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Target orbit line
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    const targetY = h - 25 - (200 / 350) * (h - 35);
    ctx.moveTo(35, targetY);
    ctx.lineTo(w - 10, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Earth curve at bottom-left corner
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(35, h - 25, 20, 0, Math.PI * 2);
    ctx.fill();

    // Draw current rocket position dot
    if (flightPath.length > 0) {
      const lastPt = flightPath[flightPath.length - 1];
      const px = 35 + (lastPt.x / 500) * (w - 55);
      const py = h - 25 - (lastPt.y / 350) * (h - 35);
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
    }
  }, [flightPath, launched]);

  const handleLaunch = () => {
    setLaunched(true);
    setFlightPath([{ x: 0, y: 0 }]);
    setAltitude(0);
    setVelocity(0);
    setDownrange(0);
    setStagingMsg('Stage 1 Thrusting...');
    
    let alt = 0; let vel = 0; let f = fuel; let dr = 0;
    let stage = 1;
    
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (f > 0) {
        const thrustForce = thrust * 0.16;
        const gravity = 9.81 * Math.pow(6371 / (6371 + alt), 2);
        const angleRad = angle * Math.PI / 180;
        
        if (stage === 1 && f < fuel * 0.5) {
          stage = 2;
          setStagingMsg('Stage 1 Separation — Stage 2 Ignited!');
          addXP(20);
        }

        vel += (thrustForce * Math.sin(angleRad) - gravity) * 0.15;
        alt += vel * 0.15;
        dr += vel * Math.cos(angleRad) * 0.15;
        f -= 0.65;
      } else {
        setStagingMsg('Fuel Depleted — Coasting');
        const gravity = 9.81 * Math.pow(6371 / (6371 + alt), 2);
        vel -= gravity * 0.15;
        alt += vel * 0.15;
        dr += Math.max(0, vel) * 0.05;
      }

      if (alt <= 0 && f <= 0) {
        alt = 0; vel = 0;
        setStagingMsg('Suborbital Crash — Gravity wins!');
        if (timerRef.current) clearInterval(timerRef.current);
      }

      setAltitude(Math.max(0, alt));
      setVelocity(Math.max(0, vel));
      setDownrange(dr);
      setFuel(Math.max(0, f));

      setFlightPath(prev => [...prev, { x: dr, y: alt }]);

      if (alt > 200 && vel > 7.5) {
        setStagingMsg('Orbit Achieved! Stable LEO established.');
        addXP(100);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, 100);
  };

  return (
    <div>
      <div className="panel-header">
        <div className="panel-title">🚀 Rocket Lab</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-icon" title="Back to List" onClick={onClose}>←</button>
          <button className="btn-icon" title="Close Panel" onClick={() => useAppStore.getState().setActivePanel('none')}>✕</button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#ef4444' }}>{altitude.toFixed(1)}</div>
          <div className="stat-label">Altitude (km)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#f59e0b' }}>{velocity.toFixed(2)}</div>
          <div className="stat-label">Velocity (km/s)</div>
        </div>
      </div>

      {!launched && (
        <>
          <div className="glass-card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: '#94a3b8' }}>Thrust</span>
                <span style={{ color: '#00d4ff', fontFamily: 'JetBrains Mono' }}>{thrust}%</span>
              </div>
              <input type="range" min={20} max={100} value={thrust} onChange={e => setThrust(Number(e.target.value))} style={{ width: '100%', accentColor: '#00d4ff' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: '#94a3b8' }}>Launch Angle</span>
                <span style={{ color: '#7c3aed', fontFamily: 'JetBrains Mono' }}>{angle}°</span>
              </div>
              <input type="range" min={30} max={90} value={angle} onChange={e => setAngle(Number(e.target.value))} style={{ width: '100%', accentColor: '#7c3aed' }} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: '#94a3b8' }}>Fuel</span>
                <span style={{ color: '#10b981', fontFamily: 'JetBrains Mono' }}>{fuel}%</span>
              </div>
              <input type="range" min={20} max={100} value={fuel} onChange={e => setFuel(Number(e.target.value))} style={{ width: '100%', accentColor: '#10b981' }} />
            </div>
          </div>

          <button className="btn-primary" style={{ width: '100%' }} onClick={handleLaunch}>
            🚀 LAUNCH
          </button>
        </>
      )}

      {launched && (
        <>
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '10px', marginBottom: 12 }}>
            <canvas ref={canvasRef} width={240} height={140} style={{ display: 'block', maxWidth: '100%' }} />
          </div>
          <div className="glass-card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, textAlign: 'center' }}>
              <div style={{ fontWeight: 700, color: '#00d4ff', marginBottom: 8 }}>{stagingMsg}</div>
              {altitude > 200 && velocity > 7.5 ? (
                <div style={{ color: '#10b981', fontWeight: 700, fontSize: 18 }}>
                  🎉 ORBIT ACHIEVED!<br/>
                  <span style={{ fontSize: 13 }}>+100 XP earned!</span>
                </div>
              ) : altitude === 0 && velocity === 0 ? (
                <div style={{ color: '#ef4444' }}>
                  💥 Launch failed! Adjust parameters and try again.
                  <button className="btn-secondary" style={{ marginTop: 12, width: '100%' }} onClick={() => { setLaunched(false); setFuel(85); }}>
                    Try Again
                  </button>
                </div>
              ) : (
                <div>
                  <span style={{ fontSize: 24 }}>🚀</span><br/>
                  Rocket in flight...
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ================================================================
   AI TUTOR
   ================================================================ */
/* ================================================================
   ACADEMY LESSONS DATABASE
   ================================================================ */
const ACADEMY_LESSONS = [
  {
    id: 'aviation',
    subject: 'Aviation',
    icon: '✈️',
    description: 'Learn about flight dynamics, lift, drag, air density, and altitude.',
    observe: 'Select any active aircraft on the globe to observe its speed, heading, and altitude.',
    interact: 'Track commercial vs cargo flights. Watch their altitude relative to mountains.',
    experiment: 'Open Flight Lab to manipulate velocity and air density to see when lift sustains flight.',
    challenge: 'Try flying at FL410 (41,000 ft) without stalling the aircraft.',
    action: { type: 'panel', target: 'flights' }
  },
  {
    id: 'satellites',
    subject: 'Satellites',
    icon: '🛰️',
    description: 'Explore the different types of satellites orbiting Earth.',
    observe: 'Observe LEO, MEO, and GEO satellites moving at different speeds on the globe.',
    interact: 'Toggle the Starlink constellation to see how low earth orbit megaconstellations cover the earth.',
    experiment: 'Adjust orbital velocity and altitude to see how it affects satellite trajectory.',
    challenge: 'Locate a weather satellite and track it as it passes over your continent.',
    action: { type: 'panel', target: 'satellites' }
  },
  {
    id: 'gps',
    subject: 'GPS',
    icon: '🔵',
    description: 'Understand trilateration and global positioning constellations.',
    observe: 'Look at the MEO orbital band where GPS, Galileo, and GLONASS reside.',
    interact: 'Select a GPS satellite and see its signal coverage footprint on the Earth.',
    experiment: 'Determine how many satellites are visible from a single point for successful trilateration.',
    challenge: 'Unlock the GPS mission in the Mission Control panel.',
    action: { type: 'panel', target: 'missions' }
  },
  {
    id: 'navigation',
    subject: 'Navigation',
    icon: '🧭',
    description: 'Discover how aircraft navigate across great-circle routes.',
    observe: 'Observe how flights follow curved flight path corridors (great circles) rather than straight lines.',
    interact: 'Trace the historical trail and remaining path of a long-haul commercial flight.',
    experiment: 'Compare route length between different cities using the search bar.',
    challenge: 'Search for airport DXB (Dubai) and inspect its heavy arrival/departure traffic.',
    action: { type: 'panel', target: 'flights' }
  },
  {
    id: 'weather',
    subject: 'Weather',
    icon: '🌦️',
    description: 'Study atmospheric pressure, temperature, cloud cover, and winds.',
    observe: 'Toggle cloud layers and temperature maps on the 3D globe.',
    interact: 'Examine pressure vectors and cyclones rotating around the Earth.',
    experiment: 'Use the Weather Lab to simulate a category 5 hurricane by lowering pressure.',
    challenge: 'Analyze pressure patterns on the weather map to locate high-pressure systems.',
    action: { type: 'panel', target: 'weather' }
  },
  {
    id: 'rockets',
    subject: 'Rockets',
    icon: '🚀',
    description: 'Master rocket staging, thrust-to-weight ratio, and orbit insertion.',
    observe: 'Observe how a rocket requires immense velocity to stay in orbit without falling back.',
    interact: 'Simulate thrust controls and flight angle to reach outer space.',
    experiment: 'Open the Rocket Lab to test staging configurations and pitch angles.',
    challenge: 'Reach a stable orbit above 200 km in the Rocket Lab simulator.',
    action: { type: 'panel', target: 'labs' }
  },
  {
    id: 'communications',
    subject: 'Communications',
    icon: '📶',
    description: 'Learn about latency, signal beams, and coverage footprints.',
    observe: 'Watch communications satellites beam signals to ground stations.',
    interact: 'Select a communication satellite to view its active ground coverage cone.',
    experiment: 'Calculate the ground coverage percentage based on satellite altitude.',
    challenge: 'Track an Iridium satellite and view its inclination relative to the equator.',
    action: { type: 'panel', target: 'satellites' }
  },
  {
    id: 'space',
    subject: 'Space Exploration',
    icon: '🧑‍🚀',
    description: 'Track the ISS and explore escape velocity for deep space travel.',
    observe: 'Track the International Space Station in real time in ISS Mode.',
    interact: 'Switch to ISS Chase Cam to view Earth from the station\'s perspective.',
    experiment: 'Compute escape velocity vs orbital velocity in the Orbit Simulator.',
    challenge: 'Calculate the next ISS pass over New York (JFK).',
    action: { type: 'panel', target: 'iss' }
  }
];

/* ================================================================
   AI TUTOR & ACADEMY PANEL
   ================================================================ */
export function AcademyPanel() {
  const [activeTab, setActiveTab] = useState<'lessons' | 'tutor'>('tutor');
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  const tutorMode = useUserStore(s => s.tutorMode);
  const setTutorMode = useUserStore(s => s.setTutorMode);
  const tutorMessages = useUserStore(s => s.tutorMessages);
  const addTutorMessage = useUserStore(s => s.addTutorMessage);
  const addXP = useUserStore(s => s.addXP);
  const unlockAchievement = useUserStore(s => s.unlockAchievement);
  const [input, setInput] = useState('');

  const modes: { id: TutorMode; label: string; icon: string }[] = [
    { id: 'kids', label: 'Kids', icon: '🧒' },
    { id: 'student', label: 'Student', icon: '📖' },
    { id: 'enthusiast', label: 'Enthusiast', icon: '🔭' },
    { id: 'expert', label: 'Expert', icon: '🎓' },
  ];

  const suggestedTopics = ['How do orbits work?', 'Tell me about the ISS', 'How does GPS work?', 'What is escape velocity?', 'How do weather satellites work?', 'Explain rocket staging'];

  const handleSend = (text?: string) => {
    const msg = text || input;
    if (!msg.trim()) return;
    addTutorMessage({ id: Date.now().toString(), role: 'user', content: msg, timestamp: Date.now() });
    const response = getAITutorResponse(msg, tutorMode);
    setTimeout(() => {
      addTutorMessage({
        id: (Date.now() + 1).toString(),
        role: 'tutor',
        content: response.content,
        timestamp: Date.now(),
        globeAction: response.globeAction,
      });

      // Apply globe action if present
      if (response.globeAction) {
        const { command, targetId, targetType, lat, lon } = response.globeAction;
        const appStore = useAppStore.getState();
        if (command === 'fly-to') {
          if (targetType === 'satellite' && targetId) {
            appStore.selectSatellite(targetId);
            if (lat !== undefined && lon !== undefined) {
              appStore.setViewTarget({ lat, lon, entityId: targetId, entityType: 'satellite' });
            }
          } else if (lat !== undefined && lon !== undefined) {
            appStore.setViewTarget({ lat, lon, entityId: targetId, entityType: targetType as any });
          }
        } else if (command === 'highlight') {
          if (targetType === 'satellite' && targetId) {
            appStore.selectSatellite(targetId);
          } else if (targetType === 'aircraft' && targetId) {
            appStore.selectAircraft(targetId);
          }
        } else if (command === 'orbit-view') {
          appStore.setCameraMode('orbit');
          if (!appStore.showOrbits) appStore.toggleLayer('showOrbits');
        }
      }
    }, 500);
    setInput('');
  };

  const selectedLesson = useMemo(() => 
    ACADEMY_LESSONS.find(l => l.id === selectedLessonId), [selectedLessonId]);

  const handleLessonAction = (lesson: typeof ACADEMY_LESSONS[0]) => {
    const appStore = useAppStore.getState();
    if (lesson.action.type === 'panel') {
      appStore.setActivePanel(lesson.action.target as any);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <div className="panel-title">📚 AI Tutor</div>
        <button className="btn-icon" title="Close Panel" onClick={() => useAppStore.getState().setActivePanel('none')}>✕</button>
      </div>

      {/* Main switch between Lessons and AI Tutor */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          className={`btn-secondary ${activeTab === 'lessons' ? 'active' : ''}`}
          style={{ flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700 }}
          onClick={() => setActiveTab('lessons')}
        >
          📖 Lessons
        </button>
        <button
          className={`btn-secondary ${activeTab === 'tutor' ? 'active' : ''}`}
          style={{ flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700 }}
          onClick={() => setActiveTab('tutor')}
        >
          🤖 AI Tutor
        </button>
      </div>

      {activeTab === 'lessons' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!selectedLesson ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ACADEMY_LESSONS.map(lesson => (
                <div
                  key={lesson.id}
                  className="mission-card active"
                  style={{ padding: 14 }}
                  onClick={() => setSelectedLessonId(lesson.id)}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 24 }}>{lesson.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{lesson.subject}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{lesson.description}</div>
                    </div>
                    <span style={{ fontSize: 16 }}>➔</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <button className="btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setSelectedLessonId(null)}>
                  🠔 Back to Lessons
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 20 }}>{selectedLesson.icon}</span>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{selectedLesson.subject}</span>
                </div>
              </div>

              {/* Observe */}
              <div className="glass-card" style={{ padding: 14, marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#00d4ff', textTransform: 'uppercase', marginBottom: 4 }}>1. Observe</div>
                <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 8 }}>{selectedLesson.observe}</div>
                <button className="btn-secondary" style={{ width: '100%', fontSize: 11, padding: '6px' }} onClick={() => handleLessonAction(selectedLesson)}>
                  🔍 Launch View
                </button>
              </div>

              {/* Interact */}
              <div className="glass-card" style={{ padding: 14, marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#ff6b35', textTransform: 'uppercase', marginBottom: 4 }}>2. Interact</div>
                <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 8 }}>{selectedLesson.interact}</div>
                <button className="btn-secondary" style={{ width: '100%', fontSize: 11, padding: '6px' }} onClick={() => handleLessonAction(selectedLesson)}>
                  🛰️ Interact on Globe
                </button>
              </div>

              {/* Experiment */}
              <div className="glass-card" style={{ padding: 14, marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', marginBottom: 4 }}>3. Experiment</div>
                <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 8 }}>{selectedLesson.experiment}</div>
                <button className="btn-secondary" style={{ width: '100%', fontSize: 11, padding: '6px' }} onClick={() => handleLessonAction(selectedLesson)}>
                  🔬 Run Experiment
                </button>
              </div>

              {/* Challenge */}
              <div className="glass-card" style={{ padding: 14, marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#eab308', textTransform: 'uppercase', marginBottom: 4 }}>4. Challenge</div>
                <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5 }}>{selectedLesson.challenge}</div>
              </div>

              {/* Master */}
              <div className="glass-card" style={{ padding: 16, marginBottom: 14, background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', marginBottom: 4 }}>5. Master</div>
                <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 10 }}>Ready to prove you mastered this subject?</div>
                <button className="btn-primary" style={{ width: '100%', background: '#10b981', borderColor: '#10b981' }}
                  onClick={() => {
                    addXP(50);
                    unlockAchievement(`academy-${selectedLesson.id}`);
                    alert(`Congratulations! You mastered ${selectedLesson.subject} and earned +50 XP!`);
                  }}>
                  🏆 Complete Subject
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'tutor' && (
        <>
          {/* Mode selector */}
          <div className="tab-bar" style={{ marginBottom: 10 }}>
            {modes.map(m => (
              <button key={m.id} className={`tab-btn ${tutorMode === m.id ? 'active' : ''}`}
                onClick={() => setTutorMode(m.id)} style={{ fontSize: 12 }}>
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16, minHeight: 200 }}>
            {tutorMessages.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 8 }}>
                  Welcome to the AI Tutor!
                </div>
                <div style={{ fontSize: 13, marginBottom: 16 }}>
                  Ask me anything about space, satellites, aircraft, or orbital mechanics.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {suggestedTopics.map(topic => (
                    <button key={topic} className="btn-secondary" style={{ fontSize: 12, padding: '8px 12px' }}
                      onClick={() => handleSend(topic)}>
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {tutorMessages.map(msg => (
              <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'tutor' ? (
                  <div className="tutor-bubble">{msg.content}</div>
                ) : (
                  <div style={{
                    padding: '10px 16px', borderRadius: '14px 14px 4px 14px',
                    background: 'rgba(0, 212, 255, 0.15)', border: '1px solid rgba(0,212,255,0.2)',
                    maxWidth: '80%', fontSize: 14,
                  }}>
                    {msg.content}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="tutor-input" placeholder="Ask a question..."
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()} />
            <button className="btn-primary" style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}
              onClick={() => handleSend()}>
              Send
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ================================================================
   ACHIEVEMENTS PANEL
   ================================================================ */
export function AchievementPanel() {
  const userAchievements = useUserStore(s => s.achievements);
  const xp = useUserStore(s => s.xp);
  const level = useUserStore(s => s.level);
  const rank = useUserStore(s => s.rank);
  const streak = useUserStore(s => s.streak);
  const totalMissions = useUserStore(s => s.totalMissionsCompleted);
  const completedMissions = useUserStore(s => s.completedMissions);

  const rankProgress = useMemo(() => {
    const thresholds = [0, 500, 1500, 3500, 7000, 12000, 20000];
    let currentThreshold = 0; let nextThreshold = 500;
    for (let i = 0; i < thresholds.length; i++) {
      if (xp >= thresholds[i]) {
        currentThreshold = thresholds[i];
        nextThreshold = thresholds[i + 1] || thresholds[i] + 5000;
      }
    }
    return { current: xp - currentThreshold, total: nextThreshold - currentThreshold, nextRank: nextThreshold };
  }, [xp]);

  return (
    <div>
      <div className="panel-header">
        <div className="panel-title">🏆 Progress</div>
        <button className="btn-icon" title="Close Panel" onClick={() => useAppStore.getState().setActivePanel('none')}>✕</button>
      </div>

      {/* Rank card */}
      <div className="glass-card" style={{ padding: 24, marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>
          {rank === 'Cadet' ? '🎖️' : rank === 'Pilot' ? '✈️' : rank === 'Flight Officer' ? '🎯' : rank === 'Mission Controller' ? '🖥️' : rank === 'Orbital Engineer' ? '🛰️' : rank === 'Astronaut' ? '🧑‍🚀' : '🏗️'}
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit', background: 'linear-gradient(135deg, #f59e0b, #00d4ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {rank}
        </div>
        <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>Level {level}</div>
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
            <span>{xp} XP</span>
            <span>{rankProgress.nextRank} XP</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(rankProgress.current / rankProgress.total) * 100}%`, background: 'linear-gradient(90deg, #f59e0b, #00d4ff)' }} />
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#f59e0b' }}>{xp.toLocaleString()}</div>
          <div className="stat-label">Total XP</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#10b981' }}>{streak}</div>
          <div className="stat-label">Day Streak</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#00d4ff' }}>{totalMissions}</div>
          <div className="stat-label">Missions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#7c3aed' }}>{userAchievements.length}</div>
          <div className="stat-label">Achievements</div>
        </div>
      </div>

      {/* Achievements list */}
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>🏅 Achievements ({userAchievements.length}/{ACHIEVEMENTS.length})</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ACHIEVEMENTS.map(ach => {
          const unlocked = userAchievements.includes(ach.id);
          return (
            <div key={ach.id} className="glass-card" style={{
              padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
              opacity: unlocked ? 1 : 0.4,
            }}>
              <span style={{ fontSize: 24, filter: unlocked ? 'none' : 'grayscale(1)' }}>{ach.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{ach.name}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{ach.description}</div>
              </div>
              <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>+{ach.xpReward}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================
   EDUCATION PANEL ROUTER (combines missions/labs/academy/achievements)
   ================================================================ */
export function EducationPanelRouter({ panel }: { panel: string }) {
  switch (panel) {
    case 'missions': return <MissionPanel />;
    case 'labs': return <LabPanel />;
    case 'academy': return <AcademyPanel />;
    case 'achievements': return <AchievementPanel />;
    default: return null;
  }
}
