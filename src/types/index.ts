/* ===== CORE ENTITY TYPES ===== */

export interface Aircraft {
  id: string;
  callsign: string;
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  latitude: number;
  longitude: number;
  altitude: number; // meters
  speed: number; // m/s
  heading: number; // degrees
  verticalRate: number;
  aircraftType: string;
  category: 'commercial' | 'cargo' | 'business' | 'helicopter' | 'military';
  onGround: boolean;
  lastUpdate: number;
  trail: [number, number, number][]; // [lat, lon, alt]
}

export interface Satellite {
  id: string;
  name: string;
  noradId: number;
  category: SatelliteCategory;
  latitude: number;
  longitude: number;
  altitude: number; // km
  speed: number; // km/s
  inclination: number;
  period: number; // minutes
  orbitType: 'LEO' | 'MEO' | 'GEO' | 'HEO' | 'SSO';
  tle1: string;
  tle2: string;
  visible: boolean;
  phase?: number;
  raan?: number;
}

export type SatelliteCategory =
  | 'starlink' | 'gps' | 'galileo' | 'glonass' | 'beidou'
  | 'weather' | 'earth-observation' | 'communication'
  | 'scientific' | 'iss' | 'space-station' | 'other';

export interface SatelliteOrbitPoint {
  lat: number; lon: number; alt: number; time: number;
}

export interface WeatherData {
  clouds: number;
  temperature: number;
  windSpeed: number;
  windDirection: number;
  pressure: number;
  humidity: number;
  visibility: number;
}

/* ===== MISSION TYPES ===== */

export interface Mission {
  id: string;
  title: string;
  description: string;
  category: 'gps' | 'flight' | 'satcom' | 'rocket' | 'space';
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  xpReward: number;
  icon: string;
  steps: MissionStep[];
  unlockLevel: number;
}

export interface MissionStep {
  id: string;
  title: string;
  description: string;
  type: 'info' | 'interaction' | 'quiz' | 'simulation' | 'challenge';
  content: string;
  quizOptions?: string[];
  correctAnswer?: number;
  simulation?: SimulationConfig;
}

export interface SimulationConfig {
  type: 'orbit' | 'flight' | 'weather' | 'rocket';
  params: Record<string, number>;
}

/* ===== GAMIFICATION ===== */

export type UserRank = 'Cadet' | 'Pilot' | 'Flight Officer' | 'Mission Controller' | 'Orbital Engineer' | 'Astronaut' | 'Space Architect';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
  category: 'exploration' | 'learning' | 'discovery' | 'mastery' | 'social';
  unlocked: boolean;
  unlockedAt?: number;
}

export interface UserProgress {
  xp: number;
  level: number;
  rank: UserRank;
  completedMissions: string[];
  achievements: string[];
  streak: number;
  lastActive: number;
  totalFlightsTracked: number;
  totalSatellitesViewed: number;
  totalMissionsCompleted: number;
  dailyMissionCompleted: boolean;
}

/* ===== UI STATE ===== */

export type ActivePanel = 'none' | 'flights' | 'satellites' | 'iss' | 'weather' | 'missions' | 'labs' | 'academy' | 'achievements' | 'airport';

export type CameraMode = 'orbit' | 'fly-to' | 'follow-aircraft' | 'follow-satellite' | 'iss-view' | 'cockpit' | 'iss-chase' | 'iss-earth';

export interface ViewTarget {
  lat: number;
  lon: number;
  alt?: number;
  entityId?: string;
  entityType?: 'aircraft' | 'satellite' | 'airport';
}

/* ===== AIRPORT TRAFFIC TYPES ===== */

export interface FlightSchedule {
  flightNumber: string;
  airline: string;
  time: string;
  destination?: string;
  origin?: string;
  status: 'scheduled' | 'delayed' | 'departed' | 'landed';
}

export interface AirportTraffic {
  code: string;
  name: string;
  lat: number;
  lon: number;
  departures: FlightSchedule[];
  arrivals: FlightSchedule[];
  trafficScore: number;
}

/* ===== WEATHER SYSTEM TYPES ===== */

export type WeatherLayerMode = 'clouds' | 'temp' | 'pressure' | 'wind';

/* ===== AI TUTOR SYSTEM ===== */

export type TutorMode = 'kids' | 'student' | 'enthusiast' | 'expert';

export interface TutorMessage {
  id: string;
  role: 'user' | 'tutor';
  content: string;
  timestamp: number;
  globeAction?: {
    command: 'highlight' | 'fly-to' | 'orbit-view';
    targetId?: string;
    targetType?: 'aircraft' | 'satellite' | 'airport' | 'coordinate';
    lat?: number;
    lon?: number;
  };
}

/* ===== VALIDATION REPORT TYPES ===== */

export interface ValidationReport {
  timestamp: number;
  fps: number;
  elements: {
    earth: boolean;
    atmosphere: boolean;
    clouds: boolean;
    flightsCount: number;
    satellitesCount: number;
    weatherLayers: boolean;
  };
  education: {
    missionsOk: boolean;
    labsOk: boolean;
    tutorOk: boolean;
  };
  performance: {
    score: number;
    memoryLimitRespected: boolean;
  };
  status: 'passed' | 'failed';
}

/* ===== API TYPES ===== */

export interface OpenSkyState {
  icao24: string;
  callsign: string | null;
  origin_country: string;
  time_position: number | null;
  last_contact: number;
  longitude: number | null;
  latitude: number | null;
  baro_altitude: number | null;
  on_ground: boolean;
  velocity: number | null;
  true_track: number | null;
  vertical_rate: number | null;
  sensors: number[] | null;
  geo_altitude: number | null;
  squawk: string | null;
  spi: boolean;
  position_source: number;
  category: number;
}

export interface TLEData {
  name: string;
  line1: string;
  line2: string;
}
