'use client';

import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore, useFlightStore, useSatelliteStore } from '@/stores/stores';
import { latLonToVec3, greatCircleArc, getSunPosition } from '@/lib/data';

const EARTH_RADIUS = 5;

// CDN URLs (loaded async with fallback)
const TEXTURE_URLS = {
  day: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg',
  night: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg',
  clouds: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-clouds.png',
};

/* === PROCEDURAL 2D/3D GEOMETRIES FOR PLANES & SATELLITES === */
function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const nonIndexed = geos.map(g => g.toNonIndexed());
  let totalVertexCount = 0;
  for (const g of nonIndexed) {
    totalVertexCount += g.getAttribute('position').count;
  }

  const positions = new Float32Array(totalVertexCount * 3);
  const normals = new Float32Array(totalVertexCount * 3);

  let offset = 0;
  for (const g of nonIndexed) {
    const posAttr = g.getAttribute('position');
    const normAttr = g.getAttribute('normal');
    
    positions.set(posAttr.array as Float32Array, offset * 3);
    if (normAttr) {
      normals.set(normAttr.array as Float32Array, offset * 3);
    }
    
    offset += posAttr.count;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return merged;
}

function createAirplaneGeometry(): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  // Fuselage (Cylinder along Y axis)
  const fuselage = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8);
  geometries.push(fuselage);

  // Main wings (Box along X axis, translated forward slightly)
  const wings = new THREE.BoxGeometry(0.8, 0.15, 0.02);
  wings.translate(0, 0.1, 0);
  geometries.push(wings);

  // Tailplane (Box along X axis, translated back)
  const tail = new THREE.BoxGeometry(0.3, 0.06, 0.01);
  tail.translate(0, -0.3, 0);
  geometries.push(tail);

  // Vertical stabilizer (Box, sticking up along local Z axis)
  const stabilizer = new THREE.BoxGeometry(0.01, 0.08, 0.12);
  stabilizer.translate(0, -0.3, 0.06);
  geometries.push(stabilizer);

  const merged = mergeGeometries(geometries);
  
  // Clean up source geometries
  fuselage.dispose();
  wings.dispose();
  tail.dispose();
  stabilizer.dispose();

  return merged;
}

function createSatelliteGeometry(): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  // Satellite Central Bus (Box)
  const body = new THREE.BoxGeometry(0.25, 0.25, 0.25);
  geometries.push(body);

  // Solar Panels (Box along X axis)
  const panels = new THREE.BoxGeometry(1.0, 0.1, 0.02);
  geometries.push(panels);

  const merged = mergeGeometries(geometries);
  body.dispose();
  panels.dispose();
  return merged;
}

/* === HELPER FOR SATELLITE POSITION CALCULATION === */
function getSatellitePositionAtTime(sat: any, t: number): { lat: number; lon: number } {
  let lat = sat.latitude;
  let lon = sat.longitude;
  
  if (sat.category === 'iss') {
    lon = ((t * 0.0667) % 360) - 180;
    lat = 51.6 * Math.sin(t * 0.0011);
  } else if (sat.phase !== undefined && sat.raan !== undefined) {
    const angularVel = 360 / (sat.period * 60); // deg/s
    const trueAnomaly = (sat.phase + angularVel * t) % 360;
    lat = sat.inclination * Math.sin(trueAnomaly * Math.PI / 180);
    lon = (sat.raan + trueAnomaly - (t * 0.00417)) % 360 - 180;
  }
  return { lat, lon };
}

/* === PROCEDURAL NOISE FOR FALLBACK TEXTURES === */
function hashN(n: number): number {
  const s = Math.sin(n + 0.1) * 43758.5453;
  return s - Math.floor(s);
}
function noise2D(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const n = ix + iy * 157;
  return hashN(n)*(1-ux)*(1-uy) + hashN(n+1)*ux*(1-uy) + hashN(n+157)*(1-ux)*uy + hashN(n+158)*ux*uy;
}
function fbm(x: number, y: number, octaves = 5): number {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < octaves; i++) { v += a * noise2D(x * f, y * f); a *= 0.5; f *= 2; }
  return v;
}

/* === PROCEDURAL TEXTURE GENERATORS (no DOM/canvas dependency) === */
function createEarthDayTexture(w = 512, h = 256): THREE.DataTexture {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const polar = Math.abs(90 - (y / h) * 180) / 90;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const n = fbm(x * 0.009 + 2.5, y * 0.009 + 1.3, 6);
      const th = 0.44 + polar * 0.12;
      let r: number, g: number, b: number;
      if (polar > 0.82)       { r = 215 + (n*30)|0; g = 225 + (n*20)|0; b = 238; }
      else if (n < th - 0.06) { r = (10+n*35)|0;  g = (28+n*65)|0;  b = (75+n*105)|0; }
      else if (n < th)        { r = (22+n*50)|0;  g = (65+n*95)|0;  b = (115+n*75)|0; }
      else if (n < th + 0.02) { r = 190; g = 175; b = 120; }
      else if (n < 0.58)      { const fg = fbm(x*0.025, y*0.025, 3); r = (32+fg*35)|0; g = (78+fg*50)|0; b = (20+fg*18)|0; }
      else if (n < 0.68)      { r = (22+(n-0.58)*100)|0; g = (58+(n-0.58)*70)|0; b = 16; }
      else if (n < 0.78)      { const m = (n-0.68)*10; r = (105+m*55)|0; g = (90+m*45)|0; b = (65+m*25)|0; }
      else                    { r = (200+n*45)|0; g = (205+n*35)|0; b = (215+n*25)|0; }
      data[i] = Math.min(255, r); data[i+1] = Math.min(255, g); data[i+2] = Math.min(255, b); data[i+3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.needsUpdate = true; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createEarthNightTexture(w = 512, h = 256): THREE.DataTexture {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const lat = 90 - (y / h) * 180;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const n = fbm(x * 0.009 + 2.5, y * 0.009 + 1.3, 6);
      const isLand = n > (0.44 + (Math.abs(lat) / 90) * 0.12);
      data[i] = 2; data[i+1] = 3; data[i+2] = 10; data[i+3] = 255;
      if (isLand && Math.abs(lat) < 65 && Math.abs(lat) > 10) {
        const cn = fbm(x * 0.06 + 100, y * 0.06 + 100, 4);
        if (cn > 0.52) {
          const br = (cn - 0.52) * 6;
          data[i] = Math.min(255, (255*br*0.9)|0);
          data[i+1] = Math.min(255, (200*br*0.7)|0);
          data[i+2] = Math.min(255, (80*br*0.4)|0);
        }
      }
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.needsUpdate = true; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createCloudTexture(w = 256, h = 128): THREE.DataTexture {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const n = fbm(x * 0.015 + 7.7, y * 0.015 + 3.3, 5);
      const cloud = Math.max(0, (n - 0.38) * 3);
      data[i] = 255; data[i+1] = 255; data[i+2] = 255;
      data[i+3] = Math.min(255, (cloud * 160) | 0);
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.needsUpdate = true; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ================================================================
   ATMOSPHERE SHADER
   ================================================================ */
const atmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const atmosphereFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  uniform vec3 uSunDirection;
  void main() {
    vec3 viewDir = normalize(-vPosition);
    float fresnel = 1.0 - dot(viewDir, vNormal);
    fresnel = pow(fresnel, 3.0);
    float sunDot = max(0.0, dot(vNormal, uSunDirection));
    float backScatter = pow(max(0.0, dot(viewDir, uSunDirection)), 8.0) * 0.3;
    vec3 dayColor = vec3(0.4, 0.7, 1.0);
    vec3 twilightColor = vec3(1.0, 0.4, 0.2);
    vec3 color = mix(twilightColor, dayColor, clamp(sunDot * 2.0, 0.0, 1.0));
    float alpha = fresnel * (0.4 + sunDot * 0.3 + backScatter);
    gl_FragColor = vec4(color, alpha * 0.7);
  }
`;

/* ================================================================
   EARTH DAY/NIGHT SHADER
   ================================================================ */
const earthVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vUv = uv;
    vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const earthFragmentShader = `
  uniform sampler2D uDayMap;
  uniform sampler2D uNightMap;
  uniform sampler2D uBumpMap;
  uniform vec3 uSunDirection;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec3 normal = normalize(vNormal);
    float sunDot = dot(normal, normalize(uSunDirection));
    float dayFactor = smoothstep(-0.15, 0.2, sunDot);
    vec4 dayColor = texture2D(uDayMap, vUv);
    vec4 nightColor = texture2D(uNightMap, vUv);
    // Enhance day side with diffuse lighting
    float diffuse = max(0.0, sunDot);
    dayColor.rgb *= 0.6 + diffuse * 0.6;
    // Night lights glow
    nightColor.rgb *= 1.8;
    vec4 finalColor = mix(nightColor, dayColor, dayFactor);
    // Add subtle blue tint to terminator
    float terminator = 1.0 - abs(sunDot);
    terminator = pow(terminator, 8.0);
    finalColor.rgb += vec3(0.1, 0.15, 0.3) * terminator;
    gl_FragColor = finalColor;
  }
`;

/* ================================================================
   EARTH COMPONENT
   ================================================================ */
function Earth({ sunRef }: { sunRef: React.RefObject<THREE.DirectionalLight> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const atmRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const cloudMatRef = useRef<THREE.MeshPhongMaterial>(null);

  // Generate procedural fallback textures (runs once, no network)
  const procTextures = useMemo(() => ({
    day: createEarthDayTexture(),
    night: createEarthNightTexture(),
    clouds: createCloudTexture(),
  }), []);

  // Stable uniforms initialized with procedural textures
  const earthUniforms = useMemo(() => ({
    uDayMap: { value: procTextures.day as THREE.Texture },
    uNightMap: { value: procTextures.night as THREE.Texture },
    uBumpMap: { value: procTextures.day as THREE.Texture },
    uSunDirection: { value: new THREE.Vector3(1, 0.3, 0.5).normalize() },
  }), [procTextures]);

  const atmUniforms = useMemo(() => ({
    uSunDirection: { value: new THREE.Vector3(1, 0.3, 0.5).normalize() },
  }), []);

  const uniformsRef = useRef(earthUniforms);
  const atmUniformsRef = useRef(atmUniforms);
  uniformsRef.current = earthUniforms;
  atmUniformsRef.current = atmUniforms;

  // Attempt remote texture upgrade (never crashes)
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    const configure = (tex: THREE.Texture) => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; };

    loader.load(TEXTURE_URLS.day, (tex) => {
      configure(tex);
      earthUniforms.uDayMap.value = tex;
      earthUniforms.uBumpMap.value = tex;
    }, undefined, () => { /* keep procedural fallback */ });

    loader.load(TEXTURE_URLS.night, (tex) => {
      configure(tex);
      earthUniforms.uNightMap.value = tex;
    }, undefined, () => {});

    loader.load(TEXTURE_URLS.clouds, (tex) => {
      configure(tex);
      if (cloudMatRef.current) {
        cloudMatRef.current.map = tex;
        cloudMatRef.current.needsUpdate = true;
      }
    }, undefined, () => {});
  }, [earthUniforms]);

  useFrame(() => {
    const sun = getSunPosition();
    const localDir = new THREE.Vector3(...sun.direction).normalize();
    const worldDir = localDir.clone().applyEuler(new THREE.Euler(0, -Math.PI / 2, 0.41));
    
    if (uniformsRef.current) uniformsRef.current.uSunDirection.value.copy(worldDir);
    if (atmUniformsRef.current) atmUniformsRef.current.uSunDirection.value.copy(worldDir);
    if (sunRef.current) sunRef.current.position.copy(worldDir.clone().multiplyScalar(50));
    if (cloudsRef.current) cloudsRef.current.rotation.y += 0.0003;
    if (meshRef.current) meshRef.current.rotation.y += 0.0001;
  });

  return (
    <group>
      {/* Earth */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[EARTH_RADIUS, 128, 64]} />
        <shaderMaterial
          vertexShader={earthVertexShader}
          fragmentShader={earthFragmentShader}
          uniforms={earthUniforms}
        />
      </mesh>

      {/* Clouds */}
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[EARTH_RADIUS * 1.005, 96, 48]} />
        <meshPhongMaterial ref={cloudMatRef} map={procTextures.clouds} transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Atmosphere glow */}
      <mesh ref={atmRef} scale={1.08}>
        <sphereGeometry args={[EARTH_RADIUS, 64, 32]} />
        <shaderMaterial
          vertexShader={atmosphereVertexShader}
          fragmentShader={atmosphereFragmentShader}
          uniforms={atmUniforms}
          transparent side={THREE.BackSide} depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ================================================================
   AIRCRAFT LAYER
   ================================================================ */
function AircraftLayer() {
  const aircraft = useFlightStore(s => s.aircraft);
  const showFlights = useAppStore(s => s.showFlights);
  const selectAircraft = useAppStore(s => s.selectAircraft);
  const selectedId = useAppStore(s => s.selectedAircraftId);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const { camera } = useThree();
  
  const airplaneGeom = useMemo(() => createAirplaneGeometry(), []);

  const filteredAircraft = useMemo(() =>
    showFlights ? aircraft.slice(0, 500) : [],
  [aircraft, showFlights]);

  useFrame(() => {
    if (!meshRef.current || filteredAircraft.length === 0) return;
    const count = filteredAircraft.length;
    // Camera-distance-adaptive scaling: bigger when zoomed out
    const camDist = camera.position.length();
    const zoomFactor = Math.max(0.8, Math.min(3.0, camDist / (EARTH_RADIUS * 2)));
    
    for (let i = 0; i < count; i++) {
      const ac = filteredAircraft[i];
      
      // Interpolate position smoothly based on actual speed and heading
      const elapsedSec = Math.min((Date.now() - ac.lastUpdate) / 1000, 4); // clamp to prevent jumps on tab focus
      const speedDeg = (ac.speed / 111320) * elapsedSec;
      const headingRad = (ac.heading * Math.PI) / 180;
      
      let latInterp = ac.latitude + Math.cos(headingRad) * speedDeg;
      const cosLat = Math.cos((ac.latitude * Math.PI) / 180);
      let lonInterp = ac.longitude + Math.sin(headingRad) * speedDeg / (cosLat > 0.1 ? cosLat : 1.0);
      
      if (lonInterp > 180) lonInterp -= 360;
      if (lonInterp < -180) lonInterp += 360;
      if (latInterp > 85) latInterp = 85;
      if (latInterp < -85) latInterp = -85;

      const pos = latLonToVec3(latInterp, lonInterp, EARTH_RADIUS * 1.003 + ac.altitude / 13000000 * EARTH_RADIUS * 0.15);
      dummy.position.set(pos[0], pos[1], pos[2]);

      // Orthonormal basis for flat tangent orientation + heading
      const uNormal = new THREE.Vector3(pos[0], pos[1], pos[2]).normalize();
      let vEast = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), uNormal).normalize();
      if (vEast.lengthSq() < 0.0001) {
        vEast.set(0, 0, -1);
      }
      const vNorth = new THREE.Vector3().crossVectors(uNormal, vEast).normalize();

      const vHeading = new THREE.Vector3()
        .addScaledVector(vNorth, Math.cos(headingRad))
        .addScaledVector(vEast, Math.sin(headingRad))
        .normalize();
      const vRight = new THREE.Vector3().crossVectors(vHeading, uNormal).normalize();

      const rotationMatrix = new THREE.Matrix4();
      rotationMatrix.makeBasis(vRight, vHeading, uNormal);
      dummy.rotation.setFromRotationMatrix(rotationMatrix);

      // Slightly larger scale for high-visibility plane geometry
      const baseScale = ac.id === selectedId ? 0.12 : 0.07;
      dummy.scale.setScalar(baseScale * zoomFactor);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Altitude color coding
      const altNorm = Math.min(ac.altitude / 13000, 1);
      const r = altNorm < 0.5 ? 0.0 : 1.0;
      const g = altNorm < 0.5 ? 0.83 : 1.0 - (altNorm - 0.5) * 2;
      const b = altNorm < 0.5 ? 1.0 : 0.2;
      meshRef.current.setColorAt(i, new THREE.Color(r, g, b));
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  if (filteredAircraft.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[airplaneGeom, undefined, filteredAircraft.length]}
      onClick={(e) => {
        e.stopPropagation();
        const idx = e.instanceId;
        if (idx !== undefined && filteredAircraft[idx]) {
          selectAircraft(filteredAircraft[idx].id);
        }
      }}
    >
      <instancedBufferAttribute
        key={filteredAircraft.length}
        attach="instanceColor"
        args={[new Float32Array(filteredAircraft.length * 3).fill(1), 3]}
      />
      <meshBasicMaterial vertexColors toneMapped={false} side={THREE.DoubleSide} transparent opacity={0.95} />
    </instancedMesh>
  );
}

/* ================================================================
   FLIGHT ROUTES (selected aircraft)
   ================================================================ */
function FlightRoutes() {
  const aircraft = useFlightStore(s => s.aircraft);
  const selectedId = useAppStore(s => s.selectedAircraftId);

  const routeGeometry = useMemo(() => {
    if (!selectedId) return null;
    // Show a few routes for visual interest
    const routeAircraft = selectedId
      ? aircraft.filter(a => a.id === selectedId)
      : aircraft.slice(0, 20);

    const allPoints: THREE.Vector3[] = [];
    for (const ac of routeAircraft) {
      // Create arc from approximate origin to current position
      const originLat = ac.latitude + (Math.sin(parseInt(ac.id.slice(2)) * 0.1) * 20);
      const originLon = ac.longitude + (Math.cos(parseInt(ac.id.slice(2)) * 0.1) * 30);
      const arcPts = greatCircleArc(originLat, originLon, ac.latitude, ac.longitude, EARTH_RADIUS * 1.003, 48, 0.15);
      arcPts.forEach(p => allPoints.push(new THREE.Vector3(p[0], p[1], p[2])));
      allPoints.push(new THREE.Vector3(NaN, NaN, NaN)); // break
    }

    if (allPoints.length === 0) return null;
    const geom = new THREE.BufferGeometry().setFromPoints(allPoints);
    return geom;
  }, [selectedId, aircraft]);

  if (!routeGeometry) return null;

  return (
    <lineSegments geometry={routeGeometry}>
      <lineBasicMaterial color="#00d4ff" transparent opacity={0.5} />
    </lineSegments>
  );
}

/* ================================================================
   SATELLITE LAYER
   ================================================================ */
function SatelliteLayer() {
  const satellites = useSatelliteStore(s => s.satellites);
  const showSatellites = useAppStore(s => s.showSatellites);
  const showStarlink = useAppStore(s => s.showStarlink);
  const showISS = useAppStore(s => s.showISS);
  const selectSatellite = useAppStore(s => s.selectSatellite);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const { camera } = useThree();

  const satelliteGeom = useMemo(() => createSatelliteGeometry(), []);

  const visibleSats = useMemo(() => {
    if (!showSatellites) return [];
    return satellites.filter(s => {
      if (s.category === 'starlink' && !showStarlink) return false;
      if (s.category === 'iss' && !showISS) return false;
      return true;
    });
  }, [satellites, showSatellites, showStarlink, showISS]);

  useFrame(() => {
    if (!meshRef.current || visibleSats.length === 0) return;
    const t = Date.now() / 1000;
    // Camera-distance-adaptive scaling
    const camDist = camera.position.length();
    const zoomFactor = Math.max(0.8, Math.min(3.0, camDist / (EARTH_RADIUS * 2)));

    for (let i = 0; i < visibleSats.length; i++) {
      const sat = visibleSats[i];
      
      // Calculate real-time smooth orbit position
      const posAtT = getSatellitePositionAtTime(sat, t);
      const lat = posAtT.lat;
      const lon = posAtT.lon;

      const altScale = EARTH_RADIUS + (sat.altitude / 6371) * EARTH_RADIUS * 0.6;
      const pos = latLonToVec3(lat, lon, Math.min(altScale, EARTH_RADIUS * 2.5));
      dummy.position.set(pos[0], pos[1], pos[2]);
      
      // Point the Z-axis to the Earth center and orient panels tangent
      dummy.lookAt(0, 0, 0);
      
      const isISS = sat.category === 'iss';
      const baseScale = isISS ? 0.08 : sat.category === 'starlink' ? 0.025 : 0.05;
      dummy.scale.setScalar(baseScale * zoomFactor);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Color by category
      const color = new THREE.Color();
      switch (sat.category) {
        case 'iss': color.set('#ff6b35'); break;
        case 'starlink': color.set('#ffffff'); break;
        case 'gps': color.set('#00ff88'); break;
        case 'galileo': color.set('#3b82f6'); break;
        case 'glonass': color.set('#ef4444'); break;
        case 'weather': color.set('#f59e0b'); break;
        case 'communication': color.set('#8b5cf6'); break;
        default: color.set('#94a3b8'); break;
      }
      meshRef.current.setColorAt(i, color);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  if (visibleSats.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[satelliteGeom, undefined, visibleSats.length]}
      onClick={(e) => {
        e.stopPropagation();
        const idx = e.instanceId;
        if (idx !== undefined && visibleSats[idx]) {
          selectSatellite(visibleSats[idx].id);
        }
      }}
    >
      <instancedBufferAttribute
        key={visibleSats.length}
        attach="instanceColor"
        args={[new Float32Array(visibleSats.length * 3).fill(1), 3]}
      />
      <meshBasicMaterial vertexColors toneMapped={false} />
    </instancedMesh>
  );
}

/* ================================================================
   ISS LABEL
   ================================================================ */
function ISSLabel() {
  const issPos = useSatelliteStore(s => s.issPosition);
  const showISS = useAppStore(s => s.showISS);

  if (!issPos || !showISS) return null;

  const altScale = EARTH_RADIUS + (issPos.alt / 6371) * EARTH_RADIUS * 0.6;
  const pos = latLonToVec3(issPos.lat, issPos.lon, Math.min(altScale, EARTH_RADIUS * 2.5));

  return (
    <Html position={pos} center distanceFactor={15} zIndexRange={[100, 0]}>
      <div style={{
        background: 'rgba(255, 107, 53, 0.2)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 107, 53, 0.5)',
        borderRadius: '8px', padding: '4px 10px',
        color: '#ff6b35', fontSize: '11px', fontWeight: 700,
        fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap',
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff6b35', boxShadow: '0 0 8px #ff6b35', animation: 'pulseGlow 2s infinite' }} />
        ISS
      </div>
    </Html>
  );
}

/* ================================================================
   ORBIT RINGS (visual reference)
   ================================================================ */
function OrbitRings() {
  const showOrbits = useAppStore(s => s.showOrbits);

  const orbits = useMemo(() => {
    const rings = [
      { radius: EARTH_RADIUS + EARTH_RADIUS * 0.08, color: '#ff6b35', label: 'LEO (ISS ~420km)' },
      { radius: EARTH_RADIUS + EARTH_RADIUS * 0.6, color: '#00ff88', label: 'MEO (GPS ~20,200km)' },
      { radius: EARTH_RADIUS + EARTH_RADIUS * 1.5, color: '#f59e0b', label: 'GEO (~35,786km)' },
    ];
    
    return rings.map(orbit => {
      const points = [];
      const segments = 128;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(theta) * orbit.radius, 0, Math.sin(theta) * orbit.radius));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      return { ...orbit, geometry };
    });
  }, []);

  if (!showOrbits) return null;

  return (
    <group>
      {orbits.map((orbit, i) => (
        <lineLoop key={i} geometry={orbit.geometry}>
          <lineBasicMaterial color={orbit.color} transparent opacity={0.4} />
        </lineLoop>
      ))}
    </group>
  );
}

function SatelliteFootprints() {
  const selectedSatId = useAppStore(s => s.selectedSatelliteId);
  const satellites = useSatelliteStore(s => s.satellites);
  const groupRef = useRef<THREE.Group>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const borderMatRef = useRef<THREE.LineBasicMaterial>(null);

  const selectedSat = useMemo(() => {
    if (!selectedSatId) return null;
    return satellites.find(s => s.id === selectedSatId) || null;
  }, [selectedSatId, satellites]);

  const [geomParams, setGeomParams] = useState<{ radius: number; theta: number } | null>(null);

  const footprintGeometry = useMemo(() => {
    if (!geomParams) return null;
    return new THREE.SphereGeometry(geomParams.radius, 64, 32, 0, Math.PI * 2, 0, geomParams.theta);
  }, [geomParams]);

  const borderGeometry = useMemo(() => {
    if (!geomParams) return null;
    const points = [];
    const segments = 64;
    const r = geomParams.radius * Math.sin(geomParams.theta);
    const h = geomParams.radius * Math.cos(geomParams.theta);
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * r, h, Math.sin(angle) * r));
    }
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    return geom;
  }, [geomParams]);

  // Clean up geometries on change
  useEffect(() => {
    return () => {
      if (footprintGeometry) footprintGeometry.dispose();
    };
  }, [footprintGeometry]);

  useEffect(() => {
    return () => {
      if (borderGeometry) borderGeometry.dispose();
    };
  }, [borderGeometry]);

  useFrame(() => {
    if (!selectedSat) return;

    const satDist = EARTH_RADIUS + (selectedSat.altitude / 6371) * EARTH_RADIUS * 0.6;
    const maxDistance = Math.min(satDist, EARTH_RADIUS * 2.5);
    const theta = Math.acos(EARTH_RADIUS / maxDistance);
    const radius = EARTH_RADIUS * 1.0015; // slightly above surface to prevent z-fighting

    if (!geomParams || Math.abs(geomParams.theta - theta) > 0.001 || geomParams.radius !== radius) {
      setGeomParams({ radius, theta });
    }

    if (groupRef.current) {
      const t = Date.now() / 1000;
      const { lat, lon } = getSatellitePositionAtTime(selectedSat, t);
      const targetDir = new THREE.Vector3(...latLonToVec3(lat, lon, 1)).normalize();
      const alignQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), targetDir);
      groupRef.current.quaternion.copy(alignQuaternion);
    }

    // Color based on category
    let colorStr = '#94a3b8';
    if (selectedSat.category === 'iss') colorStr = '#ff6b35';
    else if (selectedSat.category === 'starlink') colorStr = '#ffffff';
    else if (selectedSat.category === 'gps') colorStr = '#00ff88';
    else if (selectedSat.category === 'galileo') colorStr = '#3b82f6';
    else if (selectedSat.category === 'glonass') colorStr = '#ef4444';
    else if (selectedSat.category === 'weather') colorStr = '#f59e0b';
    else if (selectedSat.category === 'communication') colorStr = '#8b5cf6';

    const color = new THREE.Color(colorStr);
    if (ringMatRef.current) ringMatRef.current.color.copy(color);
    if (borderMatRef.current) borderMatRef.current.color.copy(color);
  });

  if (!selectedSat || !footprintGeometry || !borderGeometry) return null;

  return (
    <group ref={groupRef}>
      <mesh geometry={footprintGeometry}>
        <meshBasicMaterial ref={ringMatRef} transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <lineLoop geometry={borderGeometry}>
        <lineBasicMaterial ref={borderMatRef} transparent opacity={0.4} linewidth={1.5} />
      </lineLoop>
    </group>
  );
}

function GroundTracks() {
  const selectedSatId = useAppStore(s => s.selectedSatelliteId);
  const satellites = useSatelliteStore(s => s.satellites);

  const selectedSat = useMemo(() => {
    if (!selectedSatId) return null;
    return satellites.find(s => s.id === selectedSatId) || null;
  }, [selectedSatId, satellites]);

  // Pre-allocate buffer geometry to prevent GC thrashing
  const staticGeometry = useMemo(() => {
    const points = [];
    for (let i = 0; i <= 96; i++) {
      points.push(new THREE.Vector3(0, 0, 0));
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, []);

  const lineObject = useMemo(() => {
    const lineMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.6, linewidth: 1.5 });
    return new THREE.Line(staticGeometry, lineMat);
  }, [staticGeometry]);

  // Clean up objects on unmount/change
  useEffect(() => {
    return () => {
      staticGeometry.dispose();
    };
  }, [staticGeometry]);

  useEffect(() => {
    return () => {
      lineObject.material.dispose();
    };
  }, [lineObject]);

  useFrame(() => {
    if (!selectedSat) return;
    
    const t = Date.now() / 1000;
    const steps = 96;
    const periodSec = selectedSat.period * 60;
    const positions = lineObject.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i <= steps; i++) {
      const tFuture = t + (i / steps) * periodSec;
      const { lat, lon } = getSatellitePositionAtTime(selectedSat, tFuture);
      const pos = latLonToVec3(lat, lon, EARTH_RADIUS * 1.002);
      positions[i * 3] = pos[0];
      positions[i * 3 + 1] = pos[1];
      positions[i * 3 + 2] = pos[2];
    }
    lineObject.geometry.attributes.position.needsUpdate = true;
    
    // Set color based on category
    let colorStr = '#94a3b8';
    if (selectedSat.category === 'iss') colorStr = '#ff6b35';
    else if (selectedSat.category === 'starlink') colorStr = '#ffffff';
    else if (selectedSat.category === 'gps') colorStr = '#00ff88';
    else if (selectedSat.category === 'galileo') colorStr = '#3b82f6';
    else if (selectedSat.category === 'glonass') colorStr = '#ef4444';
    else if (selectedSat.category === 'weather') colorStr = '#f59e0b';
    else if (selectedSat.category === 'communication') colorStr = '#8b5cf6';

    const color = new THREE.Color(colorStr);
    (lineObject.material as THREE.LineBasicMaterial).color.copy(color);
  });

  if (!selectedSat) return null;

  return <primitive object={lineObject} />;
}

/* ================================================================
   CAMERA CONTROLLER
   ================================================================ */
function CameraController() {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();
  const viewTarget = useAppStore(s => s.viewTarget);

  useEffect(() => {
    if (viewTarget && controlsRef.current) {
      const pos = latLonToVec3(viewTarget.lat, viewTarget.lon, EARTH_RADIUS * 1.5);
      const targetPos = new THREE.Vector3(pos[0], pos[1], pos[2]);
      targetPos.applyEuler(new THREE.Euler(0, -Math.PI / 2, 0.41));

      // Smooth fly-to
      const startPos = camera.position.clone();
      const startTime = Date.now();
      const duration = 2000;

      function animate() {
        const t = Math.min((Date.now() - startTime) / duration, 1);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        camera.position.lerpVectors(startPos, targetPos, eased);
        camera.lookAt(0, 0, 0);
        if (t < 1) requestAnimationFrame(animate);
      }
      animate();
    }
  }, [viewTarget, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping dampingFactor={0.05}
      minDistance={EARTH_RADIUS * 1.1}
      maxDistance={EARTH_RADIUS * 8}
      rotateSpeed={0.5} zoomSpeed={1.2} panSpeed={0.8}
      enablePan={false}
    />
  );
}

/* ================================================================
   SCENE COMPOSITION
   ================================================================ */
function Scene() {
  const sunRef = useRef<THREE.DirectionalLight>(null);

  return (
    <>
      <color attach="background" args={['#000008']} />
      <Stars radius={300} depth={100} count={8000} factor={4} saturation={0.2} fade speed={0.5} />
      
      <group rotation={[0, -Math.PI / 2, 0.41]}>
        <Earth sunRef={sunRef} />
        <AircraftLayer />
        <FlightRoutes />
        <SatelliteLayer />
        <SatelliteFootprints />
        <GroundTracks />
        <ISSLabel />
        <OrbitRings />
      </group>

      {/* Sun light in World Space */}
      <directionalLight ref={sunRef} intensity={2.5} color="#fff5e6" castShadow />
      <ambientLight intensity={0.08} color="#4466aa" />
      
      <CameraController />
    </>
  );
}

/* ================================================================
   GLOBE CANVAS (exported)
   ================================================================ */
export default function EarthScene() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
      <Canvas
        camera={{ position: [0, 0, EARTH_RADIUS * 3], fov: 45, near: 0.1, far: 1000 }}
        gl={{
          antialias: true, alpha: false, powerPreference: 'high-performance',
          stencil: false, depth: true,
        }}
        dpr={[1, 2]}
        performance={{ min: 0.5 }}
      >
        <React.Suspense fallback={null}>
          <Scene />
        </React.Suspense>
      </Canvas>
    </div>
  );
}
