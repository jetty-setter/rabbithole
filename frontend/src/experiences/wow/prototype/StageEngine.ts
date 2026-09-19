import * as THREE from "three";

import { valueAtTime, type TimedPoint } from "../interpolate";

export interface StageRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface StageSample {
  label: string;
  t: number;
  value: number;
}

/** Shot boundaries, in seconds, on the master timeline. Exported so the
 *  React layer and the engine agree on exactly one authored structure. */
export const SHOTS = {
  archival: 0,
  find: 4,
  extract: 8,
  signal: 11,
  peak: 17,
  collapse: 20,
  end: 24,
} as const;

export const TOTAL_DURATION = SHOTS.end;

const PARTICLE_COUNT = 4200;
const FIELD_WIDTH = 9.6;
const FIELD_HEIGHT_SCALE = 2.6;
const REVEAL_SOFT = 3.5;

const VERTEX_SHADER = `
  attribute float aOriginalT;
  attribute float aBaseY;
  attribute float aTurb;
  attribute float aSpreadY;
  attribute float aSpreadZ;
  uniform float uRevealT;
  uniform float uTime;
  uniform float uEnvelope;
  uniform float uSizeScale;
  varying float vIntensity;
  varying float vAlpha;

  void main() {
    float appear = 1.0 - smoothstep(uRevealT, uRevealT + ${REVEAL_SOFT.toFixed(1)}, aOriginalT);
    float turbulence = sin(uTime * 1.6 + aTurb * 12.0) * (0.06 + aBaseY * 0.16);
    // Volumetric spread: at low intensity particles cling close to the
    // curve (a thin trace); at high intensity (the U peak) they billow
    // into a fuller cloud -- this is what reads as a "field" rather than
    // a single point tracing a line.
    float volume = 0.18 + aBaseY * 0.95;
    vec3 pos = position;
    pos.y = aBaseY * ${FIELD_HEIGHT_SCALE.toFixed(2)} + turbulence + aSpreadY * volume;
    pos.z += sin(aTurb * 6.283 + uTime * 0.7) * 0.35 + aSpreadZ * volume;

    vIntensity = aBaseY;
    vAlpha = appear * uEnvelope;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (1.1 + aBaseY * 3.2) * uSizeScale * (34.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  varying float vIntensity;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;
    float falloff = smoothstep(0.5, 0.0, d);

    vec3 violet = vec3(0.42, 0.35, 0.75);
    vec3 lavender = vec3(0.77, 0.71, 0.99);
    vec3 nearWhite = vec3(0.97, 0.95, 1.0);
    vec3 coral = vec3(0.88, 0.54, 0.44);

    vec3 color = mix(violet, lavender, smoothstep(0.0, 0.6, vIntensity));
    color = mix(color, nearWhite, smoothstep(0.75, 1.0, vIntensity));
    float coralAmount = smoothstep(0.92, 1.0, vIntensity) * 0.5;
    color = mix(color, coral, coralAmount);

    gl_FragColor = vec4(color, falloff * vAlpha);
  }
`;

/** Plain (non-React) Three.js engine for the Wow! Signal motion
 *  prototype. Owns its own persistent render loop (independent of
 *  React's render cycle -- the loop reads `getT()` every frame rather
 *  than being driven by React state) and every renderer/scene resource,
 *  so it can be created once on mount and fully disposed on unmount. All
 *  authored motion is a pure function of the current time; scrubbing
 *  backwards is exactly as valid as playing forward. */
export class StageEngine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock: THREE.Clock;
  private rafId: number | null = null;

  private imagePlane: THREE.Mesh;
  private imageMaterial: THREE.ShaderMaterial;
  private darkenUniform: { value: number };
  private focusUniform: { value: THREE.Vector2 };
  private planeAspect = 720 / 290;

  private particles: THREE.Points;
  private particleMaterial: THREE.ShaderMaterial;
  private points: TimedPoint[];
  private maxValue: number;

  private region: StageRegion;
  private getT: () => number;
  private reduced = false;
  private pointer = new THREE.Vector2(0, 0);
  private pointerTarget = new THREE.Vector2(0, 0);
  private scrubbing = false;
  private disposed = false;

  private onAnchorChange: (anchor: { xPct: number; yPct: number; opacity: number; scale: number }) => void;

  constructor(opts: {
    canvas: HTMLCanvasElement;
    texture: THREE.Texture;
    region: StageRegion;
    samples: StageSample[];
    width: number;
    height: number;
    onAnchorChange: (anchor: { xPct: number; yPct: number; opacity: number; scale: number }) => void;
    getT: () => number;
  }) {
    this.region = opts.region;
    this.getT = opts.getT;
    this.onAnchorChange = opts.onAnchorChange;
    this.points = opts.samples.map((s) => ({ t: s.t, value: s.value }));
    this.maxValue = Math.max(...this.points.map((p) => p.value), 1);

    this.renderer = new THREE.WebGLRenderer({ canvas: opts.canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(opts.width, opts.height, false);
    this.renderer.setClearColor(0x050308, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, opts.width / opts.height, 0.1, 100);
    this.camera.position.set(0, 0, 9);
    this.clock = new THREE.Clock();

    const tex = opts.texture;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.planeAspect = tex.image ? tex.image.width / tex.image.height : this.planeAspect;

    this.darkenUniform = { value: 0 };
    this.focusUniform = { value: new THREE.Vector2(0.5, 0.5) };
    this.imageMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: tex },
        uOpacity: { value: 0 },
        uDarken: this.darkenUniform,
        uFocus: this.focusUniform,
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;
        uniform sampler2D uTexture;
        uniform float uOpacity;
        uniform float uDarken;
        uniform vec2 uFocus;
        varying vec2 vUv;
        void main() {
          vec4 tex = texture2D(uTexture, vUv);
          float d = distance(vUv, uFocus);
          float vignette = smoothstep(0.06, 0.5, d);
          vec3 color = tex.rgb * (1.0 - vignette * uDarken);
          gl_FragColor = vec4(color, uOpacity);
        }
      `,
      transparent: true,
    });
    const planeGeo = new THREE.PlaneGeometry(6 * this.planeAspect, 6);
    this.imagePlane = new THREE.Mesh(planeGeo, this.imageMaterial);
    this.scene.add(this.imagePlane);

    // Particle field -- positions/colors/turbulence computed once; the
    // shader reveals/animates them from uniforms only, so no per-frame
    // buffer writes or allocations are needed in the render loop.
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const originalT = new Float32Array(PARTICLE_COUNT);
    const baseY = new Float32Array(PARTICLE_COUNT);
    const turb = new Float32Array(PARTICLE_COUNT);
    const spreadY = new Float32Array(PARTICLE_COUNT);
    const spreadZ = new Float32Array(PARTICLE_COUNT);
    const total = this.points[this.points.length - 1]?.t ?? 72;
    // Triangular (sum-of-two-uniforms) distributions so the cloud is denser
    // toward its own centerline and thins at the edges, like a real
    // volumetric field rather than a uniform disc of particles.
    const tri = () => (Math.random() + Math.random() - 1);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const frac = i / (PARTICLE_COUNT - 1);
      const jitterFrac = Math.min(1, Math.max(0, frac + (Math.random() - 0.5) * 0.012));
      const ot = jitterFrac * total;
      const x = (jitterFrac - 0.5) * FIELD_WIDTH;
      const z = (Math.random() - 0.5) * 1.6;
      positions[i * 3] = x;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = z;
      originalT[i] = ot;
      baseY[i] = valueAtTime(this.points, ot) / this.maxValue;
      turb[i] = Math.random();
      spreadY[i] = tri() * 1.15;
      spreadZ[i] = tri() * 1.3;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aOriginalT", new THREE.BufferAttribute(originalT, 1));
    geo.setAttribute("aBaseY", new THREE.BufferAttribute(baseY, 1));
    geo.setAttribute("aTurb", new THREE.BufferAttribute(turb, 1));
    geo.setAttribute("aSpreadY", new THREE.BufferAttribute(spreadY, 1));
    geo.setAttribute("aSpreadZ", new THREE.BufferAttribute(spreadZ, 1));

    this.particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uRevealT: { value: -10 },
        uTime: { value: 0 },
        uEnvelope: { value: 0 },
        uSizeScale: { value: 1 },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.particles = new THREE.Points(geo, this.particleMaterial);
    this.particles.position.y = -0.4;
    this.scene.add(this.particles);
  }

  setSize(width: number, height: number) {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  setReducedMotion(reduced: boolean) {
    this.reduced = reduced;
  }

  setScrubbing(scrubbing: boolean) {
    this.scrubbing = scrubbing;
  }

  setPointer(nx: number, ny: number) {
    if (this.scrubbing) return;
    this.pointerTarget.set(nx, ny);
  }

  start() {
    if (this.rafId !== null || this.disposed) return;
    const loop = () => {
      if (this.disposed) return;
      this.renderFrame();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private renderFrame() {
    const t = this.getT();
    const dt = this.clock.getDelta();

    if (!this.reduced) {
      this.pointer.lerp(this.pointerTarget, 1 - Math.pow(0.001, dt));
    } else {
      this.pointer.set(0, 0);
    }

    this.applyShot(t);

    this.camera.position.x += (this.pointer.x * 0.25 - (this.camera.position.x - this.cameraBaseX)) * 0.06;
    this.camera.position.y += (this.pointer.y * 0.15 - (this.camera.position.y - this.cameraBaseY)) * 0.06;
    this.camera.lookAt(this.lookTarget);

    this.particleMaterial.uniforms.uTime.value += this.reduced ? 0 : dt;

    this.renderer.render(this.scene, this.camera);
    this.reportAnchor(t);
  }

  private cameraBaseX = 0;
  private cameraBaseY = 0;
  private lookTarget = new THREE.Vector3(0, 0, 0);

  /** Pure function of `t` -- every uniform/position here is fully
   *  determined by the current time, so scrubbing to any `t` (forward or
   *  backward) always lands in the correct visual state. */
  private applyShot(t: number) {
    const { archival, find, extract, signal, peak, collapse, end } = SHOTS;

    // Shot 1-2: image visible, camera pushes toward the focus region.
    const imgFadeIn = smooth01((t - archival) / 0.6);
    const findP = smooth01((t - find) / (extract - find));
    const focusX = this.region.left / 100 + this.region.width / 200;
    const focusY = 1 - (this.region.top / 100 + this.region.height / 200);
    this.focusUniform.value.set(focusX, focusY);
    // A baseline vignette holds from the very first frame -- the paper
    // should read as archival material glimpsed in a near-black room, not
    // a flat, fully-lit document -- and deepens further once "find" begins.
    const baseDarken = 0.4 * smooth01((t - archival) / 1.2);
    this.darkenUniform.value = baseDarken + smooth01((t - find) / 2.2) * 0.42;

    const regionWorldX = (focusX - 0.5) * 6 * this.planeAspect;
    const regionWorldY = (focusY - 0.5) * 6;
    this.cameraBaseX = lerp(0, regionWorldX * 0.5, findP);
    this.cameraBaseY = lerp(0, regionWorldY * 0.5, findP);
    this.lookTarget.set(this.cameraBaseX, this.cameraBaseY, 0);
    this.camera.position.z = lerp(9, 6.4, findP);

    // Shot 3: the paper recedes.
    const extractP = smooth01((t - extract) / (signal - extract));
    this.imageMaterial.uniforms.uOpacity.value = imgFadeIn * (1 - extractP);
    this.imagePlane.position.z = -extractP * 2.2;
    this.imagePlane.scale.setScalar(1 + extractP * 0.15);

    // Shots 4-6: the field. Map the whole [signal, end] window linearly
    // onto the real 0-72s observation, so the curve's own shape (not
    // special-cased per shot) produces the build, the peak at U, and the
    // decline through J/5.
    const total = this.points[this.points.length - 1]?.t ?? 72;
    const fieldP = clamp01((t - signal) / (end - signal));
    const revealT = fieldP * total;
    this.particleMaterial.uniforms.uRevealT.value = revealT;

    const fieldEnvelopeIn = smooth01((t - extract) / (signal - extract + 1.5));
    const holdStart = end - 1.3;
    const fieldEnvelopeOut = t > holdStart ? 1 - smooth01((t - holdStart) / (end - holdStart)) : 1;
    this.particleMaterial.uniforms.uEnvelope.value = fieldEnvelopeIn * fieldEnvelopeOut;

    const currentValue = t >= signal ? valueAtTime(this.points, revealT) / this.maxValue : 0;
    const peakBoost = 1 + smooth01(currentValue) * 0.35 * smooth01((t - peak) / (collapse - peak + 0.001));
    this.particleMaterial.uniforms.uSizeScale.value = peakBoost;

    void collapse; // shot boundary used only for the peak-boost taper above
  }

  private lastAnchor = { xPct: -1, yPct: -1, opacity: -1, scale: -1 };
  private reportAnchor(t: number) {
    const { find, extract } = SHOTS;
    const p = clamp01((t - find) / (extract - find + 2));
    const focusX = this.region.left + this.region.width / 2;
    const focusY = this.region.top + this.region.height / 2;
    const opacity = smooth01((t - find - 1.2) / 2.4) * (1 - smooth01((t - extract - 1.2) / 2));
    // The glyphs stay paper-locked at the region's own position throughout
    // this phase -- "separating" is read from scale growing and the paper
    // itself darkening/receding around them, not from the glyphs moving.
    const scale = lerp(0.55, 1, p);
    const rounded = { xPct: round2(focusX), yPct: round2(focusY), opacity: round2(opacity), scale: round2(scale) };
    if (
      rounded.xPct !== this.lastAnchor.xPct ||
      rounded.yPct !== this.lastAnchor.yPct ||
      rounded.opacity !== this.lastAnchor.opacity ||
      rounded.scale !== this.lastAnchor.scale
    ) {
      this.lastAnchor = rounded;
      this.onAnchorChange(rounded);
    }
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.particles.geometry.dispose();
    this.particleMaterial.dispose();
    this.imagePlane.geometry.dispose();
    this.imageMaterial.dispose();
    (this.imageMaterial.uniforms.uTexture.value as THREE.Texture | undefined)?.dispose();
    this.renderer.dispose();
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function smooth01(n: number): number {
  const x = clamp01(n);
  return x * x * (3 - 2 * x);
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
