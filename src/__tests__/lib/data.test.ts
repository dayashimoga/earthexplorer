import {
  latLonToVec3,
  greatCircleArc,
  getSunPosition,
  orbitalPeriod,
  orbitalVelocity,
  escapeVelocity,
  generateSimulatedAircraft,
  generateSimulatedSatellites,
  updateSatellitePositions,
  MISSIONS,
  ACHIEVEMENTS,
  getAITutorResponse,
} from '@/lib/data';

/* ================================================================
   ORBITAL MECHANICS
   ================================================================ */
describe('latLonToVec3', () => {
  it('converts north pole correctly', () => {
    const [x, y, z] = latLonToVec3(90, 0, 1);
    expect(y).toBeCloseTo(1, 4);
    expect(Math.abs(x)).toBeLessThan(0.001);
    expect(Math.abs(z)).toBeLessThan(0.001);
  });

  it('converts south pole correctly', () => {
    const [x, y, z] = latLonToVec3(-90, 0, 1);
    expect(y).toBeCloseTo(-1, 4);
  });

  it('converts equator/prime meridian', () => {
    const [x, y, z] = latLonToVec3(0, 0, 1);
    expect(Math.abs(y)).toBeLessThan(0.001); // on equator
    expect(Math.sqrt(x * x + z * z)).toBeCloseTo(1, 4); // on unit sphere
  });

  it('respects radius parameter', () => {
    const [x, y, z] = latLonToVec3(90, 0, 5);
    expect(y).toBeCloseTo(5, 4);
  });

  it('handles default radius of 1', () => {
    const [x, y, z] = latLonToVec3(0, 90);
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    expect(magnitude).toBeCloseTo(1, 4);
  });

  it('returns array of 3 numbers', () => {
    const result = latLonToVec3(45, 90, 2);
    expect(result).toHaveLength(3);
    result.forEach(v => expect(typeof v).toBe('number'));
  });
});

describe('greatCircleArc', () => {
  it('returns array of points', () => {
    const arc = greatCircleArc(0, 0, 45, 90);
    expect(arc.length).toBeGreaterThan(0);
    arc.forEach(p => expect(p).toHaveLength(3));
  });

  it('returns specified number of segments + 1 points', () => {
    const segments = 32;
    const arc = greatCircleArc(0, 0, 45, 90, 1, segments);
    expect(arc).toHaveLength(segments + 1);
  });

  it('first and last points are near start and end positions', () => {
    const arc = greatCircleArc(0, 0, 0, 90, 1, 64, 0); // no arc height
    const start = latLonToVec3(0, 0, 1);
    const end = latLonToVec3(0, 90, 1);
    // Start should be close to first point
    expect(arc[0][1]).toBeCloseTo(start[1], 1);
  });

  it('applies arc height', () => {
    const flat = greatCircleArc(0, 0, 0, 90, 1, 32, 0);
    const curved = greatCircleArc(0, 0, 0, 90, 1, 32, 0.5);
    // Midpoint of curved arc should be farther from center
    const midFlat = Math.sqrt(flat[16][0] ** 2 + flat[16][1] ** 2 + flat[16][2] ** 2);
    const midCurved = Math.sqrt(curved[16][0] ** 2 + curved[16][1] ** 2 + curved[16][2] ** 2);
    expect(midCurved).toBeGreaterThan(midFlat);
  });

  it('handles longitude wrapping', () => {
    const arc = greatCircleArc(0, 170, 0, -170);
    expect(arc.length).toBeGreaterThan(0);
    // Should not throw
  });
});

describe('getSunPosition', () => {
  it('returns lat, lon, and direction', () => {
    const sun = getSunPosition();
    expect(sun).toHaveProperty('lat');
    expect(sun).toHaveProperty('lon');
    expect(sun).toHaveProperty('direction');
    expect(sun.direction).toHaveLength(3);
  });

  it('sun latitude is within valid range (-23.45 to 23.45)', () => {
    const sun = getSunPosition(new Date('2024-06-21T12:00:00Z'));
    expect(sun.lat).toBeGreaterThanOrEqual(-24);
    expect(sun.lat).toBeLessThanOrEqual(24);
  });

  it('direction is a unit-sphere point', () => {
    const sun = getSunPosition();
    const mag = Math.sqrt(sun.direction[0] ** 2 + sun.direction[1] ** 2 + sun.direction[2] ** 2);
    expect(mag).toBeCloseTo(1, 2);
  });

  it('accepts date parameter', () => {
    const jan = getSunPosition(new Date('2024-01-01T12:00:00Z'));
    const jun = getSunPosition(new Date('2024-06-21T12:00:00Z'));
    // Sun declination should differ between solstices
    expect(jan.lat).not.toBeCloseTo(jun.lat, 0);
  });
});

describe('orbitalPeriod', () => {
  it('ISS orbit ~92 minutes', () => {
    const period = orbitalPeriod(420);
    expect(period).toBeCloseTo(92.5, 0);
  });

  it('GPS orbit ~718 minutes (12 hours)', () => {
    const period = orbitalPeriod(20200);
    expect(period).toBeCloseTo(718.4, 1);
  });

  it('GEO orbit ~1436 minutes (24 hours)', () => {
    const period = orbitalPeriod(35786);
    expect(period).toBeCloseTo(1435.7, 1);
  });

  it('higher altitude means longer period', () => {
    expect(orbitalPeriod(1000)).toBeLessThan(orbitalPeriod(10000));
  });
});

describe('orbitalVelocity', () => {
  it('ISS velocity ~7.66 km/s', () => {
    const v = orbitalVelocity(420);
    expect(v).toBeCloseTo(7.66, 0);
  });

  it('GEO velocity ~3.07 km/s', () => {
    const v = orbitalVelocity(35786);
    expect(v).toBeCloseTo(3.07, 0);
  });

  it('higher altitude means lower velocity', () => {
    expect(orbitalVelocity(400)).toBeGreaterThan(orbitalVelocity(35786));
  });
});

describe('escapeVelocity', () => {
  it('surface escape velocity ~11.2 km/s', () => {
    const v = escapeVelocity(0);
    expect(v).toBeCloseTo(11.18, 0);
  });

  it('escape velocity = sqrt(2) * orbital velocity', () => {
    const alt = 500;
    const orbV = orbitalVelocity(alt);
    const escV = escapeVelocity(alt);
    expect(escV / orbV).toBeCloseTo(Math.SQRT2, 4);
  });
});

/* ================================================================
   DATA GENERATION
   ================================================================ */
describe('generateSimulatedAircraft', () => {
  it('generates requested count', () => {
    const aircraft = generateSimulatedAircraft(50);
    expect(aircraft).toHaveLength(50);
  });

  it('generates default count of 400', () => {
    const aircraft = generateSimulatedAircraft();
    expect(aircraft).toHaveLength(400);
  });

  it('each aircraft has required properties', () => {
    const aircraft = generateSimulatedAircraft(5);
    for (const ac of aircraft) {
      expect(ac.id).toBeTruthy();
      expect(ac.callsign).toBeTruthy();
      expect(ac.airline).toBeTruthy();
      expect(ac.latitude).toBeGreaterThanOrEqual(-90);
      expect(ac.latitude).toBeLessThanOrEqual(90);
      expect(ac.longitude).toBeGreaterThanOrEqual(-180);
      expect(ac.longitude).toBeLessThanOrEqual(180);
      expect(ac.altitude).toBeGreaterThan(0);
      expect(ac.speed).toBeGreaterThan(0);
      expect(typeof ac.heading).toBe('number');
      expect(ac.aircraftType).toBeTruthy();
      expect(['commercial', 'cargo', 'business', 'helicopter', 'military']).toContain(ac.category);
      expect(ac.origin).toBeTruthy();
      expect(ac.destination).toBeTruthy();
      expect(ac.flightNumber).toBeTruthy();
    }
  });

  it('generates deterministic results (same seed)', () => {
    const a1 = generateSimulatedAircraft(10);
    const a2 = generateSimulatedAircraft(10);
    expect(a1[0].callsign).toBe(a2[0].callsign);
    expect(a1[0].latitude).toBe(a2[0].latitude);
  });

  it('generates unique IDs', () => {
    const aircraft = generateSimulatedAircraft(100);
    const ids = new Set(aircraft.map(a => a.id));
    expect(ids.size).toBe(100);
  });
});

describe('generateSimulatedSatellites', () => {
  it('generates satellites with ISS', () => {
    const sats = generateSimulatedSatellites();
    const iss = sats.find(s => s.category === 'iss');
    expect(iss).toBeDefined();
    expect(iss!.name).toBe('International Space Station');
    expect(iss!.noradId).toBe(25544);
  });

  it('generates Starlink constellation', () => {
    const sats = generateSimulatedSatellites();
    const starlink = sats.filter(s => s.category === 'starlink');
    expect(starlink.length).toBeGreaterThan(50);
  });

  it('generates GPS constellation', () => {
    const sats = generateSimulatedSatellites();
    const gps = sats.filter(s => s.category === 'gps');
    expect(gps.length).toBeGreaterThanOrEqual(24);
  });

  it('each satellite has required properties', () => {
    const sats = generateSimulatedSatellites();
    for (const sat of sats.slice(0, 20)) {
      expect(sat.id).toBeTruthy();
      expect(sat.name).toBeTruthy();
      expect(sat.noradId).toBeGreaterThan(0);
      expect(sat.altitude).toBeGreaterThan(0);
      expect(sat.speed).toBeGreaterThan(0);
      expect(sat.period).toBeGreaterThan(0);
      expect(['LEO', 'MEO', 'GEO', 'HEO', 'SSO']).toContain(sat.orbitType);
    }
  });

  it('generates diverse satellite categories', () => {
    const sats = generateSimulatedSatellites();
    const categories = new Set(sats.map(s => s.category));
    expect(categories.size).toBeGreaterThanOrEqual(6);
  });
});

describe('updateSatellitePositions', () => {
  it('changes satellite positions over time', () => {
    const sats = generateSimulatedSatellites().slice(0, 5);
    const original = sats.map(s => ({ ...s }));
    const updated = updateSatellitePositions(sats, 5000);
    // At least some positions should change
    let changed = false;
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].longitude !== original[i].longitude) changed = true;
    }
    expect(changed).toBe(true);
  });

  it('preserves satellite count', () => {
    const sats = generateSimulatedSatellites().slice(0, 10);
    const updated = updateSatellitePositions(sats, 1000);
    expect(updated).toHaveLength(10);
  });

  it('keeps longitudes in valid range', () => {
    const sats = generateSimulatedSatellites().slice(0, 10);
    const updated = updateSatellitePositions(sats, 60000);
    for (const s of updated) {
      expect(s.longitude).toBeGreaterThanOrEqual(-180);
      expect(s.longitude).toBeLessThanOrEqual(180);
    }
  });
});

/* ================================================================
   MISSIONS & ACHIEVEMENTS
   ================================================================ */
describe('MISSIONS', () => {
  it('has 5 missions', () => {
    expect(MISSIONS).toHaveLength(5);
  });

  it('each mission has required fields', () => {
    for (const mission of MISSIONS) {
      expect(mission.id).toBeTruthy();
      expect(mission.title).toBeTruthy();
      expect(mission.description).toBeTruthy();
      expect(mission.icon).toBeTruthy();
      expect(mission.xpReward).toBeGreaterThan(0);
      expect(mission.steps.length).toBeGreaterThan(0);
      expect(['gps', 'flight', 'satcom', 'rocket', 'space']).toContain(mission.category);
      expect(['beginner', 'intermediate', 'advanced', 'expert']).toContain(mission.difficulty);
    }
  });

  it('quiz steps have correct answers', () => {
    for (const mission of MISSIONS) {
      for (const step of mission.steps) {
        if (step.type === 'quiz') {
          expect(step.quizOptions).toBeDefined();
          expect(step.quizOptions!.length).toBeGreaterThanOrEqual(2);
          expect(step.correctAnswer).toBeDefined();
          expect(step.correctAnswer).toBeGreaterThanOrEqual(0);
          expect(step.correctAnswer).toBeLessThan(step.quizOptions!.length);
        }
      }
    }
  });

  it('covers all 5 categories', () => {
    const categories = new Set(MISSIONS.map(m => m.category));
    expect(categories).toEqual(new Set(['gps', 'flight', 'satcom', 'rocket', 'space']));
  });
});

describe('ACHIEVEMENTS', () => {
  it('has 20 achievements', () => {
    expect(ACHIEVEMENTS).toHaveLength(20);
  });

  it('each achievement has required fields', () => {
    for (const ach of ACHIEVEMENTS) {
      expect(ach.id).toBeTruthy();
      expect(ach.name).toBeTruthy();
      expect(ach.description).toBeTruthy();
      expect(ach.icon).toBeTruthy();
      expect(ach.xpReward).toBeGreaterThan(0);
      expect(['exploration', 'learning', 'discovery', 'mastery', 'social']).toContain(ach.category);
    }
  });

  it('all achievements start locked', () => {
    for (const ach of ACHIEVEMENTS) {
      expect(ach.unlocked).toBe(false);
    }
  });

  it('has unique IDs', () => {
    const ids = new Set(ACHIEVEMENTS.map(a => a.id));
    expect(ids.size).toBe(ACHIEVEMENTS.length);
  });
});

/* ================================================================
   AI TUTOR
   ================================================================ */
describe('getAITutorResponse', () => {
  it('responds to orbit-related queries', () => {
    const resp = getAITutorResponse('How do orbits work?', 'student');
    expect(resp).toBeTruthy();
    expect(resp.length).toBeGreaterThan(20);
  });

  it('responds differently for each mode', () => {
    const kids = getAITutorResponse('Tell me about satellites', 'kids');
    const expert = getAITutorResponse('Tell me about satellites', 'expert');
    expect(kids).not.toBe(expert);
    expect(kids).toContain('🛰️'); // Kids mode uses emojis
  });

  it('handles all tutor modes', () => {
    for (const mode of ['kids', 'student', 'enthusiast', 'expert']) {
      const resp = getAITutorResponse('orbit', mode);
      expect(resp).toBeTruthy();
      expect(resp.length).toBeGreaterThan(10);
    }
  });

  it('handles GPS queries', () => {
    const resp = getAITutorResponse('How does GPS navigation work?', 'student');
    expect(resp.toLowerCase()).toContain('gps');
  });

  it('handles ISS queries', () => {
    const resp = getAITutorResponse('Tell me about the ISS', 'student');
    expect(resp).toBeTruthy();
    expect(resp.length).toBeGreaterThan(20);
  });

  it('handles weather queries', () => {
    const resp = getAITutorResponse('How do weather satellites work?', 'enthusiast');
    expect(resp).toBeTruthy();
  });

  it('handles rocket queries', () => {
    const resp = getAITutorResponse('Tell me about rocket engines', 'expert');
    expect(resp).toBeTruthy();
  });

  it('returns fallback for unknown queries', () => {
    const resp = getAITutorResponse('random gibberish xyzzy', 'student');
    expect(resp).toBeTruthy();
    expect(resp).toContain('expertise');
  });

  it('returns kid-friendly fallback for unknown queries', () => {
    const resp = getAITutorResponse('random gibberish', 'kids');
    expect(resp).toContain('🤔');
  });
});
