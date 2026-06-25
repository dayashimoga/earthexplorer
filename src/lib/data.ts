import type { Aircraft, Satellite, SatelliteCategory, Mission, Achievement, AirportTraffic, FlightSchedule } from '@/types';

/* ================================================================
   ORBITAL MECHANICS — satellite.js wrapper + physics utilities
   ================================================================ */

// Lat/Lon/Alt to 3D cartesian (unit sphere, Y-up)
export function latLonToVec3(lat: number, lon: number, radius: number = 1): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return [x, y, z];
}

// Great circle arc between two points (returns array of [x,y,z])
export function greatCircleArc(
  lat1: number, lon1: number, lat2: number, lon2: number,
  radius: number = 1.001, segments: number = 64, arcHeight: number = 0.04
): [number, number, number][] {
  const points: [number, number, number][] = [];
  const p1 = latLonToVec3(lat1, lon1, radius);
  const p2 = latLonToVec3(lat2, lon2, radius);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const sinT = Math.sin(t * Math.PI);
    const r = radius + arcHeight * sinT;
    // Spherical linear interpolation
    const lat = lat1 + (lat2 - lat1) * t;
    const lon = lon1 + (lon2 - lon1) * t;
    // Handle longitude wrapping
    let dLon = lon2 - lon1;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    const interpLon = lon1 + dLon * t;
    points.push(latLonToVec3(lat, interpLon, r));
  }
  return points;
}

// Sun position based on current time (simplified)
export function getSunPosition(date: Date = new Date()): { lat: number; lon: number; direction: [number, number, number] } {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  const declination = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * Math.PI / 180);
  const hourAngle = ((date.getUTCHours() + date.getUTCMinutes() / 60) / 24 * 360) - 180;
  const sunLat = declination;
  const sunLon = -hourAngle;
  const dir = latLonToVec3(sunLat, sunLon, 1);
  return { lat: sunLat, lon: sunLon, direction: dir };
}

// Calculate orbital period from altitude (km)
export function orbitalPeriod(altitudeKm: number): number {
  const R = 6371 + altitudeKm; // Earth radius + altitude
  const mu = 398600.4418; // GM of Earth (km³/s²)
  return 2 * Math.PI * Math.sqrt(Math.pow(R, 3) / mu) / 60; // minutes
}

// Orbital velocity from altitude (km)
export function orbitalVelocity(altitudeKm: number): number {
  const R = (6371 + altitudeKm) * 1000; // meters
  const mu = 3.986004418e14; // m³/s²
  return Math.sqrt(mu / R) / 1000; // km/s
}

// Escape velocity from altitude (km)
export function escapeVelocity(altitudeKm: number): number {
  return orbitalVelocity(altitudeKm) * Math.sqrt(2);
}

// Calculate coverage percentage of Earth visible
export function calculateCoverage(altitudeKm: number): number {
  const R = 6371; // Earth radius in km
  return (altitudeKm / (2 * (R + altitudeKm))) * 100;
}

// Calculate simulated next pass relative to airport
export function getNextPassTime(satId: string, airportCode: string): string {
  const seed = satId.charCodeAt(0) + airportCode.charCodeAt(0);
  const minutes = (seed * 7) % 55 + 5;
  return `${minutes}m`;
}

// Generate schedule details for selected airport
export function generateAirportTraffic(airportCode: string): AirportTraffic {
  const airport = AIRPORTS[airportCode];
  if (!airport) {
    return { code: airportCode, name: 'Unknown', lat: 0, lon: 0, departures: [], arrivals: [], trafficScore: 0 };
  }
  const seed = airportCode.charCodeAt(0) + airportCode.charCodeAt(1);
  const trafficScore = (seed * 3) % 40 + 50; // 50 to 90
  const flightNumbers = ['AA', 'BA', 'LH', 'EK', 'SQ', 'QF', 'NH', 'AF', 'CX', 'JL'];
  const statuses: FlightSchedule['status'][] = ['scheduled', 'delayed', 'departed', 'landed'];
  const departures: FlightSchedule[] = [];
  const arrivals: FlightSchedule[] = [];
  const airportKeys = Object.keys(AIRPORTS).filter(k => k !== airportCode);

  for (let i = 0; i < 5; i++) {
    const depIdx = (seed + i) % flightNumbers.length;
    const destKey = airportKeys[(seed + i) % airportKeys.length];
    const destAirport = AIRPORTS[destKey];
    const hour = (9 + i * 2) % 24;
    const min = (15 + i * 10) % 60;
    
    departures.push({
      flightNumber: `${flightNumbers[depIdx]}${(seed * i + 100) % 900 + 100}`,
      airline: flightNumbers[depIdx] === 'AA' ? 'American Airlines' :
               flightNumbers[depIdx] === 'BA' ? 'British Airways' :
               flightNumbers[depIdx] === 'LH' ? 'Lufthansa' :
               flightNumbers[depIdx] === 'EK' ? 'Emirates' : 'Singapore Airlines',
      time: `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`,
      destination: `${destKey} - ${destAirport.name}`,
      status: statuses[(seed + i) % statuses.length],
    });

    const arrIdx = (seed - i + 10) % flightNumbers.length;
    const origKey = airportKeys[(seed - i + 10) % airportKeys.length];
    const origAirport = AIRPORTS[origKey];
    const arrHour = (10 + i * 2) % 24;
    const arrMin = (20 + i * 10) % 60;
    
    arrivals.push({
      flightNumber: `${flightNumbers[arrIdx]}${(seed * (i + 1) * 3 + 120) % 900 + 100}`,
      airline: flightNumbers[arrIdx] === 'AA' ? 'American Airlines' :
               flightNumbers[arrIdx] === 'BA' ? 'British Airways' :
               flightNumbers[arrIdx] === 'LH' ? 'Lufthansa' :
               flightNumbers[arrIdx] === 'EK' ? 'Emirates' : 'Singapore Airlines',
      time: `${arrHour.toString().padStart(2, '0')}:${arrMin.toString().padStart(2, '0')}`,
      origin: `${origKey} - ${origAirport.name}`,
      status: statuses[(seed - i + 5) % statuses.length],
    });
  }

  return {
    code: airportCode,
    name: airport.name,
    lat: airport.lat,
    lon: airport.lon,
    departures,
    arrivals,
    trafficScore,
  };
}

/* ================================================================
   SIMULATED AIRCRAFT DATA
   ================================================================ */

const AIRLINES = [
  { code: 'AAL', name: 'American Airlines', type: 'commercial' },
  { code: 'BAW', name: 'British Airways', type: 'commercial' },
  { code: 'DLH', name: 'Lufthansa', type: 'commercial' },
  { code: 'UAE', name: 'Emirates', type: 'commercial' },
  { code: 'SIA', name: 'Singapore Airlines', type: 'commercial' },
  { code: 'QFA', name: 'Qantas', type: 'commercial' },
  { code: 'ANA', name: 'ANA', type: 'commercial' },
  { code: 'AFR', name: 'Air France', type: 'commercial' },
  { code: 'CPA', name: 'Cathay Pacific', type: 'commercial' },
  { code: 'JAL', name: 'Japan Airlines', type: 'commercial' },
  { code: 'FDX', name: 'FedEx', type: 'cargo' },
  { code: 'UPS', name: 'UPS Airlines', type: 'cargo' },
  { code: 'GTI', name: 'Atlas Air', type: 'cargo' },
  { code: 'NJE', name: 'NetJets', type: 'business' },
  { code: 'VJT', name: 'VistaJet', type: 'business' },
];

export const AIRPORTS: Record<string, { lat: number; lon: number; name: string }> = {
  JFK: { lat: 40.6413, lon: -73.7781, name: 'New York JFK' },
  LAX: { lat: 33.9425, lon: -118.4081, name: 'Los Angeles' },
  LHR: { lat: 51.4700, lon: -0.4543, name: 'London Heathrow' },
  CDG: { lat: 49.0097, lon: 2.5479, name: 'Paris CDG' },
  DXB: { lat: 25.2532, lon: 55.3657, name: 'Dubai' },
  SIN: { lat: 1.3644, lon: 103.9915, name: 'Singapore Changi' },
  HND: { lat: 35.5494, lon: 139.7798, name: 'Tokyo Haneda' },
  SYD: { lat: -33.9461, lon: 151.1772, name: 'Sydney' },
  FRA: { lat: 50.0379, lon: 8.5622, name: 'Frankfurt' },
  PEK: { lat: 40.0799, lon: 116.6031, name: 'Beijing Capital' },
  ORD: { lat: 41.9742, lon: -87.9073, name: 'Chicago O\'Hare' },
  ATL: { lat: 33.6407, lon: -84.4277, name: 'Atlanta' },
  ICN: { lat: 37.4602, lon: 126.4407, name: 'Seoul Incheon' },
  DEL: { lat: 28.5562, lon: 77.1000, name: 'Delhi' },
  GRU: { lat: -23.4356, lon: -46.4731, name: 'São Paulo' },
  JNB: { lat: -26.1392, lon: 28.2460, name: 'Johannesburg' },
  DOH: { lat: 25.2731, lon: 51.6081, name: 'Doha' },
  IST: { lat: 41.2753, lon: 28.7519, name: 'Istanbul' },
  MEX: { lat: 19.4363, lon: -99.0721, name: 'Mexico City' },
  MIA: { lat: 25.7959, lon: -80.2870, name: 'Miami' },
};

const AIRCRAFT_TYPES = ['B737', 'B747', 'B777', 'B787', 'A320', 'A330', 'A350', 'A380', 'E190', 'CRJ9'];

let flightSeed = 42;
function seededRandom(): number {
  flightSeed = (flightSeed * 16807 + 0) % 2147483647;
  return flightSeed / 2147483647;
}

export function generateSimulatedAircraft(count: number = 400): Aircraft[] {
  flightSeed = 42;
  const aircraft: Aircraft[] = [];
  const airportKeys = Object.keys(AIRPORTS);

  for (let i = 0; i < count; i++) {
    const airline = AIRLINES[Math.floor(seededRandom() * AIRLINES.length)];
    const originKey = airportKeys[Math.floor(seededRandom() * airportKeys.length)];
    let destKey = airportKeys[Math.floor(seededRandom() * airportKeys.length)];
    while (destKey === originKey) destKey = airportKeys[Math.floor(seededRandom() * airportKeys.length)];

    const origin = AIRPORTS[originKey];
    const dest = AIRPORTS[destKey];
    const progress = seededRandom();

    // Interpolate position along great circle
    let dLon = dest.lon - origin.lon;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    const lat = origin.lat + (dest.lat - origin.lat) * progress;
    const lon = origin.lon + dLon * progress;

    const altitude = 9000 + seededRandom() * 4000; // 9000-13000m
    const speed = 220 + seededRandom() * 60; // 220-280 m/s
    const heading = Math.atan2(dLon, dest.lat - origin.lat) * 180 / Math.PI;

    aircraft.push({
      id: `AC${i.toString().padStart(4, '0')}`,
      callsign: `${airline.code}${Math.floor(seededRandom() * 9000 + 1000)}`,
      flightNumber: `${airline.code.substring(0, 2)}${Math.floor(seededRandom() * 900 + 100)}`,
      airline: airline.name,
      origin: `${originKey} - ${origin.name}`,
      destination: `${destKey} - ${dest.name}`,
      latitude: lat + (seededRandom() - 0.5) * 2,
      longitude: lon + (seededRandom() - 0.5) * 2,
      altitude,
      speed,
      heading: ((heading % 360) + 360) % 360,
      verticalRate: (seededRandom() - 0.5) * 5,
      aircraftType: AIRCRAFT_TYPES[Math.floor(seededRandom() * AIRCRAFT_TYPES.length)],
      category: airline.type as Aircraft['category'],
      onGround: false,
      lastUpdate: Date.now(),
      trail: [],
    });
  }
  return aircraft;
}

/* ================================================================
   SIMULATED SATELLITE DATA
   ================================================================ */

interface SatConstellation {
  name: string; category: SatelliteCategory; count: number;
  altRange: [number, number]; incRange: [number, number]; orbitType: Satellite['orbitType'];
}

const CONSTELLATIONS: SatConstellation[] = [
  { name: 'Starlink', category: 'starlink', count: 200, altRange: [540, 570], incRange: [53, 53], orbitType: 'LEO' },
  { name: 'GPS', category: 'gps', count: 31, altRange: [20180, 20220], incRange: [55, 55], orbitType: 'MEO' },
  { name: 'Galileo', category: 'galileo', count: 24, altRange: [23222, 23222], incRange: [56, 56], orbitType: 'MEO' },
  { name: 'GLONASS', category: 'glonass', count: 24, altRange: [19130, 19130], incRange: [64.8, 64.8], orbitType: 'MEO' },
  { name: 'Iridium', category: 'communication', count: 66, altRange: [780, 780], incRange: [86.4, 86.4], orbitType: 'LEO' },
  { name: 'GOES', category: 'weather', count: 4, altRange: [35786, 35786], incRange: [0, 0.1], orbitType: 'GEO' },
  { name: 'Landsat', category: 'earth-observation', count: 3, altRange: [705, 710], incRange: [98.2, 98.2], orbitType: 'SSO' },
  { name: 'Hubble', category: 'scientific', count: 1, altRange: [540, 540], incRange: [28.5, 28.5], orbitType: 'LEO' },
];

export function generateSimulatedSatellites(): Satellite[] {
  const satellites: Satellite[] = [];
  let satSeed = 123;
  function sRand() { satSeed = (satSeed * 16807) % 2147483647; return satSeed / 2147483647; }

  // ISS
  const issTime = Date.now() / 1000;
  const issLon = ((issTime * 0.0667) % 360) - 180; // ~orbit period 92min
  const issLat = 51.6 * Math.sin(issTime * 0.0011); // inclination 51.6°
  satellites.push({
    id: 'ISS', name: 'International Space Station', noradId: 25544,
    category: 'iss', latitude: issLat, longitude: issLon,
    altitude: 420, speed: 7.66, inclination: 51.6, period: 92,
    orbitType: 'LEO', tle1: '', tle2: '', visible: true,
  });

  for (const c of CONSTELLATIONS) {
    for (let i = 0; i < c.count; i++) {
      const alt = c.altRange[0] + sRand() * (c.altRange[1] - c.altRange[0]);
      const inc = c.incRange[0] + sRand() * (c.incRange[1] - c.incRange[0]);
      const phase = sRand() * 360;
      const raan = (i / c.count) * 360;
      const t = Date.now() / 1000;
      const period = orbitalPeriod(alt);
      const angularVel = 360 / (period * 60); // deg/s
      const trueAnomaly = (phase + angularVel * t) % 360;
      const lat = inc * Math.sin(trueAnomaly * Math.PI / 180);
      const lon = (raan + trueAnomaly - (t * 0.00417)) % 360 - 180;

      satellites.push({
        id: `${c.name.toUpperCase().replace(/\s/g, '')}-${i}`,
        name: `${c.name}-${i + 1}`,
        noradId: 40000 + satellites.length,
        category: c.category, latitude: lat, longitude: lon,
        altitude: alt, speed: orbitalVelocity(alt),
        inclination: inc, period, orbitType: c.orbitType,
        tle1: '', tle2: '', visible: true,
        phase, raan,
      });
    }
  }
  return satellites;
}

// Update satellite positions based on time
export function updateSatellitePositions(satellites: Satellite[], deltaMs: number): Satellite[] {
  const t = Date.now() / 1000;
  return satellites.map(sat => {
    let lat = sat.latitude;
    let lon = sat.longitude;
    
    if (sat.category === 'iss') {
      lon = ((t * 0.0667) % 360) - 180;
      lat = 51.6 * Math.sin(t * 0.0011);
    } else if (sat.phase !== undefined && sat.raan !== undefined) {
      const angularVel = 360 / (sat.period * 60); // deg/s
      const trueAnomaly = (sat.phase + angularVel * t) % 360;
      lat = sat.inclination * Math.sin(trueAnomaly * Math.PI / 180);
      let wrappedLon = (sat.raan + trueAnomaly - (t * 0.00417)) % 360;
      if (wrappedLon > 180) wrappedLon -= 360;
      if (wrappedLon < -180) wrappedLon += 360;
      lon = wrappedLon;
    }
    return { ...sat, latitude: lat, longitude: lon };
  });
}

/* ================================================================
   MISSIONS
   ================================================================ */

export const MISSIONS: Mission[] = [
  {
    id: 'gps-101', title: 'How GPS Works', icon: '📡',
    description: 'Learn how GPS satellites determine your exact position on Earth using trilateration.',
    category: 'gps', difficulty: 'beginner', xpReward: 250, unlockLevel: 1,
    steps: [
      { id: 'g1', title: 'The GPS Constellation', type: 'info', description: 'GPS overview',
        content: 'The Global Positioning System consists of 31 satellites orbiting at 20,200 km altitude. At least 4 satellites are visible from any point on Earth at any time. Each satellite broadcasts precise time signals using atomic clocks accurate to 1 nanosecond.' },
      { id: 'g2', title: 'Signal Travel Time', type: 'info', description: 'Signal propagation',
        content: 'GPS signals travel at the speed of light (299,792 km/s). By measuring the time difference between when a signal was sent and received, your GPS receiver calculates the distance to each satellite. A signal from a satellite 20,200 km away takes about 67 milliseconds to reach Earth.' },
      { id: 'g3', title: 'Trilateration', type: 'interaction', description: 'Interactive trilateration',
        content: 'With ONE satellite, you know you\'re somewhere on a sphere around it. With TWO satellites, you\'re on a circle where the spheres intersect. With THREE satellites, you get two possible points. With FOUR satellites, you get your exact 3D position + time correction.' },
      { id: 'g4', title: 'GPS Quiz', type: 'quiz', description: 'Test your knowledge',
        content: 'How many GPS satellites are needed for a precise 3D position fix?',
        quizOptions: ['2 satellites', '3 satellites', '4 satellites', '6 satellites'], correctAnswer: 2 },
      { id: 'g5', title: 'Position Calculation', type: 'simulation', description: 'Calculate position',
        content: 'Adjust the satellite distances to triangulate a position on the globe. Watch how changing each distance affects the calculated position.',
        simulation: { type: 'orbit', params: { altitude: 20200, count: 4 } } },
    ],
  },
  {
    id: 'flight-nav', title: 'Flight Navigation', icon: '✈️',
    description: 'Master the art of aerial navigation — great-circle routes, air corridors, and weather avoidance.',
    category: 'flight', difficulty: 'intermediate', xpReward: 300, unlockLevel: 3,
    steps: [
      { id: 'f1', title: 'Great Circle Routes', type: 'info', description: 'Why planes don\'t fly straight',
        content: 'The shortest distance between two points on Earth is NOT a straight line on a map — it\'s a great circle arc. This is why flights from New York to Tokyo fly over the Arctic rather than across the Pacific. A great circle is the intersection of a plane passing through Earth\'s center with the surface.' },
      { id: 'f2', title: 'Air Corridors', type: 'info', description: 'Organized airspace',
        content: 'Aircraft fly along predefined routes called airways, managed by air traffic control. Over oceans, these are called NAT (North Atlantic Tracks) and change daily based on jet stream winds. The jet stream can add or subtract 100+ mph to ground speed.' },
      { id: 'f3', title: 'Weather Avoidance', type: 'interaction', description: 'Navigate around weather',
        content: 'Pilots use weather radar to detect thunderstorms, turbulence, and icing conditions. They can deviate up to 100 miles from their planned route to avoid severe weather. Clear air turbulence at high altitude remains one of the biggest challenges.' },
      { id: 'f4', title: 'Navigation Quiz', type: 'quiz', description: 'Test your knowledge',
        content: 'Why do flights from London to Los Angeles take longer than LA to London?',
        quizOptions: ['Earth\'s rotation', 'Jet stream headwinds', 'Time zone effects', 'Air traffic routing'], correctAnswer: 1 },
    ],
  },
  {
    id: 'satcom-101', title: 'Satellite Communications', icon: '🛰️',
    description: 'Understand how data travels from Earth to space and back — uplinks, downlinks, and coverage.',
    category: 'satcom', difficulty: 'intermediate', xpReward: 300, unlockLevel: 5,
    steps: [
      { id: 's1', title: 'Uplink & Downlink', type: 'info', description: 'Signal path',
        content: 'Ground stations transmit signals to satellites (uplink) at one frequency, and satellites retransmit to receivers (downlink) at a different frequency. GEO satellites at 35,786 km introduce ~240ms latency per hop. LEO constellations like Starlink reduce this to ~20-40ms.' },
      { id: 's2', title: 'Coverage Footprint', type: 'interaction', description: 'Satellite coverage',
        content: 'A GEO satellite can see approximately 42% of Earth\'s surface — but with diminishing quality at the edges. Just 3 GEO satellites can cover nearly the entire globe (except polar regions). LEO satellites cover small areas but with lower latency.' },
      { id: 's3', title: 'Starlink Mesh', type: 'info', description: 'Modern satellite internet',
        content: 'SpaceX\'s Starlink uses 6,000+ LEO satellites with laser inter-satellite links. Data can travel satellite-to-satellite before reaching a ground station. In vacuum, light travels 47% faster than in fiber optic cable, making some long-distance paths faster via space.' },
      { id: 's4', title: 'Latency Quiz', type: 'quiz', description: 'Test your knowledge',
        content: 'What is the approximate round-trip latency for a GEO satellite signal?',
        quizOptions: ['50ms', '120ms', '240ms', '480ms'], correctAnswer: 3 },
    ],
  },
  {
    id: 'rocket-101', title: 'Rocket Science', icon: '🚀',
    description: 'Learn orbital mechanics — gravity, escape velocity, staging, and orbit insertion.',
    category: 'rocket', difficulty: 'advanced', xpReward: 400, unlockLevel: 8,
    steps: [
      { id: 'r1', title: 'Gravity & Orbits', type: 'info', description: 'Newton\'s cannonball',
        content: 'An orbit is simply falling around Earth. If you throw a ball fast enough horizontally, it falls at the same rate Earth curves away — and never hits the ground. At 400km altitude, you need 7.67 km/s (27,600 km/h) horizontal velocity. The ISS achieves this, completing one orbit every 92 minutes.' },
      { id: 'r2', title: 'Escape Velocity', type: 'info', description: 'Breaking free',
        content: 'Escape velocity from Earth\'s surface is 11.2 km/s (40,320 km/h). This is the speed needed to completely escape Earth\'s gravitational pull. The Moon\'s escape velocity is only 2.4 km/s, which is why lunar landers can be much smaller. Mars requires 5.0 km/s.' },
      { id: 'r3', title: 'Rocket Staging', type: 'interaction', description: 'Why rockets have stages',
        content: 'The Tsiolkovsky rocket equation shows that a single-stage rocket to orbit is impractical. By discarding empty fuel tanks (staging), each subsequent stage doesn\'t need to accelerate dead weight. Saturn V used 3 stages. Falcon 9 uses 2 stages with a reusable first stage.' },
      { id: 'r4', title: 'Orbit Insertion', type: 'simulation', description: 'Achieve orbit',
        content: 'Adjust thrust, angle, and staging timing to achieve a stable orbit. Too slow and you fall back. Too fast and you escape. The sweet spot depends on your altitude.',
        simulation: { type: 'rocket', params: { thrust: 100, angle: 45, stages: 2 } } },
      { id: 'r5', title: 'Rocket Quiz', type: 'quiz', description: 'Test your knowledge',
        content: 'What speed must the ISS maintain to stay in orbit at 400km altitude?',
        quizOptions: ['3.07 km/s', '5.55 km/s', '7.67 km/s', '11.2 km/s'], correctAnswer: 2 },
    ],
  },
  {
    id: 'space-explore', title: 'Space Exploration', icon: '🌌',
    description: 'Journey through humanity\'s greatest space missions — Moon, Mars, and beyond.',
    category: 'space', difficulty: 'expert', xpReward: 500, unlockLevel: 12,
    steps: [
      { id: 'x1', title: 'Apollo Moon Missions', type: 'info', description: 'The Moon race',
        content: 'Between 1969-1972, NASA\'s Apollo program landed 12 humans on the Moon. The journey takes about 3 days, covering 384,400 km. Apollo used a Lunar Orbit Rendezvous strategy — the Command Module orbited the Moon while the Lunar Module descended to the surface.' },
      { id: 'x2', title: 'Mars Missions', type: 'info', description: 'The red planet',
        content: 'Mars is 225 million km away on average. A Hohmann transfer orbit takes about 9 months. Communication delay is 4-24 minutes depending on orbital positions. Mars rovers (Curiosity, Perseverance) must operate semi-autonomously due to this delay. The thin CO₂ atmosphere is only 1% of Earth\'s pressure.' },
      { id: 'x3', title: 'Deep Space Probes', type: 'interaction', description: 'Beyond the solar system',
        content: 'Voyager 1, launched in 1977, is now 24+ billion km from Earth — the most distant human-made object. Its signal takes 22+ hours to reach Earth at light speed. It carries a Golden Record with sounds and images of Earth. Pioneer 10 and 11 carry plaques depicting humans and our solar system\'s location.' },
      { id: 'x4', title: 'Space Quiz', type: 'quiz', description: 'Test your knowledge',
        content: 'How long does it take to travel from Earth to Mars using a Hohmann transfer orbit?',
        quizOptions: ['2 weeks', '3 months', '9 months', '2 years'], correctAnswer: 2 },
    ],
  },
];

/* ================================================================
   ACHIEVEMENTS
   ================================================================ */

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-flight', name: 'First Flight', description: 'Track your first aircraft', icon: '✈️', xpReward: 50, category: 'exploration', unlocked: false },
  { id: 'satellite-spotter', name: 'Satellite Spotter', description: 'View 10 different satellites', icon: '🛰️', xpReward: 75, category: 'exploration', unlocked: false },
  { id: 'iss-hunter', name: 'ISS Hunter', description: 'Track the International Space Station', icon: '🏠', xpReward: 100, category: 'discovery', unlocked: false },
  { id: 'starlink-fan', name: 'Starlink Constellation', description: 'View the Starlink satellite constellation', icon: '⭐', xpReward: 75, category: 'discovery', unlocked: false },
  { id: 'globe-trotter', name: 'Globe Trotter', description: 'View all 7 continents', icon: '🌍', xpReward: 150, category: 'exploration', unlocked: false },
  { id: 'mission-1', name: 'First Mission', description: 'Complete your first educational mission', icon: '📚', xpReward: 100, category: 'learning', unlocked: false },
  { id: 'mission-5', name: 'Mission Master', description: 'Complete 5 educational missions', icon: '🎓', xpReward: 250, category: 'learning', unlocked: false },
  { id: 'quiz-ace', name: 'Quiz Ace', description: 'Answer 10 quiz questions correctly', icon: '🧠', xpReward: 100, category: 'mastery', unlocked: false },
  { id: 'night-owl', name: 'Night Owl', description: 'Observe the night side of Earth', icon: '🌙', xpReward: 50, category: 'discovery', unlocked: false },
  { id: 'weather-watcher', name: 'Weather Watcher', description: 'Enable weather layer visualization', icon: '🌦️', xpReward: 50, category: 'exploration', unlocked: false },
  { id: 'streak-3', name: 'Hat Trick', description: 'Maintain a 3-day learning streak', icon: '🔥', xpReward: 75, category: 'mastery', unlocked: false },
  { id: 'streak-7', name: 'Weekly Warrior', description: 'Maintain a 7-day learning streak', icon: '⚡', xpReward: 200, category: 'mastery', unlocked: false },
  { id: 'orbit-lab', name: 'Orbital Mechanic', description: 'Complete an orbit simulation lab', icon: '🔬', xpReward: 100, category: 'mastery', unlocked: false },
  { id: 'speed-demon', name: 'Speed Demon', description: 'Find an aircraft traveling over 900 km/h', icon: '💨', xpReward: 75, category: 'discovery', unlocked: false },
  { id: 'high-flyer', name: 'High Flyer', description: 'Find an aircraft above 12,000m altitude', icon: '☁️', xpReward: 75, category: 'discovery', unlocked: false },
  { id: 'deep-space', name: 'Deep Space', description: 'Complete the Space Exploration mission', icon: '🌌', xpReward: 200, category: 'mastery', unlocked: false },
  { id: 'rocket-scientist', name: 'Rocket Scientist', description: 'Complete the Rocket Science mission', icon: '🚀', xpReward: 200, category: 'mastery', unlocked: false },
  { id: 'gps-master', name: 'GPS Master', description: 'Complete the GPS mission', icon: '📡', xpReward: 150, category: 'mastery', unlocked: false },
  { id: 'navigator', name: 'Navigator', description: 'Complete the Flight Navigation mission', icon: '🧭', xpReward: 150, category: 'mastery', unlocked: false },
  { id: 'communicator', name: 'Communicator', description: 'Complete the Satellite Communications mission', icon: '📻', xpReward: 150, category: 'mastery', unlocked: false },
];

/* ================================================================
   AI TUTOR KNOWLEDGE BASE
   ================================================================ */

interface TutorTopic {
  keywords: string[];
  responses: Record<string, string>; // key = TutorMode
}

const TUTOR_TOPICS: TutorTopic[] = [
  {
    keywords: ['orbit', 'orbital', 'orbiting'],
    responses: {
      kids: '🚀 Imagine throwing a ball so fast that it keeps falling but never hits the ground — that\'s an orbit! Satellites go so fast sideways that they keep falling around Earth in a circle.',
      student: 'An orbit occurs when an object\'s horizontal velocity matches the curvature of Earth. At 400km altitude, this requires ~7.67 km/s. The balance between gravitational pull and centripetal force creates a stable path.',
      enthusiast: 'Orbits are conic sections — ellipses (bound) or hyperbolas (escape). Kepler\'s laws govern: T² ∝ a³, equal areas in equal times, and elliptical paths with the primary at one focus. Perturbations from J2 oblateness, atmospheric drag, and lunar/solar gravity affect real orbits.',
      expert: 'Real orbital mechanics uses the vis-viva equation v² = GM(2/r - 1/a), osculating Keplerian elements (a,e,i,Ω,ω,ν), and SGP4/SDP4 propagators for accurate TLE-based predictions. Station-keeping maneuvers for GEO sats require ~50 m/s Δv per year due to N-S drift from lunar/solar perturbations.',
    },
  },
  {
    keywords: ['satellite', 'satellites'],
    responses: {
      kids: '🛰️ Satellites are like flying robots in space! Some take pictures of Earth, some help your phone know where you are (GPS), and some even carry TV channels. The space station is the biggest satellite — astronauts live there!',
      student: 'Satellites orbit at different altitudes for different purposes: LEO (160-2000km) for imaging and ISS, MEO (2000-35786km) for GPS/navigation, and GEO (35786km) for communications and weather. Higher orbits mean wider coverage but higher latency.',
      enthusiast: 'There are ~13,000 active satellites as of 2024. LEO mega-constellations (Starlink: 6000+, OneWeb: 600+) are transforming global internet. Key orbital regimes: SSO for consistent lighting in imaging, Molniya for high-latitude coverage, and halo orbits at Lagrange points for deep-space observatories.',
      expert: 'Satellite operations involve complex TT&C (Telemetry, Tracking & Command), orbit determination via radar/laser ranging, conjunction assessment for collision avoidance (18th Space Defense Squadron tracks 27,000+ objects), and end-of-life disposal per IADC guidelines (25-year deorbit for LEO, graveyard orbit for GEO).',
    },
  },
  {
    keywords: ['iss', 'space station', 'international space station'],
    responses: {
      kids: '🏠 The ISS is a giant house in space where astronauts live! It flies around Earth 16 times every day at 28,000 km/h. Astronauts float around inside because of microgravity. They do science experiments and even grow plants!',
      student: 'The ISS orbits at ~420km altitude with 51.6° inclination, completing one orbit every 92 minutes at 7.66 km/s. It\'s been continuously occupied since November 2000. The station is 109m wide (a football field) and weighs ~420,000 kg.',
      enthusiast: 'The ISS is a collaboration of NASA, Roscosmos, JAXA, ESA, and CSA. It consists of 16 pressurized modules with 32,333 cubic feet of habitable volume. Its orbital altitude decays ~2km/month due to atmospheric drag and requires periodic reboosts using Progress vehicles or Cygnus spacecraft.',
      expert: 'ISS attitude control uses four Control Moment Gyroscopes (CMGs) for momentum management, with periodic momentum desaturation via thruster firings. Power comes from 8 solar array wings generating 75-90 kW. Thermal control uses an Active Thermal Control System (ATCS) with ammonia coolant loops. Planned decommissioning ~2030 via controlled deorbit.',
    },
  },
  {
    keywords: ['gps', 'navigation', 'positioning'],
    responses: {
      kids: '📍 GPS is like a magic map that tells you exactly where you are! Satellites in space send invisible signals to your phone. Your phone listens to at least 4 satellites and figures out where you are by timing the signals.',
      student: 'GPS uses trilateration with signals from ≥4 satellites. Each satellite broadcasts its position and a precise timestamp. Your receiver measures signal travel time to calculate distance. With 4+ distances, it solves for 3D position + clock error.',
      enthusiast: 'GPS signals use L1 (1575.42 MHz) and L2 (1227.60 MHz) frequencies. Civilian C/A code provides ~3m accuracy; military P(Y) code achieves <1m. Errors include ionospheric delay (correctable via dual-frequency), tropospheric delay, multipath, and satellite clock drift. WAAS/SBAS augmentation improves accuracy to ~1m.',
      expert: 'Modern GNSS uses multiple constellations (GPS L1C/L2C/L5, Galileo E1/E5a/E6, BeiDou B1C/B2a/B3I, GLONASS L1OF/L2OF) with RTK (Real-Time Kinematic) achieving centimeter-level precision. PPP (Precise Point Positioning) convergence takes 20-30 minutes. Integrity monitoring via RAIM and ARAIM is critical for aviation.',
    },
  },
  {
    keywords: ['weather', 'cloud', 'storm', 'hurricane', 'cyclone'],
    responses: {
      kids: '🌦️ Weather satellites take pictures of clouds from space! They can see big storms forming and help weather forecasters warn people. Some satellites watch the same spot all day (geostationary), while others zoom around Earth to see everywhere.',
      student: 'Weather satellites operate in two main orbits: GEO (GOES, Meteosat) for continuous monitoring of one region, and polar LEO (NOAA, MetOp) for global coverage. They measure visible light, infrared radiation, and water vapor to track storms, temperature, and atmospheric conditions.',
      enthusiast: 'GOES-R series satellites carry ABI (Advanced Baseline Imager) with 16 spectral bands, GLM (Geostationary Lightning Mapper), and SUVI (Solar Ultraviolet Imager). Rapid-scan mode captures images every 30 seconds. Numerical Weather Prediction models ingest satellite radiance data via variational data assimilation (3D-Var, 4D-Var).',
      expert: 'Satellite meteorology relies on radiative transfer models (RTTOV, CRTM) for forward-modeling brightness temperatures. Hyperspectral sounders (CrIS, IASI) provide 2000+ channels for temperature/moisture profiling with ~1K accuracy. AMVs (Atmospheric Motion Vectors) derived from feature tracking in sequential imagery feed NWP models. AI/ML is increasingly used for nowcasting and severe weather detection.',
    },
  },
  {
    keywords: ['rocket', 'launch', 'space launch', 'rocket engine'],
    responses: {
      kids: '🚀 Rockets work like a balloon you let go — air shoots out the back and the balloon flies forward! Rockets carry their own fuel AND oxygen because there\'s no air in space. They go SO fast — over 40,000 km/h!',
      student: 'Rockets use Newton\'s Third Law: exhaust gases are expelled backward at high velocity, propelling the rocket forward. The Tsiolkovsky equation Δv = Isp·g₀·ln(m₀/mf) shows that final velocity depends on exhaust velocity and mass ratio. This is why staging is essential.',
      enthusiast: 'Modern launchers: Falcon 9 (partially reusable, LOX/RP-1, ~$2,720/kg to LEO), Starship (fully reusable target, LOX/CH4), Ariane 6 (LOX/LH2 upper stage), and New Glenn (reusable booster). Key performance metrics: Isp (specific impulse), TWR (thrust-to-weight ratio), and payload fraction.',
      expert: 'Rocket propulsion involves complex turbomachinery (gas generator, staged combustion, full-flow staged combustion, expander cycles), injector design for combustion stability, nozzle design (bell, aerospike) for altitude compensation, and thermal management (regenerative cooling, film cooling, ablative). SpaceX\'s Raptor uses full-flow staged combustion with LOX/CH4 achieving ~350s Isp at sea level.',
    },
  },
];

export function getAITutorResponse(query: string, mode: string): { content: string; globeAction?: { command: 'highlight' | 'fly-to' | 'orbit-view'; targetId?: string; targetType?: 'aircraft' | 'satellite' | 'airport' | 'coordinate'; lat?: number; lon?: number } } {
  const q = query.toLowerCase();
  
  let globeAction: { command: 'highlight' | 'fly-to' | 'orbit-view'; targetId?: string; targetType?: 'aircraft' | 'satellite' | 'airport' | 'coordinate'; lat?: number; lon?: number } | undefined = undefined;
  
  if (q.includes('iss') || q.includes('space station')) {
    globeAction = { command: 'fly-to', targetId: 'ISS', targetType: 'satellite', lat: 0, lon: 0 };
  } else if (q.includes('starlink')) {
    globeAction = { command: 'highlight', targetId: 'STARLINK-0', targetType: 'satellite' };
  } else if (q.includes('gps') || q.includes('navigation') || q.includes('positioning')) {
    globeAction = { command: 'highlight', targetId: 'GPS-0', targetType: 'satellite' };
  } else if (q.includes('orbit')) {
    globeAction = { command: 'orbit-view' };
  } else if (q.includes('weather') || q.includes('cloud') || q.includes('storm')) {
    globeAction = { command: 'highlight', targetId: 'GOES-0', targetType: 'satellite' };
  } else if (q.includes('rocket') || q.includes('launch')) {
    globeAction = { command: 'fly-to', lat: 28.5721, lon: -80.648, targetType: 'coordinate' }; // Cape Canaveral
  }

  for (const topic of TUTOR_TOPICS) {
    if (topic.keywords.some(kw => q.includes(kw))) {
      return {
        content: topic.responses[mode] || topic.responses.student,
        globeAction,
      };
    }
  }
  
  const fallback = mode === 'kids'
    ? '🤔 That\'s a great question! Try asking me about orbits, satellites, the ISS, GPS, weather, or rockets — I know lots about space!'
    : `That's an interesting question about "${query}". Try asking me about orbital mechanics, satellite systems, the ISS, GPS navigation, weather satellites, or rocket propulsion — these are my areas of expertise. You can also start an educational mission from the Missions panel to learn interactively!`;
  
  return { content: fallback, globeAction };
}
