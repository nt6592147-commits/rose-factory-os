import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { OrbQuality, OrbState } from '../../types/rose.ts';

interface RoseOrbProps {
  orbState: OrbState;
  audioLevel: number;
  orbQuality: OrbQuality;
  animationIntensity: number;
}

const CORE_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uAudio;
  uniform float uStateSpeed;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec3 vLocalPos;
  varying float vDisplacement;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  void main() {
    vLocalPos = position;
    float t = uTime * uStateSpeed;
    float n1 = noise(position * 2.1 + vec3(t * 0.6, -t * 0.4, t * 0.35));
    float n2 = noise(position * 4.2 - vec3(t * 0.8, t * 0.5, -t * 0.45));
    float wave = (n1 * 0.65 + n2 * 0.35) - 0.5;
    float amp = (0.045 + uAudio * 0.22) * uIntensity;
    float disp = wave * amp;
    vDisplacement = disp;

    vec3 displaced = position + normal * disp;
    vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);
    vViewPos = -mvPos.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const CORE_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uAudio;
  uniform vec3 uColorPrimary;
  uniform vec3 uColorSecondary;
  uniform vec3 uColorAccent;
  uniform float uDim;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec3 vLocalPos;
  varying float vDisplacement;

  void main() {
    vec3 viewDir = normalize(vViewPos);
    vec3 norm = normalize(vNormal);
    float fresnel = pow(1.0 - max(0.0, dot(viewDir, norm)), 2.4);

    float band = sin(vLocalPos.y * 5.0 - uTime * 1.4 + vLocalPos.x * 3.0) * 0.5 + 0.5;
    float circuit = smoothstep(0.92, 0.99, sin(vLocalPos.x * 16.0 + uTime * 0.8) * cos(vLocalPos.z * 16.0 - uTime * 0.6));

    vec3 inner = mix(uColorSecondary, uColorPrimary, band);
    vec3 rim = mix(inner, uColorAccent, clamp(fresnel * 1.15 + uAudio * 0.35, 0.0, 1.0));
    rim += uColorAccent * circuit * (0.35 + uAudio * 0.6);
    rim += uColorPrimary * max(0.0, vDisplacement * 4.5);

    float alpha = clamp(0.42 + fresnel * 0.55 + uAudio * 0.15, 0.18, 0.95) * uDim;
    gl_FragColor = vec4(rim * uDim, alpha);
  }
`;

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const rendererStr = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);
  } catch {
    return true;
  }
}

interface StatePalette {
  primary: THREE.Color;
  secondary: THREE.Color;
  accent: THREE.Color;
  ringSpeed: number;
  particlePull: number;
  dim: number;
}

const PALETTES: Record<OrbState, StatePalette> = {
  IDLE: {
    primary: new THREE.Color('#22d3ee'),
    secondary: new THREE.Color('#3b82f6'),
    accent: new THREE.Color('#e89cb4'),
    ringSpeed: 0.28,
    particlePull: 0,
    dim: 0.92,
  },
  LISTENING: {
    primary: new THREE.Color('#38bdf8'),
    secondary: new THREE.Color('#6366f1'),
    accent: new THREE.Color('#f472b6'),
    ringSpeed: 0.55,
    particlePull: 0.25,
    dim: 1.08,
  },
  THINKING: {
    primary: new THREE.Color('#8b5cf6'),
    secondary: new THREE.Color('#22d3ee'),
    accent: new THREE.Color('#f0abfc'),
    ringSpeed: 1.45,
    particlePull: -0.55,
    dim: 1.18,
  },
  SPEAKING: {
    primary: new THREE.Color('#22d3ee'),
    secondary: new THREE.Color('#8b5cf6'),
    accent: new THREE.Color('#f4a6be'),
    ringSpeed: 0.85,
    particlePull: 0.45,
    dim: 1.22,
  },
  DISCONNECTED: {
    primary: new THREE.Color('#475569'),
    secondary: new THREE.Color('#1e293b'),
    accent: new THREE.Color('#64748b'),
    ringSpeed: 0.08,
    particlePull: 0,
    dim: 0.42,
  },
  ERROR: {
    primary: new THREE.Color('#f59e0b'),
    secondary: new THREE.Color('#991b1b'),
    accent: new THREE.Color('#fb7185'),
    ringSpeed: 0.4,
    particlePull: 0.1,
    dim: 0.95,
  },
};

export function RoseOrb({
  orbState,
  audioLevel,
  orbQuality,
  animationIntensity,
}: RoseOrbProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [fallbackActive, setFallbackActive] = useState(false);

  const liveStateRef = useRef({
    orbState,
    audioLevel,
    animationIntensity,
  });

  useEffect(() => {
    liveStateRef.current = { orbState, audioLevel, animationIntensity };
  }, [orbState, audioLevel, animationIntensity]);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const use2DFallback =
    orbQuality === 'lightweight' || prefersReducedMotion || fallbackActive;

  useEffect(() => {
    if (use2DFallback) return;
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setFallbackActive(true);
      return;
    }

    const width = Math.max(240, container.clientWidth);
    const height = Math.max(240, container.clientHeight);

    renderer.setSize(width, height);
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = false;

    const canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(canvas);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setFallbackActive(true);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x04060d, 0.042);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    const aspect = width / height;
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
    camera.position.set(0, 0.22, aspect < 1 ? 6.2 / Math.max(0.75, aspect) : 6.2);
    camera.lookAt(0, 0, 0);

    // Three-point warm/cool studio + holographic core lighting
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0b0f1e, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffe4e6, 1.35);
    keyLight.position.set(4, 5, 5);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x8b5cf6, 2.8, 16);
    rimLight.position.set(-3.5, 2.2, -3);
    scene.add(rimLight);

    const cyanFill = new THREE.PointLight(0x22d3ee, 2.4, 15);
    cyanFill.position.set(3.2, -1.8, 2.5);
    scene.add(cyanFill);

    // Root composite group
    const orbGroup = new THREE.Group();
    scene.add(orbGroup);

    const disposables: Array<{ dispose: () => void }> = [envTexture];

    // 1. Inner Volumetric Plasma Core
    const coreSegs = orbQuality === 'high' ? 48 : 32;
    const coreGeo = new THREE.SphereGeometry(1.04, coreSegs, coreSegs);
    const coreUniforms = {
      uTime: { value: 0 },
      uAudio: { value: 0 },
      uStateSpeed: { value: 1.0 },
      uIntensity: { value: 1.0 },
      uColorPrimary: { value: PALETTES.IDLE.primary.clone() },
      uColorSecondary: { value: PALETTES.IDLE.secondary.clone() },
      uColorAccent: { value: PALETTES.IDLE.accent.clone() },
      uDim: { value: 1.0 },
    };
    const coreMat = new THREE.ShaderMaterial({
      uniforms: coreUniforms,
      vertexShader: CORE_VERTEX_SHADER,
      fragmentShader: CORE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.renderOrder = 2;
    orbGroup.add(coreMesh);
    disposables.push(coreGeo, coreMat);

    // 2. Internal Precision Neural Lattice
    const latticeGeo = new THREE.IcosahedronGeometry(1.19, 2);
    const latticeEdges = new THREE.EdgesGeometry(latticeGeo, 12);
    latticeGeo.dispose();
    const latticeMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const latticeMesh = new THREE.LineSegments(latticeEdges, latticeMat);
    latticeMesh.renderOrder = 3;
    orbGroup.add(latticeMesh);
    disposables.push(latticeEdges, latticeMat);

    // 3. Internal Circuitry Aperture Disc (Ref Image 3 inspired)
    const apertureGroup = new THREE.Group();
    const apertureRingGeo = new THREE.RingGeometry(0.68, 0.72, 48);
    const apertureRingMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      emissive: 0x22d3ee,
      emissiveIntensity: 0.65,
      metalness: 0.9,
      roughness: 0.2,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.72,
    });
    const apertureRing = new THREE.Mesh(apertureRingGeo, apertureRingMat);
    apertureGroup.add(apertureRing);

    const spokeGeo = new THREE.BoxGeometry(0.014, 0.46, 0.012);
    const spokeMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x8b5cf6,
      emissiveIntensity: 0.9,
      metalness: 0.85,
      roughness: 0.2,
      transparent: true,
      opacity: 0.62,
    });
    for (let i = 0; i < 6; i++) {
      const spoke = new THREE.Mesh(spokeGeo, spokeMat);
      const angle = (i / 6) * Math.PI * 2;
      spoke.position.set(Math.cos(angle) * 0.92, Math.sin(angle) * 0.92, 0);
      spoke.rotation.z = angle + Math.PI / 2;
      apertureGroup.add(spoke);
    }
    orbGroup.add(apertureGroup);
    disposables.push(apertureRingGeo, apertureRingMat, spokeGeo, spokeMat);

    // 4. Outer Translucent Glass Containment Shell (Ref Images 1 & 3)
    const shellGeo = new THREE.SphereGeometry(1.48, coreSegs, coreSegs);
    const shellMat = new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      metalness: 0.05,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      iridescence: 0.95,
      iridescenceIOR: 1.35,
      ior: 1.52,
      transmission: isSoftwareGl ? 0 : 0.78,
      transparent: true,
      opacity: isSoftwareGl ? 0.26 : 0.92,
      depthWrite: false,
      envMapIntensity: 1.35,
    });
    const shellMesh = new THREE.Mesh(shellGeo, shellMat);
    shellMesh.renderOrder = 5;
    orbGroup.add(shellMesh);
    disposables.push(shellGeo, shellMat);

    // 5. Four Multi-Axis Tilted Geometric Orbital Rings (Ref Images 1 & 2)
    const ringConfigs = [
      { radius: 1.72, tube: 0.016, color: 0x22d3ee, tiltX: 0.52, tiltZ: 0.3, speed: 0.55 },
      { radius: 1.94, tube: 0.014, color: 0xa855f7, tiltX: -0.68, tiltZ: 0.75, speed: -0.42 },
      { radius: 2.16, tube: 0.012, color: 0xf472b6, tiltX: 1.12, tiltZ: -0.45, speed: 0.33 },
      { radius: 2.38, tube: 0.009, color: 0x38bdf8, tiltX: -0.25, tiltZ: -0.95, speed: -0.24 },
    ];
    const orbitalRings: Array<{
      mesh: THREE.Mesh;
      baseScale: number;
      speed: number;
      mat: THREE.MeshStandardMaterial;
    }> = [];

    for (const cfg of ringConfigs) {
      const rGeo = new THREE.TorusGeometry(cfg.radius, cfg.tube, 12, 96);
      const rMat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        emissive: cfg.color,
        emissiveIntensity: 1.05,
        metalness: 0.75,
        roughness: 0.22,
        transparent: true,
        opacity: 0.85,
      });
      const rMesh = new THREE.Mesh(rGeo, rMat);
      rMesh.rotation.set(cfg.tiltX, 0, cfg.tiltZ);
      orbGroup.add(rMesh);
      orbitalRings.push({ mesh: rMesh, baseScale: 1, speed: cfg.speed, mat: rMat });
      disposables.push(rGeo, rMat);
    }

    // 6. Glowing Energy Particles (180 particles inside & orbiting)
    const particleCount = orbQuality === 'high' ? 180 : 110;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const particleMeta: Array<{
      radius: number;
      theta: number;
      phi: number;
      speed: number;
    }> = [];

    const cCyan = new THREE.Color('#22d3ee');
    const cViolet = new THREE.Color('#c084fc');
    const cRose = new THREE.Color('#f9a8d4');

    for (let i = 0; i < particleCount; i++) {
      const isInner = i < particleCount * 0.45;
      const radius = isInner ? 0.32 + Math.random() * 0.65 : 1.56 + Math.random() * 0.95;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = (0.25 + Math.random() * 0.6) * (i % 2 === 0 ? 1 : -1);
      particleMeta.push({ radius, theta, phi, speed });

      particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = radius * Math.cos(phi);
      particlePositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      const paletteChoice = i % 3 === 0 ? cRose : i % 3 === 1 ? cCyan : cViolet;
      particleColors[i * 3] = paletteChoice.r;
      particleColors[i * 3 + 1] = paletteChoice.g;
      particleColors[i * 3 + 2] = paletteChoice.b;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.055,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    particleSystem.frustumCulled = false;
    orbGroup.add(particleSystem);
    disposables.push(particleGeo, particleMat);

    // 7. Grounded Holographic Projection Pedestal (Ref Image 2)
    const baseGroup = new THREE.Group();
    baseGroup.position.set(0, -2.35, 0);
    const baseRingSpecs = [
      { inner: 1.05, outer: 1.12, color: 0x22d3ee, opacity: 0.45, y: 0 },
      { inner: 1.48, outer: 1.52, color: 0x8b5cf6, opacity: 0.35, y: 0.02 },
      { inner: 1.95, outer: 1.98, color: 0xe89cb4, opacity: 0.22, y: 0.04 },
    ];
    for (const spec of baseRingSpecs) {
      const bGeo = new THREE.RingGeometry(spec.inner, spec.outer, 72);
      const bMat = new THREE.MeshBasicMaterial({
        color: spec.color,
        transparent: true,
        opacity: spec.opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const bMesh = new THREE.Mesh(bGeo, bMat);
      bMesh.rotation.x = -Math.PI / 2;
      bMesh.position.y = spec.y;
      baseGroup.add(bMesh);
      disposables.push(bGeo, bMat);
    }
    scene.add(baseGroup);

    // Pre-allocated animation state (zero GC in loop)
    let smoothedAudio = 0;
    let smoothedSpeed = PALETTES.IDLE.ringSpeed;
    let smoothedDim = PALETTES.IDLE.dim;
    let smoothedPull = 0;
    const currentPrimary = PALETTES.IDLE.primary.clone();
    const currentSecondary = PALETTES.IDLE.secondary.clone();
    const currentAccent = PALETTES.IDLE.accent.clone();

    const startTimeMs = performance.now();
    let prevTimeMs = startTimeMs;
    let frameId = 0;
    let disposed = false;

    const handleResize = () => {
      if (disposed || !container) return;
      const w = Math.max(240, container.clientWidth);
      const h = Math.max(240, container.clientHeight);
      const nextAspect = w / h;
      camera.aspect = nextAspect;
      camera.position.z = nextAspect < 1 ? 6.2 / Math.max(0.75, nextAspect) : 6.2;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (status === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function tick() {
      if (disposed) return;
      const nowMs = performance.now();
      const dt = Math.min(0.1, (nowMs - prevTimeMs) / 1000);
      const elapsed = (nowMs - startTimeMs) / 1000;
      prevTimeMs = nowMs;
      const { orbState: state, audioLevel: rawAudio, animationIntensity: intensity } =
        liveStateRef.current;

      const palette = PALETTES[state];
      const damp = 1 - Math.exp(-5.5 * dt);
      const colorDamp = 1 - Math.exp(-3.8 * dt);

      smoothedAudio = THREE.MathUtils.lerp(smoothedAudio, rawAudio, 1 - Math.exp(-14 * dt));
      smoothedSpeed = THREE.MathUtils.lerp(smoothedSpeed, palette.ringSpeed * intensity, damp);
      smoothedDim = THREE.MathUtils.lerp(smoothedDim, palette.dim, damp);
      smoothedPull = THREE.MathUtils.lerp(smoothedPull, palette.particlePull, damp);

      currentPrimary.lerp(palette.primary, colorDamp);
      currentSecondary.lerp(palette.secondary, colorDamp);
      currentAccent.lerp(palette.accent, colorDamp);

      // Update plasma core uniforms
      coreUniforms.uTime.value = elapsed;
      coreUniforms.uAudio.value = smoothedAudio;
      coreUniforms.uStateSpeed.value = 0.7 + smoothedSpeed * 1.4;
      coreUniforms.uIntensity.value = intensity;
      coreUniforms.uColorPrimary.value.copy(currentPrimary);
      coreUniforms.uColorSecondary.value.copy(currentSecondary);
      coreUniforms.uColorAccent.value.copy(currentAccent);
      coreUniforms.uDim.value = smoothedDim;

      // Subtle floating levitation
      orbGroup.position.y = Math.sin(elapsed * 1.25) * 0.08 * intensity;
      const scalePulse = 1 + smoothedAudio * 0.085 * intensity;
      coreMesh.scale.setScalar(scalePulse);

      latticeMesh.rotation.y += dt * (0.22 + smoothedSpeed * 0.35);
      latticeMesh.rotation.x += dt * 0.09;
      latticeMat.color.copy(currentPrimary);
      latticeMat.opacity = (0.18 + smoothedAudio * 0.32) * smoothedDim;

      apertureGroup.rotation.z -= dt * (0.35 + smoothedSpeed * 0.6);
      apertureGroup.rotation.y = Math.sin(elapsed * 0.6) * 0.25;
      apertureRingMat.emissive.copy(currentPrimary);
      spokeMat.emissive.copy(currentAccent);

      for (let i = 0; i < orbitalRings.length; i++) {
        const ring = orbitalRings[i];
        ring.mesh.rotation.y += dt * ring.speed * (0.6 + smoothedSpeed * 1.15);
        ring.mesh.rotation.x += dt * ring.speed * 0.25 * intensity;
        const rScale = 1 + smoothedAudio * (0.06 + i * 0.025) * intensity;
        ring.mesh.scale.setScalar(rScale);
        ring.mat.emissiveIntensity = (0.75 + smoothedAudio * 1.4) * smoothedDim;
      }

      // Animate particles
      const posAttr = particleGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < particleCount; i++) {
        const meta = particleMeta[i];
        meta.theta += dt * meta.speed * (0.45 + smoothedSpeed * 0.9);
        const radialOffset =
          smoothedPull * 0.32 + Math.sin(elapsed * 2.0 + i) * 0.04 * (1 + smoothedAudio * 3.0);
        const r = Math.max(0.2, meta.radius + radialOffset);
        posAttr.setXYZ(
          i,
          r * Math.sin(meta.phi) * Math.cos(meta.theta),
          r * Math.cos(meta.phi),
          r * Math.sin(meta.phi) * Math.sin(meta.theta)
        );
      }
      posAttr.needsUpdate = true;
      particleMat.opacity = Math.min(1, (0.55 + smoothedAudio * 0.45) * smoothedDim);

      cyanFill.color.copy(currentPrimary);
      cyanFill.intensity = (1.8 + smoothedAudio * 2.6) * smoothedDim;
      rimLight.color.copy(currentSecondary);
      rimLight.intensity = (2.1 + smoothedAudio * 2.0) * smoothedDim;

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      for (const item of disposables) {
        item.dispose();
      }
      renderer.dispose();
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [orbQuality, use2DFallback]);

  if (use2DFallback) {
    return (
      <RoseOrbFallback
        orbState={orbState}
        audioLevel={audioLevel}
        animationIntensity={animationIntensity}
      />
    );
  }

  return (
    <div
      ref={mountRef}
      data-testid="rose-orb-3d"
      data-orb-state={orbState}
      className="relative w-full h-full select-none pointer-events-none"
      aria-label={`ROSE holographic core in ${orbState.toLowerCase()} state`}
    />
  );
}

function RoseOrbFallback({
  orbState,
  audioLevel,
  animationIntensity,
}: {
  orbState: OrbState;
  audioLevel: number;
  animationIntensity: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ orbState, audioLevel, animationIntensity });

  useEffect(() => {
    stateRef.current = { orbState, audioLevel, animationIntensity };
  }, [orbState, audioLevel, animationIntensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let time = 0;

    const draw = () => {
      const parent = canvas.parentElement;
      const w = parent ? parent.clientWidth : 400;
      const h = parent ? parent.clientHeight : 400;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const { orbState: state, audioLevel: audio, animationIntensity: intensity } =
        stateRef.current;
      time += 0.018 * intensity;

      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const baseR = Math.min(w, h) * 0.28;
      const r = baseR * (1 + audio * 0.14);

      const primary =
        state === 'ERROR'
          ? 'rgba(245, 158, 11, 0.85)'
          : state === 'DISCONNECTED'
            ? 'rgba(100, 116, 139, 0.45)'
            : state === 'THINKING'
              ? 'rgba(139, 92, 246, 0.9)'
              : 'rgba(34, 211, 238, 0.9)';

      const grad = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r * 1.45);
      grad.addColorStop(0, 'rgba(244, 166, 190, 0.45)');
      grad.addColorStop(0.55, primary);
      grad.addColorStop(1, 'rgba(4, 6, 13, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.45, 0, Math.PI * 2);
      ctx.fill();

      // Rotating geometric rings
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(time * (i % 2 === 0 ? 0.8 : -0.6) + i * 0.9);
        ctx.scale(1, 0.42 + i * 0.12);
        ctx.strokeStyle = i === 1 ? 'rgba(244, 114, 182, 0.65)' : 'rgba(56, 189, 248, 0.72)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, r * (1.18 + i * 0.16), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      rafId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="rose-orb-fallback"
      data-orb-state={orbState}
      className="w-full h-full block pointer-events-none"
      aria-label={`ROSE lightweight orb in ${orbState.toLowerCase()} state`}
    />
  );
}
