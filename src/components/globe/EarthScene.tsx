'use client';

import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore, useFlightStore, useSatelliteStore } from '@/stores/stores';
import { latLonToVec3, greatCircleArc, getSunPosition, AIRPORTS } from '@/lib/data';

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

  // Main Fuselage (Cylinder)
  const fuselage = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8);
  fuselage.translate(0, 0.05, 0);
  geometries.push(fuselage);

  // Nose Cone (Cone pointing forward/+Y)
  const nose = new THREE.ConeGeometry(0.04, 0.15, 8);
  nose.translate(0, 0.375, 0);
  geometries.push(nose);

  // Tail Cone (Cylinder tapering to back/-Y)
  const tailCone = new THREE.CylinderGeometry(0.04, 0.015, 0.2, 8);
  tailCone.translate(0, -0.3, 0);
  geometries.push(tailCone);

  // Left Wing (Swept back)
  const wingLeft = new THREE.BoxGeometry(0.4, 0.12, 0.02);
  wingLeft.translate(-0.2, 0, 0);
  wingLeft.rotateZ(-Math.PI / 12); // -15 deg sweep
  wingLeft.translate(0, 0.05, 0);
  geometries.push(wingLeft);

  // Right Wing (Swept back)
  const wingRight = new THREE.BoxGeometry(0.4, 0.12, 0.02);
  wingRight.translate(0.2, 0, 0);
  wingRight.rotateZ(Math.PI / 12); // +15 deg sweep
  wingRight.translate(0, 0.05, 0);
  geometries.push(wingRight);

  // Left Horizontal Stabilizer (Swept back)
  const stabilizerLeft = new THREE.BoxGeometry(0.16, 0.06, 0.01);
  stabilizerLeft.translate(-0.08, 0, 0);
  stabilizerLeft.rotateZ(-Math.PI / 8);
  stabilizerLeft.translate(0, -0.35, 0);
  geometries.push(stabilizerLeft);

  // Right Horizontal Stabilizer (Swept back)
  const stabilizerRight = new THREE.BoxGeometry(0.16, 0.06, 0.01);
  stabilizerRight.translate(0.08, 0, 0);
  stabilizerRight.rotateZ(Math.PI / 8);
  stabilizerRight.translate(0, -0.35, 0);
  geometries.push(stabilizerRight);

  // Vertical Stabilizer (Swept back)
  const stabilizerVert = new THREE.BoxGeometry(0.01, 0.08, 0.14);
  stabilizerVert.rotateX(-Math.PI / 8);
  stabilizerVert.translate(0, -0.36, 0.07);
  geometries.push(stabilizerVert);

  // Engines
  const engineLeft = new THREE.CylinderGeometry(0.018, 0.016, 0.12, 8);
  engineLeft.translate(-0.14, 0.05, -0.04);
  geometries.push(engineLeft);

  const engineRight = new THREE.CylinderGeometry(0.018, 0.016, 0.12, 8);
  engineRight.translate(0.14, 0.05, -0.04);
  geometries.push(engineRight);

  const merged = mergeGeometries(geometries);
  
  // Clean up source geometries
  fuselage.dispose();
  nose.dispose();
  tailCone.dispose();
  wingLeft.dispose();
  wingRight.dispose();
  stabilizerLeft.dispose();
  stabilizerRight.dispose();
  stabilizerVert.dispose();
  engineLeft.dispose();
  engineRight.dispose();

  return merged;
}

function createSatelliteGeometry(): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  // Satellite Central Bus (Cylinder)
  const body = new THREE.CylinderGeometry(0.08, 0.08, 0.24, 8);
  geometries.push(body);

  // Left Solar Panel (Box)
  const panelLeft = new THREE.BoxGeometry(0.35, 0.12, 0.01);
  panelLeft.translate(-0.28, 0, 0);
  geometries.push(panelLeft);

  // Right Solar Panel (Box)
  const panelRight = new THREE.BoxGeometry(0.35, 0.12, 0.01);
  panelRight.translate(0.28, 0, 0);
  geometries.push(panelRight);

  // Connector Rod Left
  const rodLeft = new THREE.CylinderGeometry(0.01, 0.01, 0.12, 6);
  rodLeft.rotateZ(Math.PI / 2);
  rodLeft.translate(-0.14, 0, 0);
  geometries.push(rodLeft);

  // Connector Rod Right
  const rodRight = new THREE.CylinderGeometry(0.01, 0.01, 0.12, 6);
  rodRight.rotateZ(Math.PI / 2);
  rodRight.translate(0.14, 0, 0);
  geometries.push(rodRight);

  // Dish Antenna (Cone pointing forward/+Z towards Earth)
  const dish = new THREE.ConeGeometry(0.07, 0.07, 8);
  dish.rotateX(Math.PI / 2);
  dish.translate(0, 0, 0.14);
  geometries.push(dish);

  // Mast Antenna (Cylinder pointing backward/-Z)
  const mast = new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6);
  mast.rotateX(Math.PI / 2);
  mast.translate(0, 0, -0.16);
  geometries.push(mast);

  const merged = mergeGeometries(geometries);
  
  body.dispose();
  panelLeft.dispose();
  panelRight.dispose();
  rodLeft.dispose();
  rodRight.dispose();
  dish.dispose();
  mast.dispose();

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
    let wrappedLon = (sat.raan + trueAnomaly - (t * 0.00417)) % 360;
    if (wrappedLon > 180) wrappedLon -= 360;
    if (wrappedLon < -180) wrappedLon += 360;
    lon = wrappedLon;
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
  uniform sampler2D uCloudMap;
  uniform vec3 uSunDirection;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec3 normal = normalize(vNormal);
    float sunDot = dot(normal, normalize(uSunDirection));
    float dayFactor = smoothstep(-0.15, 0.2, sunDot);
    vec4 dayTex = texture2D(uDayMap, vUv);
    vec4 nightTex = texture2D(uNightMap, vUv);
    
    // Detect water (blue dominance in Blue Marble texture)
    float isWater = smoothstep(0.08, 0.5, dayTex.b - dayTex.r);
    
    // Procedural wave perturbation for specular reflection
    float waveVal = sin(vWorldPosition.x * 25.0 + uTime * 2.2) * cos(vWorldPosition.y * 25.0 + uTime * 1.6) * 0.02 * isWater;
    vec3 waveNormal = normalize(normal + vec3(waveVal, 0.0, waveVal));
    
    // Projected cloud shadow offset
    vec2 shadowUv = vUv - normalize(uSunDirection).xy * 0.005;
    vec4 cloudTex = texture2D(uCloudMap, shadowUv);
    float cloudShadow = 1.0 - (cloudTex.a * 0.45);
    
    // Enhance day side with boosted diffuse lighting & shadows
    float diffuse = max(0.0, sunDot);
    vec3 dayColor = dayTex.rgb * (1.0 + diffuse * 0.6) * 1.5 * cloudShadow;
    
    // Specular ocean reflection
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 reflectDir = reflect(-normalize(uSunDirection), waveNormal);
    float spec = pow(max(0.0, dot(viewDir, reflectDir)), 32.0);
    vec3 specularColor = vec3(0.75, 0.88, 1.0) * spec * isWater * dayFactor;
    dayColor += specularColor;
    
    // Night lights glow
    vec3 nightLights = nightTex.rgb * 1.8;
    
    // Boosted ambient night geography using raw day texture
    vec3 nightAmbient = dayTex.rgb * vec3(0.6, 0.68, 0.85) * 1.6;
    vec3 nightSide = nightLights + nightAmbient;
    
    vec4 finalColor = mix(vec4(nightSide, 1.0), vec4(dayColor, 1.0), dayFactor);
    
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
    uCloudMap: { value: procTextures.clouds as THREE.Texture },
    uSunDirection: { value: new THREE.Vector3(1, 0.3, 0.5).normalize() },
    uTime: { value: 0 },
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
    loader.setCrossOrigin('anonymous');
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
      earthUniforms.uCloudMap.value = tex;
    }, undefined, () => {});
  }, [earthUniforms]);

  useFrame((state) => {
    const sun = getSunPosition();
    const localDir = new THREE.Vector3(...sun.direction).normalize();
    const worldDir = localDir.clone().applyEuler(new THREE.Euler(0, -Math.PI / 2, 0.41));
    
    if (uniformsRef.current) {
      uniformsRef.current.uSunDirection.value.copy(worldDir);
      uniformsRef.current.uTime.value = state.clock.getElapsedTime();
    }
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
  const setViewTarget = useAppStore(s => s.setViewTarget);
  const setHoveredEntity = useAppStore(s => s.setHoveredEntity);
  const selectedId = useAppStore(s => s.selectedAircraftId);
  const realisticColors = useAppStore(s => s.realisticColors);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const clickMeshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const { camera } = useThree();
  
  const airplaneGeom = useMemo(() => createAirplaneGeometry(), []);
  const clickGeom = useMemo(() => new THREE.SphereGeometry(1.5, 8, 8), []);

  useEffect(() => {
    return () => {
      airplaneGeom.dispose();
      clickGeom.dispose();
    };
  }, [airplaneGeom, clickGeom]);

  const filteredAircraft = useMemo(() =>
    showFlights ? aircraft.slice(0, 500) : [],
  [aircraft, showFlights]);

  useFrame(() => {
    if (!meshRef.current || filteredAircraft.length === 0) return;
    const count = filteredAircraft.length;
    const camDist = camera.position.length();
    const zoomFactor = Math.max(1.0, Math.min(5.5, camDist / (EARTH_RADIUS * 1.5)));
    
    // Hide individual planes if camera is zoomed far out
    const showIndividual = camDist < EARTH_RADIUS * 4.2;

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

      const baseScale = ac.id === selectedId ? 0.24 : 0.14;
      const finalScale = showIndividual ? (baseScale * zoomFactor) : (ac.id === selectedId ? baseScale * 0.5 : 0.0);
      dummy.scale.setScalar(finalScale);
      dummy.updateMatrix();
      
      meshRef.current.setMatrixAt(i, dummy.matrix);
      if (clickMeshRef.current) clickMeshRef.current.setMatrixAt(i, dummy.matrix);

      // Altitude color coding or Realistic styling
      let color;
      if (realisticColors) {
        if (ac.id === selectedId) {
          color = new THREE.Color('#00d4ff'); // highlighted cyan for selected aircraft
        } else {
          color = new THREE.Color('#ffffff'); // realistic white
        }
      } else {
        const altNorm = Math.min(ac.altitude / 13000, 1);
        const r = altNorm < 0.5 ? 0.0 : 1.0;
        const g = altNorm < 0.5 ? 0.83 : 1.0 - (altNorm - 0.5) * 2;
        const b = altNorm < 0.5 ? 1.0 : 0.2;
        color = new THREE.Color(r, g, b);
      }
      meshRef.current.setColorAt(i, color);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
    if (clickMeshRef.current) {
      clickMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  if (filteredAircraft.length === 0) return null;

  return (
    <group>
      {/* Visual Mesh */}
      <instancedMesh
        ref={meshRef}
        args={[airplaneGeom, undefined, filteredAircraft.length]}
      >
        <instancedBufferAttribute
          key={filteredAircraft.length}
          attach="instanceColor"
          args={[new Float32Array(filteredAircraft.length * 3).fill(1), 3]}
        />
        <meshBasicMaterial toneMapped={false} side={THREE.DoubleSide} transparent opacity={0.95} />
      </instancedMesh>

      {/* Click Interaction Mesh (Invisible but clickable spheres) */}
      <instancedMesh
        ref={clickMeshRef}
        args={[clickGeom, undefined, filteredAircraft.length]}
        onClick={(e) => {
          e.stopPropagation();
          const idx = e.instanceId;
          if (idx !== undefined && filteredAircraft[idx]) {
            const ac = filteredAircraft[idx];
            selectAircraft(ac.id);
            setViewTarget({ lat: ac.latitude, lon: ac.longitude, entityId: ac.id, entityType: 'aircraft' });
          }
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          const idx = e.instanceId;
          if (idx !== undefined && filteredAircraft[idx]) {
            const ac = filteredAircraft[idx];
            document.body.style.cursor = 'pointer';
            setHoveredEntity(ac.id, 'aircraft');
          }
        }}
        onPointerOut={(e) => {
          document.body.style.cursor = 'default';
          setHoveredEntity(null, null);
        }}
      >
        <meshBasicMaterial toneMapped={false} transparent opacity={0} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

/* ================================================================
   FLIGHT ROUTES (selected aircraft split into History & Remaining)
   ================================================================ */
function FlightRoutes() {
  const aircraft = useFlightStore(s => s.aircraft);
  const selectedId = useAppStore(s => s.selectedAircraftId);

  const selectedAircraft = useMemo(() => {
    if (!selectedId) return null;
    return aircraft.find(a => a.id === selectedId) || null;
  }, [selectedId, aircraft]);

  const routeDetails = useMemo(() => {
    if (!selectedAircraft) return null;

    const originCode = selectedAircraft.origin.substring(0, 3);
    const destCode = selectedAircraft.destination.substring(0, 3);
    const originAirport = AIRPORTS[originCode];
    const destAirport = AIRPORTS[destCode];

    if (!originAirport || !destAirport) return null;

    return { originAirport, destAirport };
  }, [selectedAircraft]);

  const [historyGeom, setHistoryGeom] = useState<THREE.BufferGeometry | null>(null);
  const [remainGeom, setRemainGeom] = useState<THREE.BufferGeometry | null>(null);

  useFrame(() => {
    if (!selectedAircraft || !routeDetails) return;

    // Calculate current interpolated position of selected flight
    const elapsedSec = Math.min((Date.now() - selectedAircraft.lastUpdate) / 1000, 4);
    const speedDeg = (selectedAircraft.speed / 111320) * elapsedSec;
    const headingRad = (selectedAircraft.heading * Math.PI) / 180;
    
    let latInterp = selectedAircraft.latitude + Math.cos(headingRad) * speedDeg;
    const cosLat = Math.cos((selectedAircraft.latitude * Math.PI) / 180);
    let lonInterp = selectedAircraft.longitude + Math.sin(headingRad) * speedDeg / (cosLat > 0.1 ? cosLat : 1.0);
    
    if (lonInterp > 180) lonInterp -= 360;
    if (lonInterp < -180) lonInterp += 360;
    if (latInterp > 85) latInterp = 85;
    if (latInterp < -85) latInterp = -85;

    const { originAirport, destAirport } = routeDetails;

    // History Arc (Origin to current position)
    const histPts = greatCircleArc(
      originAirport.lat, originAirport.lon,
      latInterp, lonInterp,
      EARTH_RADIUS * 1.003, 32, 0.08
    ).map(p => new THREE.Vector3(...p));
    
    const hGeom = new THREE.BufferGeometry().setFromPoints(histPts);
    hGeom.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), EARTH_RADIUS * 2.5);

    // Remaining Arc (Current position to destination)
    const remPts = greatCircleArc(
      latInterp, lonInterp,
      destAirport.lat, destAirport.lon,
      EARTH_RADIUS * 1.003, 32, 0.08
    ).map(p => new THREE.Vector3(...p));

    const rGeom = new THREE.BufferGeometry().setFromPoints(remPts);
    rGeom.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), EARTH_RADIUS * 2.5);

    // Clean up old geometries
    if (historyGeom) historyGeom.dispose();
    if (remainGeom) remainGeom.dispose();

    setHistoryGeom(hGeom);
    setRemainGeom(rGeom);
  });

  useEffect(() => {
    return () => {
      if (historyGeom) historyGeom.dispose();
      if (remainGeom) remainGeom.dispose();
    };
  }, [historyGeom, remainGeom]);

  if (!selectedAircraft || !historyGeom || !remainGeom) return null;

  return (
    <group>
      {/* Completed path (History) - solid glowing cyan */}
      {/* @ts-ignore */}
      <line geometry={historyGeom}>
        <lineBasicMaterial color="#00ffcc" transparent opacity={0.85} linewidth={2.5} />
      </line>
      {/* Remaining path - dashed/semi-transparent cyan */}
      {/* @ts-ignore */}
      <line geometry={remainGeom}>
        <lineBasicMaterial color="#00d4ff" transparent opacity={0.3} linewidth={1.5} />
      </line>
    </group>
  );
}

/* ================================================================
   SELECTED FLIGHT MARKERS (Origin & Destination airports)
   ================================================================ */
function SelectedFlightMarkers() {
  const aircraft = useFlightStore(s => s.aircraft);
  const selectedId = useAppStore(s => s.selectedAircraftId);

  const markers = useMemo(() => {
    if (!selectedId) return null;
    const ac = aircraft.find(a => a.id === selectedId);
    if (!ac) return null;

    const originCode = ac.origin.substring(0, 3);
    const destCode = ac.destination.substring(0, 3);
    const originAirport = AIRPORTS[originCode];
    const destAirport = AIRPORTS[destCode];

    if (!originAirport || !destAirport) return null;

    return {
      origin: {
        pos: latLonToVec3(originAirport.lat, originAirport.lon, EARTH_RADIUS * 1.002),
        code: originCode,
      },
      dest: {
        pos: latLonToVec3(destAirport.lat, destAirport.lon, EARTH_RADIUS * 1.002),
        code: destCode,
      }
    };
  }, [selectedId, aircraft]);

  if (!markers) return null;

  return (
    <group>
      {/* Origin Marker */}
      <mesh position={markers.origin.pos}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshBasicMaterial color="#00ff88" toneMapped={false} />
      </mesh>
      <Html position={markers.origin.pos} center distanceFactor={12} zIndexRange={[100, 0]}>
        <div style={{
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(4px)',
          border: '1px solid #00ff88',
          borderRadius: '4px', padding: '2px 6px',
          color: '#00ff88', fontSize: '9px', fontWeight: 700,
          fontFamily: 'sans-serif', whiteSpace: 'nowrap',
          boxShadow: '0 0 8px rgba(0, 255, 136, 0.4)',
        }}>
          DEP: {markers.origin.code}
        </div>
      </Html>

      {/* Destination Marker */}
      <mesh position={markers.dest.pos}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshBasicMaterial color="#ff4d4d" toneMapped={false} />
      </mesh>
      <Html position={markers.dest.pos} center distanceFactor={12} zIndexRange={[100, 0]}>
        <div style={{
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(4px)',
          border: '1px solid #ff4d4d',
          borderRadius: '4px', padding: '2px 6px',
          color: '#ff4d4d', fontSize: '9px', fontWeight: 700,
          fontFamily: 'sans-serif', whiteSpace: 'nowrap',
          boxShadow: '0 0 8px rgba(255, 77, 77, 0.4)',
        }}>
          ARR: {markers.dest.code}
        </div>
      </Html>
    </group>
  );
}

/* ================================================================
   AURORA RINGS
   ================================================================ */
function AuroraRings() {
  const showAuroras = useAppStore(s => s.showAuroras);
  const ringRefNorth = useRef<THREE.Mesh>(null);
  const ringRefSouth = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();
    if (ringRefNorth.current) {
      ringRefNorth.current.rotation.z = elapsed * 0.08;
      const pulsate = 1.0 + Math.sin(elapsed * 2.0) * 0.05;
      ringRefNorth.current.scale.set(pulsate, pulsate, 1.0);
    }
    if (ringRefSouth.current) {
      ringRefSouth.current.rotation.z = -elapsed * 0.07;
      const pulsate = 1.0 + Math.cos(elapsed * 1.8) * 0.04;
      ringRefSouth.current.scale.set(pulsate, pulsate, 1.0);
    }
  });

  if (!showAuroras) return null;

  return (
    <group>
      <mesh ref={ringRefNorth} position={[0, EARTH_RADIUS * 0.94, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[EARTH_RADIUS * 0.22, EARTH_RADIUS * 0.38, 64]} />
        <meshBasicMaterial color="#00ff88" transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={ringRefSouth} position={[0, -EARTH_RADIUS * 0.94, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[EARTH_RADIUS * 0.22, EARTH_RADIUS * 0.38, 64]} />
        <meshBasicMaterial color="#8b5cf6" transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ================================================================
   WEATHER LAYER SHADERS & MESH
   ================================================================ */
const weatherVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const weatherFragmentShader = `
  uniform float uTime;
  uniform int uMode;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  
  void main() {
    vec4 color = vec4(0.0);
    if (uMode == 1) { // Temperature Map
      float temp = 1.0 - abs(vUv.y - 0.5) * 2.0;
      temp += noise(vUv * 8.0 + vec2(uTime * 0.1, 0.0)) * 0.15;
      vec3 cold = vec3(0.1, 0.35, 0.95);
      vec3 warm = vec3(0.9, 0.72, 0.22);
      vec3 hot = vec3(0.92, 0.16, 0.16);
      vec3 tempColor = mix(cold, warm, smoothstep(0.15, 0.62, temp));
      tempColor = mix(tempColor, hot, smoothstep(0.62, 0.88, temp));
      color = vec4(tempColor, 0.32);
    }
    else if (uMode == 2) { // Pressure Map
      float p = noise(vUv * 6.5 + vec2(0.0, uTime * 0.06));
      float cells = sin(p * 14.0) * 0.5 + 0.5;
      vec3 pressColor = mix(vec3(0.1, 0.85, 0.92), vec3(0.95, 0.95, 0.98), cells);
      color = vec4(pressColor, 0.24);
    }
    else if (uMode == 3) { // Wind Flow
      float windLine = sin(vUv.x * 130.0 + uTime * 5.5) * cos(vUv.y * 32.0) * 0.5 + 0.5;
      float mask = step(0.88, windLine);
      color = vec4(0.05, 0.9, 1.0, mask * 0.35);
    }
    else { // Storm Radar Cells
      float r1 = noise(vUv * 16.0 + vec2(uTime * 0.18, uTime * 0.12));
      float r2 = noise(vUv * 22.0 - vec2(uTime * 0.12, uTime * 0.16));
      float storm = smoothstep(0.58, 0.82, r1 * r2);
      vec3 radarColor = mix(vec3(0.02, 0.82, 0.22), vec3(0.92, 0.12, 0.12), step(0.72, r1 * r2));
      color = vec4(radarColor, storm * 0.45);
    }
    gl_FragColor = color;
  }
`;

function WeatherLayerMesh() {
  const showWeather = useAppStore(s => s.showWeather);
  const weatherLayerMode = useAppStore(s => s.weatherLayerMode);
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uMode: { value: 0 },
  }), []);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.getElapsedTime();
    let modeVal = 0;
    if (weatherLayerMode === 'temp') modeVal = 1;
    else if (weatherLayerMode === 'pressure') modeVal = 2;
    else if (weatherLayerMode === 'wind') modeVal = 3;
    uniforms.uMode.value = modeVal;
  });

  if (!showWeather) return null;

  return (
    <mesh scale={1.002}>
      <sphereGeometry args={[EARTH_RADIUS, 64, 32]} />
      <shaderMaterial
        vertexShader={weatherVertexShader}
        fragmentShader={weatherFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

/* ================================================================
   LIGHTNING BOLT VISUALIZER
   ================================================================ */
function LightningBolt() {
  const showWeather = useAppStore(s => s.showWeather);
  const [strike, setStrike] = useState<{ start: [number, number, number]; end: [number, number, number] } | null>(null);

  useFrame(() => {
    if (!showWeather) return;
    if (Math.random() < 0.007) {
      const lat = (Math.random() - 0.5) * 55;
      const lon = (Math.random() - 0.5) * 360;
      const startPos = latLonToVec3(lat, lon, EARTH_RADIUS * 1.035);
      const endPos = latLonToVec3(lat + (Math.random() - 0.5) * 1.8, lon + (Math.random() - 0.5) * 1.8, EARTH_RADIUS * 1.0025);
      setStrike({ start: startPos, end: endPos });
      setTimeout(() => setStrike(null), 120);
    }
  });

  if (!strike) return null;

  const points = [
    new THREE.Vector3(...strike.start),
    new THREE.Vector3(
      (strike.start[0] + strike.end[0]) / 2 + (Math.random() - 0.5) * 0.08,
      (strike.start[1] + strike.end[1]) / 2 + (Math.random() - 0.5) * 0.08,
      (strike.start[2] + strike.end[2]) / 2 + (Math.random() - 0.5) * 0.08
    ),
    new THREE.Vector3(...strike.end)
  ];
  const geom = new THREE.BufferGeometry().setFromPoints(points);

  return (
    <group>
      {/* @ts-ignore */}
      <line geometry={geom}>
        <lineBasicMaterial color="#00e5ff" linewidth={2} toneMapped={false} />
      </line>
    </group>
  );
}

/* ================================================================
   SATELLITE COVERAGE CONE
   ================================================================ */
function CoverageCone() {
  const selectedSatId = useAppStore(s => s.selectedSatelliteId);
  const satellites = useSatelliteStore(s => s.satellites);
  const groupRef = useRef<THREE.Group>(null);

  const selectedSat = useMemo(() => {
    if (!selectedSatId) return null;
    return satellites.find(s => s.id === selectedSatId) || null;
  }, [selectedSatId, satellites]);

  useFrame(() => {
    if (!selectedSat || !groupRef.current) return;
    const t = Date.now() / 1000;
    const { lat, lon } = getSatellitePositionAtTime(selectedSat, t);
    const satDist = EARTH_RADIUS + (selectedSat.altitude / 6371) * EARTH_RADIUS * 0.6;
    const maxDistance = Math.min(satDist, EARTH_RADIUS * 2.5);
    const height = maxDistance - EARTH_RADIUS;
    const dir = new THREE.Vector3(...latLonToVec3(lat, lon, 1)).normalize();
    const midPoint = dir.clone().multiplyScalar(EARTH_RADIUS + height / 2);
    groupRef.current.position.copy(midPoint);
    const alignQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    groupRef.current.quaternion.copy(alignQuaternion);
  });

  const coneGeometry = useMemo(() => {
    if (!selectedSat) return null;
    const satDist = EARTH_RADIUS + (selectedSat.altitude / 6371) * EARTH_RADIUS * 0.6;
    const maxDistance = Math.min(satDist, EARTH_RADIUS * 2.5);
    const theta = Math.acos(EARTH_RADIUS / maxDistance);
    const height = maxDistance - EARTH_RADIUS;
    const baseRadius = EARTH_RADIUS * Math.sin(theta);
    return new THREE.CylinderGeometry(0.005, baseRadius, height, 32, 1, true);
  }, [selectedSat]);

  useEffect(() => {
    return () => {
      if (coneGeometry) coneGeometry.dispose();
    };
  }, [coneGeometry]);

  if (!selectedSat || !coneGeometry) return null;

  let colorStr = '#3b82f6';
  if (selectedSat.category === 'iss') colorStr = '#ff6b35';
  else if (selectedSat.category === 'starlink') colorStr = '#ffffff';
  else if (selectedSat.category === 'weather') colorStr = '#00ff88';
  else if (selectedSat.category === 'communication') colorStr = '#8b5cf6';
  else if (selectedSat.category === 'scientific') colorStr = '#ffd700';

  return (
    <group ref={groupRef}>
      <mesh geometry={coneGeometry}>
        <meshBasicMaterial color={colorStr} transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ================================================================
   SIGNAL BEAMS (Uplink/Downlink)
   ================================================================ */
function SignalBeam() {
  const selectedSatId = useAppStore(s => s.selectedSatelliteId);
  const satellites = useSatelliteStore(s => s.satellites);
  const [pulse, setPulse] = useState(0);

  const selectedSat = useMemo(() => {
    if (!selectedSatId) return null;
    return satellites.find(s => s.id === selectedSatId) || null;
  }, [selectedSatId, satellites]);

  const nearestAirport = useMemo(() => {
    if (!selectedSat) return null;
    let minD = 999999;
    let bestAp = null;
    for (const [code, ap] of Object.entries(AIRPORTS)) {
      const d = Math.abs(ap.lat - selectedSat.latitude) + Math.abs(ap.lon - selectedSat.longitude);
      if (d < minD) {
        minD = d;
        bestAp = { code, ...ap };
      }
    }
    return bestAp;
  }, [selectedSat]);

  useFrame((state) => {
    if (!selectedSat) return;
    setPulse((state.clock.getElapsedTime() * 3.2) % 1.0);
  });

  const lineObject = useMemo(() => {
    if (!selectedSat || !nearestAirport) return null;
    const t = Date.now() / 1000;
    const { lat, lon } = getSatellitePositionAtTime(selectedSat, t);
    const satDist = EARTH_RADIUS + (selectedSat.altitude / 6371) * EARTH_RADIUS * 0.6;
    const maxDistance = Math.min(satDist, EARTH_RADIUS * 2.5);
    const satPos = new THREE.Vector3(...latLonToVec3(lat, lon, maxDistance));
    const airPos = new THREE.Vector3(...latLonToVec3(nearestAirport.lat, nearestAirport.lon, EARTH_RADIUS * 1.0025));
    const geom = new THREE.BufferGeometry().setFromPoints([satPos, airPos]);
    const mat = new THREE.LineBasicMaterial({
      color: '#00e5ff',
      transparent: true,
      opacity: 0.85 * (1.0 - pulse),
      linewidth: 2,
    });
    return new THREE.Line(geom, mat);
  }, [selectedSat, nearestAirport, pulse]);

  useEffect(() => {
    return () => {
      if (lineObject) {
        lineObject.geometry.dispose();
        lineObject.material.dispose();
      }
    };
  }, [lineObject]);

  if (!lineObject) return null;

  return <primitive object={lineObject} />;
}

/* ================================================================
   AIRPORT MARKERS
   ================================================================ */
function AirportMarkers() {
  const selectAirport = useAppStore(s => s.selectAirport);
  const setViewTarget = useAppStore(s => s.setViewTarget);
  const selectedAirportCode = useAppStore(s => s.selectedAirportCode);
  
  const markers = useMemo(() => {
    return Object.entries(AIRPORTS).map(([code, ap]) => ({
      code,
      name: ap.name,
      pos: latLonToVec3(ap.lat, ap.lon, EARTH_RADIUS * 1.0012),
    }));
  }, []);

  return (
    <group>
      {markers.map(m => {
        const isSelected = m.code === selectedAirportCode;
        return (
          <mesh
            key={m.code}
            position={m.pos}
            onClick={(e) => {
              e.stopPropagation();
              selectAirport(m.code);
              setViewTarget({ lat: AIRPORTS[m.code].lat, lon: AIRPORTS[m.code].lon, entityId: m.code, entityType: 'airport' });
            }}
          >
            <sphereGeometry args={[isSelected ? 0.038 : 0.022, 8, 8]} />
            <meshBasicMaterial color={isSelected ? '#00d4ff' : '#94a3b8'} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

/* ================================================================
   3D SATELLITE ORBIT PATH (Glowing Inclined Circle in Space)
   ================================================================ */
function SatelliteOrbitTrail3D() {
  const selectedSatId = useAppStore(s => s.selectedSatelliteId);
  const satellites = useSatelliteStore(s => s.satellites);

  const selectedSat = useMemo(() => {
    if (!selectedSatId) return null;
    return satellites.find(s => s.id === selectedSatId) || null;
  }, [selectedSatId, satellites]);

  const geometry = useMemo(() => {
    if (!selectedSat) return null;
    const points = [];
    const steps = 128;
    const periodSec = selectedSat.period * 60;
    const t = Date.now() / 1000;
    const satDist = EARTH_RADIUS + (selectedSat.altitude / 6371) * EARTH_RADIUS * 0.6;
    const maxDistance = Math.min(satDist, EARTH_RADIUS * 2.5);

    for (let i = 0; i <= steps; i++) {
      const tFuture = t + (i / steps) * periodSec;
      const { lat, lon } = getSatellitePositionAtTime(selectedSat, tFuture);
      const pos = latLonToVec3(lat, lon, maxDistance);
      points.push(new THREE.Vector3(...pos));
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [selectedSat]);

  useEffect(() => {
    return () => {
      if (geometry) geometry.dispose();
    };
  }, [geometry]);

  if (!selectedSat || !geometry) return null;

  let colorStr = '#3b82f6';
  if (selectedSat.category === 'iss') colorStr = '#ff6b35';
  else if (selectedSat.category === 'starlink') colorStr = '#ffffff';
  else if (selectedSat.category === 'weather') colorStr = '#00ff88';
  else if (selectedSat.category === 'communication') colorStr = '#8b5cf6';
  else if (selectedSat.category === 'scientific') colorStr = '#ffd700';

  return (
    <lineLoop geometry={geometry}>
      <lineBasicMaterial color={colorStr} transparent opacity={0.4} linewidth={1.5} />
    </lineLoop>
  );
}

/* ================================================================
   FLIGHT TRAFFIC HEATMAP (Zoom-Dependent Cloud Layer)
   ================================================================ */
function FlightHeatmapLayer() {
  const aircraft = useFlightStore(s => s.aircraft);
  const showFlights = useAppStore(s => s.showFlights);
  const showHeatmap = useAppStore(s => s.showHeatmap);
  const { camera } = useThree();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const geom = useMemo(() => new THREE.SphereGeometry(0.12, 8, 8), []);

  useEffect(() => {
    return () => {
      geom.dispose();
    };
  }, [geom]);

  useFrame(() => {
    if (!meshRef.current || !showFlights || aircraft.length === 0) return;
    const camDist = camera.position.length();
    const isZoomedOut = camDist >= EARTH_RADIUS * 3.5;
    const active = isZoomedOut || showHeatmap;

    const count = aircraft.length;
    for (let i = 0; i < count; i++) {
      const ac = aircraft[i];
      if (active) {
        const pos = latLonToVec3(ac.latitude, ac.longitude, EARTH_RADIUS * 1.0015);
        dummy.position.set(pos[0], pos[1], pos[2]);
        dummy.scale.setScalar(1.2 + Math.sin(Date.now() * 0.002 + i) * 0.3);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
      } else {
        dummy.scale.setScalar(0.0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (!showFlights || aircraft.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[geom, undefined, aircraft.length]}>
      <meshBasicMaterial color="#00e5ff" transparent opacity={0.15} toneMapped={false} depthWrite={false} />
    </instancedMesh>
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
  const setViewTarget = useAppStore(s => s.setViewTarget);
  const setHoveredEntity = useAppStore(s => s.setHoveredEntity);
  const selectedId = useAppStore(s => s.selectedSatelliteId);
  const realisticColors = useAppStore(s => s.realisticColors);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const clickMeshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const { camera } = useThree();

  const satelliteGeom = useMemo(() => createSatelliteGeometry(), []);
  const clickGeom = useMemo(() => new THREE.SphereGeometry(1.5, 8, 8), []);

  useEffect(() => {
    return () => {
      satelliteGeom.dispose();
      clickGeom.dispose();
    };
  }, [satelliteGeom, clickGeom]);

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
    const camDist = camera.position.length();
    const zoomFactor = Math.max(1.0, Math.min(5.5, camDist / (EARTH_RADIUS * 1.5)));

    for (let i = 0; i < visibleSats.length; i++) {
      const sat = visibleSats[i];
      
      const posAtT = getSatellitePositionAtTime(sat, t);
      const lat = posAtT.lat;
      const lon = posAtT.lon;

      const altScale = EARTH_RADIUS + (sat.altitude / 6371) * EARTH_RADIUS * 0.6;
      const pos = latLonToVec3(lat, lon, Math.min(altScale, EARTH_RADIUS * 2.5));
      dummy.position.set(pos[0], pos[1], pos[2]);
      
      dummy.lookAt(0, 0, 0);
      
      const isISS = sat.category === 'iss';
      const baseScale = isISS ? 0.24 : sat.category === 'starlink' ? 0.08 : 0.15;
      dummy.scale.setScalar(baseScale * zoomFactor);
      dummy.updateMatrix();
      
      meshRef.current.setMatrixAt(i, dummy.matrix);
      if (clickMeshRef.current) clickMeshRef.current.setMatrixAt(i, dummy.matrix);

      // Color by category or Realistic styling
      const color = new THREE.Color();
      if (realisticColors) {
        if (sat.id === selectedId) {
          color.set('#ff6b35'); // highlight selected satellite (orange)
        } else if (sat.category === 'starlink') {
          color.set('#ffffff'); // white for Starlink
        } else {
          color.set('#ffd700'); // gold/metallic for other satellites
        }
      } else {
        if (sat.id === selectedId) {
          color.set('#00d4ff'); // highlighted active selection (cyan)
        } else {
          switch (sat.category) {
            case 'iss':
              color.set('#ff6b35'); // ISS = Orange
              break;
            case 'starlink':
              color.set('#ffffff'); // Starlink = White
              break;
            case 'gps':
            case 'galileo':
            case 'glonass':
            case 'beidou':
              color.set('#3b82f6'); // GPS/Navigation = Blue
              break;
            case 'weather':
            case 'earth-observation':
              color.set('#00ff88'); // Weather/Imaging = Green
              break;
            case 'communication':
              color.set('#8b5cf6'); // Comm = Purple
              break;
            case 'scientific':
              color.set('#ffd700'); // Science = Yellow
              break;
            default:
              color.set('#94a3b8');
              break;
          }
        }
      }
      meshRef.current.setColorAt(i, color);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    if (clickMeshRef.current) {
      clickMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  if (visibleSats.length === 0) return null;

  return (
    <group>
      {/* Visual Mesh */}
      <instancedMesh
        ref={meshRef}
        args={[satelliteGeom, undefined, visibleSats.length]}
      >
        <instancedBufferAttribute
          key={visibleSats.length}
          attach="instanceColor"
          args={[new Float32Array(visibleSats.length * 3).fill(1), 3]}
        />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* Click Interaction Mesh */}
      <instancedMesh
        ref={clickMeshRef}
        args={[clickGeom, undefined, visibleSats.length]}
        onClick={(e) => {
          e.stopPropagation();
          const idx = e.instanceId;
          if (idx !== undefined && visibleSats[idx]) {
            const sat = visibleSats[idx];
            selectSatellite(sat.id);
            const t = Date.now() / 1000;
            const posAtT = getSatellitePositionAtTime(sat, t);
            setViewTarget({ lat: posAtT.lat, lon: posAtT.lon, entityId: sat.id, entityType: 'satellite' });
          }
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          const idx = e.instanceId;
          if (idx !== undefined && visibleSats[idx]) {
            const sat = visibleSats[idx];
            document.body.style.cursor = 'pointer';
            setHoveredEntity(sat.id, 'satellite');
          }
        }}
        onPointerOut={(e) => {
          document.body.style.cursor = 'default';
          setHoveredEntity(null, null);
        }}
      >
        <meshBasicMaterial toneMapped={false} transparent opacity={0} depthWrite={false} />
      </instancedMesh>
    </group>
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
function getRouteMidpoint(lat1: number, lon1: number, lat2: number, lon2: number) {
  let dLon = lon2 - lon1;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  const lat = (lat1 + lat2) / 2;
  const lon = ((lon1 + dLon / 2 + 180) % 360) - 180;
  return { lat, lon };
}

function CameraController() {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();
  const viewTarget = useAppStore(s => s.viewTarget);
  const satellites = useSatelliteStore(s => s.satellites);
  const aircraft = useFlightStore(s => s.aircraft);

  const satellitesRef = useRef(satellites);
  const aircraftRef = useRef(aircraft);
  satellitesRef.current = satellites;
  aircraftRef.current = aircraft;

  const lastTargetIdRef = useRef<string | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!viewTarget) {
      lastTargetIdRef.current = null;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    if (controlsRef.current) {
      const targetId = `${viewTarget.entityType}-${viewTarget.entityId}-${viewTarget.lat}-${viewTarget.lon}`;
      if (lastTargetIdRef.current === targetId) {
        return; // Skip animation if target hasn't changed
      }
      lastTargetIdRef.current = targetId;

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      let targetLat = viewTarget.lat;
      let targetLon = viewTarget.lon;
      let camRadius = EARTH_RADIUS * 2.5;

      const currentSats = satellitesRef.current;
      const currentAircraft = aircraftRef.current;

      if (viewTarget.entityType === 'satellite') {
        const sat = currentSats.find(s => s.id === viewTarget.entityId);
        if (sat) {
          const altScale = EARTH_RADIUS + (sat.altitude / 6371) * EARTH_RADIUS * 0.6;
          const satRadius = Math.min(altScale, EARTH_RADIUS * 2.5);
          camRadius = satRadius * 1.5;
        } else {
          camRadius = EARTH_RADIUS * 2.6;
        }
      } else if (viewTarget.entityType === 'aircraft') {
        const ac = currentAircraft.find(a => a.id === viewTarget.entityId);
        if (ac) {
          const originCode = ac.origin.substring(0, 3);
          const destCode = ac.destination.substring(0, 3);
          const originAirport = AIRPORTS[originCode];
          const destAirport = AIRPORTS[destCode];
          if (originAirport && destAirport) {
            const midpoint = getRouteMidpoint(originAirport.lat, originAirport.lon, destAirport.lat, destAirport.lon);
            targetLat = midpoint.lat;
            targetLon = midpoint.lon;
            
            const p1 = latLonToVec3(originAirport.lat, originAirport.lon, EARTH_RADIUS);
            const p2 = latLonToVec3(destAirport.lat, destAirport.lon, EARTH_RADIUS);
            const dist = new THREE.Vector3(...p1).distanceTo(new THREE.Vector3(...p2));
            const routeAngle = dist / EARTH_RADIUS;
            // Frame the path cleanly: short paths zoom closer, long paths zoom further out
            camRadius = EARTH_RADIUS * Math.max(2.6, Math.min(4.2, 1.8 + routeAngle * 1.5));
          } else {
            camRadius = EARTH_RADIUS * 2.8;
          }
        } else {
          camRadius = EARTH_RADIUS * 2.8;
        }
      }

      const pos = latLonToVec3(targetLat, targetLon, camRadius);
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
        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          animFrameRef.current = null;
        }
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
        <AuroraRings />
        <WeatherLayerMesh />
        <LightningBolt />
        
        <FlightHeatmapLayer />
        <AircraftLayer />
        <FlightRoutes />
        <SelectedFlightMarkers />
        <AirportMarkers />
        
        <SatelliteLayer />
        <SatelliteOrbitTrail3D />
        <CoverageCone />
        <SignalBeam />
        
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
  const activePanel = useAppStore(s => s.activePanel);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(window.innerWidth > 768);
    const handleResize = () => setIsDesktop(window.innerWidth > 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isPanelOpen = activePanel !== 'none';
  const shiftX = isDesktop && isPanelOpen ? '-210px' : '0px';

  return (
    <div style={{
      width: '100%', height: '100%', position: 'absolute', inset: 0,
      transform: `translateX(${shiftX})`,
      transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    }}>
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
