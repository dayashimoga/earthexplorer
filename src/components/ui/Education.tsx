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
          <button className="btn-icon" onClick={() => setActiveMission(null)}>✕</button>
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
        <div style={{ fontSize: 13, color: '#94a3b8' }}>{completedMissions.length}/{MISSIONS.length}</div>
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
  const [altitude, setAltitude] = useState(400);
  const period = orbitalPeriod(altitude);
  const velocity = orbitalVelocity(altitude);
  const escape = escapeVelocity(altitude);

  return (
    <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>🔬 Orbit Simulator</div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
          <span>Altitude</span>
          <span style={{ color: '#00d4ff', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{altitude.toLocaleString()} km</span>
        </div>
        <input type="range" min={160} max={40000} value={altitude}
          onChange={e => setAltitude(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#00d4ff' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b' }}>
          <span>160 km (LEO min)</span><span>35,786 km (GEO)</span>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div className="stat-card" style={{ padding: 12 }}>
          <div className="stat-value" style={{ fontSize: 18, color: '#00d4ff' }}>{velocity.toFixed(2)}</div>
          <div className="stat-label" style={{ fontSize: 10 }}>Orbital V (km/s)</div>
        </div>
        <div className="stat-card" style={{ padding: 12 }}>
          <div className="stat-value" style={{ fontSize: 18, color: '#7c3aed' }}>{period.toFixed(1)}</div>
          <div className="stat-label" style={{ fontSize: 10 }}>Period (min)</div>
        </div>
        <div className="stat-card" style={{ padding: 12 }}>
          <div className="stat-value" style={{ fontSize: 18, color: '#f59e0b' }}>{escape.toFixed(2)}</div>
          <div className="stat-label" style={{ fontSize: 10 }}>Escape V (km/s)</div>
        </div>
      </div>

      {/* Visual orbit representation */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1', marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          position: 'absolute', width: '40%', height: '40%', borderRadius: '50%',
          background: 'linear-gradient(135deg, #1a6fb5, #1b8f5a)',
          boxShadow: '0 0 20px rgba(0,140,255,0.3)',
        }} />
        <div style={{
          position: 'absolute',
          width: `${40 + (altitude / 40000) * 50}%`,
          height: `${40 + (altitude / 40000) * 50}%`,
          borderRadius: '50%', border: '2px solid rgba(0,212,255,0.3)',
          animation: `orbit ${Math.max(1, period / 30)}s linear infinite`,
        }}>
          <div style={{
            position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)',
            width: 8, height: 8, borderRadius: '50%', background: '#00d4ff',
            boxShadow: '0 0 8px #00d4ff',
          }} />
        </div>
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
          <button className="btn-icon" onClick={() => { setActiveLab(null); addXP(25); unlockAchievement('orbit-lab'); }}>✕</button>
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

  return (
    <div>
      <div className="panel-header">
        <div className="panel-title">🔬 Simulation Labs</div>
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
   ROCKET LAB
   ================================================================ */
function RocketLab({ onClose }: { onClose: () => void }) {
  const [thrust, setThrust] = useState(70);
  const [angle, setAngle] = useState(80);
  const [fuel, setFuel] = useState(85);
  const [launched, setLaunched] = useState(false);
  const [altitude, setAltitude] = useState(0);
  const [velocity, setVelocity] = useState(0);
  const addXP = useUserStore(s => s.addXP);

  const handleLaunch = () => {
    setLaunched(true);
    let alt = 0; let vel = 0; let f = fuel;
    const interval = setInterval(() => {
      if (f > 0) {
        const thrustForce = thrust * 0.15;
        const gravity = 9.81 * Math.pow(6371 / (6371 + alt), 2);
        const angleRad = angle * Math.PI / 180;
        vel += (thrustForce * Math.sin(angleRad) - gravity) * 0.1;
        alt += vel * 0.1;
        f -= 0.5;
      } else {
        const gravity = 9.81 * Math.pow(6371 / (6371 + alt), 2);
        vel -= gravity * 0.1;
        alt += vel * 0.1;
      }
      if (alt < 0) { alt = 0; vel = 0; clearInterval(interval); }
      setAltitude(Math.max(0, alt));
      setVelocity(vel);
      setFuel(Math.max(0, f));
      if (alt > 200 && vel > 5) {
        addXP(100);
        clearInterval(interval);
      }
    }, 100);
  };

  return (
    <div>
      <div className="panel-header">
        <div className="panel-title">🚀 Rocket Lab</div>
        <button className="btn-icon" onClick={onClose}>✕</button>
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
        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
            {altitude > 200 && velocity > 5 ? (
              <div style={{ color: '#10b981', fontWeight: 700, fontSize: 18, textAlign: 'center' }}>
                🎉 ORBIT ACHIEVED!<br/>
                <span style={{ fontSize: 13 }}>+100 XP earned!</span>
              </div>
            ) : altitude === 0 && velocity === 0 ? (
              <div style={{ color: '#ef4444', textAlign: 'center' }}>
                💥 Launch failed! Adjust parameters and try again.
                <button className="btn-secondary" style={{ marginTop: 12, width: '100%' }} onClick={() => { setLaunched(false); setFuel(85); }}>
                  Try Again
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 24 }}>🚀</span><br/>
                Rocket in flight...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   AI TUTOR
   ================================================================ */
export function AcademyPanel() {
  const tutorMode = useUserStore(s => s.tutorMode);
  const setTutorMode = useUserStore(s => s.setTutorMode);
  const tutorMessages = useUserStore(s => s.tutorMessages);
  const addTutorMessage = useUserStore(s => s.addTutorMessage);
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
      addTutorMessage({ id: (Date.now() + 1).toString(), role: 'tutor', content: response, timestamp: Date.now() });
    }, 500);
    setInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <div className="panel-title">📚 AI Tutor</div>
      </div>

      {/* Mode selector */}
      <div className="tab-bar">
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
