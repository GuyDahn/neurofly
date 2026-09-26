"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Sphere,
  SphereGeometry,
  Vector3,
  type InstancedMesh,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { samplePath, type NeuronPaths } from "./centerline.js";
import { drainCommands, setPoker, type ViewerCommand } from "./commands.js";
import { activityByGroup, FLASH_DECAY_MS } from "./flash.js";
import { frameSphere } from "./fit.js";
import {
  loadError,
  openCircuit,
  watchLoadProgress,
  type LoadedCircuit,
} from "./load-circuit.js";
import { useViewerStore } from "./store.js";
import type { ModuleSpec } from "./types.js";

const MAX_DOTS = 32;
const MIN_MODEL_MS = 0.2;
const MAX_MODEL_MS = 2;

type Dot = { neuron: number; ageMs: number };

function ignoreRaycast() {
  return undefined;
}

export default function Scene({ module }: { module: ModuleSpec }) {
  const [model, setModel] = useState<LoadedCircuit | null>(null);

  useEffect(() => {
    let active = true;
    const stop = watchLoadProgress((fraction) => {
      if (active) useViewerStore.getState().setProgress(fraction);
    });
    const ticket = openCircuit(module);
    void ticket.promise.then(
      (loaded) => {
        if (!active) return;
        setModel(loaded);
        useViewerStore.getState().setProgress(1);
        useViewerStore.getState().setStatus("ready");
      },
      (error: unknown) => {
        if (!active) return;
        useViewerStore.getState().setStatus("error", loadError(error));
      },
    );
    return () => {
      active = false;
      stop();
      ticket.release();
    };
  }, [module]);

  return (
    <Canvas
      flat
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ fov: 42, near: 0.1, far: 8000, position: [0, 0, 800] }}
      gl={{ antialias: true, alpha: false }}
      className="h-full w-full touch-none"
    >
      <color attach="background" args={["#09090b"]} />
      {model ? <CircuitView model={model} module={module} /> : null}
    </Canvas>
  );
}

function CircuitView({
  model,
  module,
}: {
  model: LoadedCircuit;
  module: ModuleSpec;
}) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const orbitRef = useRef<OrbitControls | null>(null);
  const dotsRef = useRef<InstancedMesh>(null);
  const fittedAspect = useRef<number | null>(null);
  const modelMs = useRef(1);
  const activityClock = useRef(0);
  const dots = useRef<Dot[]>([]);
  const cursor = useRef(0);
  const failed = useRef(false);
  const allowDots = useRef(true);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const dummy = useMemo(() => new Object3D(), []);
  const dotGeometry = useMemo(() => new SphereGeometry(3.4, 10, 8), []);
  const dotMaterial = useMemo(() => {
    const material = new MeshBasicMaterial({ color: "#fff7e8" });
    material.toneMapped = false;
    return material;
  }, []);

  const placeCamera = useCallback(
    (force: boolean) => {
      const perspective = camera as PerspectiveCamera;
      if (perspective.isPerspectiveCamera !== true) return;
      const view = sizeRef.current;
      if (view.width < 2 || view.height < 2) return;
      const aspect = view.width / view.height;
      if (
        !force &&
        fittedAspect.current !== null &&
        Math.abs(aspect - fittedAspect.current) < 0.25
      ) {
        return;
      }
      fittedAspect.current = aspect;
      const sphere = model.bounds.getBoundingSphere(new Sphere());
      const frame = frameSphere(sphere.radius, perspective.fov, aspect);
      const direction = new Vector3(0.72, 0.42, 0.86).normalize();
      perspective.aspect = aspect;
      perspective.position
        .copy(sphere.center)
        .addScaledVector(direction, frame.distance);
      perspective.near = frame.near;
      perspective.far = frame.far;
      perspective.lookAt(sphere.center);
      perspective.updateProjectionMatrix();
      const orbit = orbitRef.current;
      if (orbit) {
        orbit.target.copy(sphere.center);
        orbit.minDistance = Math.max(sphere.radius * 0.18, frame.near * 2);
        orbit.maxDistance = frame.distance * 6;
        orbit.update();
      }
      invalidate();
    },
    [camera, invalidate, model.bounds],
  );

  useLayoutEffect(() => {
    placeCamera(false);
  }, [placeCamera, size.width, size.height]);

  useEffect(() => {
    allowDots.current = !window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.08;
    orbit.rotateSpeed = 0.85;
    orbit.zoomSpeed = 0.9;
    orbit.screenSpacePanning = true;
    gl.domElement.style.touchAction = "none";
    const onChange = () => invalidate();
    orbit.addEventListener("change", onChange);
    orbitRef.current = orbit;
    placeCamera(true);
    setPoker(() => invalidate());
    invalidate();
    return () => {
      orbit.removeEventListener("change", onChange);
      orbit.dispose();
      orbitRef.current = null;
      setPoker(() => undefined);
    };
  }, [camera, gl, invalidate, placeCamera]);

  useEffect(() => {
    return () => {
      dotGeometry.dispose();
      dotMaterial.dispose();
    };
  }, [dotGeometry, dotMaterial]);

  useFrame((_, delta) => {
    if (failed.current) return;
    const moving = orbitRef.current?.update() ?? false;
    let busy = moving;
    try {
      if (!document.hidden) {
        for (const command of drainCommands())
          applyCommand(model, module, command, dots, dotsRef);
        const wallMs = Math.min(Math.max(delta, 0) * 1000, 64);
        const run =
          model.session.hasDrive() ||
          model.flash.busy ||
          dots.current.length > 0;
        if (run) {
          const started = performance.now();
          const result = model.session.step(modelMs.current);
          const elapsed = performance.now() - started;
          if (elapsed > 6)
            modelMs.current = Math.max(MIN_MODEL_MS, modelMs.current * 0.75);
          else if (elapsed < 2.5) {
            modelMs.current = Math.min(MAX_MODEL_MS, modelMs.current + 0.1);
          }
          for (const group of result.finished) {
            useViewerStore.getState().setStimulating(group, false);
          }
          const wasBusy = model.flash.busy;
          model.flash.decay(wallMs);
          model.flash.mark(result.spikes);
          if (wasBusy || model.flash.busy) model.texture.needsUpdate = true;
          advanceDots(
            dots.current,
            result.spikes,
            model.paths,
            wallMs,
            allowDots.current,
            cursor,
          );
          writeDots(dotsRef.current, dots.current, model.paths, dummy);
          activityClock.current += wallMs;
          if (activityClock.current >= 100) {
            activityClock.current = 0;
            const next = activityByGroup(
              model.flash.values,
              model.session.groups,
            );
            const prev = useViewerStore.getState().activity;
            if (activityChanged(prev, next))
              useViewerStore.getState().setActivity(next);
          }
          busy =
            busy ||
            model.session.hasDrive() ||
            model.flash.busy ||
            dots.current.length > 0;
        }
      }
    } catch (error) {
      failed.current = true;
      useViewerStore.getState().setStatus("error", loadError(error));
      return;
    }
    if (busy) invalidate();
  });

  return (
    <group>
      <lineSegments
        geometry={model.geometry}
        material={model.material}
        raycast={ignoreRaycast}
      />
      <instancedMesh
        ref={dotsRef}
        args={[dotGeometry, dotMaterial, MAX_DOTS]}
        frustumCulled={false}
        raycast={ignoreRaycast}
      />
    </group>
  );
}

function applyCommand(
  model: LoadedCircuit,
  module: ModuleSpec,
  command: ViewerCommand,
  dots: { current: Dot[] },
  dotsRef: { current: InstancedMesh | null },
) {
  if (command.type === "stimulate") {
    model.session.stimulate(
      command.colorGroup,
      module.stimulusHz,
      module.stimulusMs,
    );
    useViewerStore.getState().setStimulating(command.colorGroup, true);
    return;
  }
  if (command.type === "silence") {
    model.session.setSilenced(command.colorGroup, command.on);
    return;
  }
  model.session.reset();
  model.flash.clear();
  model.texture.needsUpdate = true;
  dots.current = [];
  const mesh = dotsRef.current;
  if (mesh) {
    mesh.count = 0;
    mesh.instanceMatrix.needsUpdate = true;
  }
  useViewerStore.getState().resetControls();
}

function advanceDots(
  dots: Dot[],
  spikes: Uint8Array,
  paths: NeuronPaths,
  wallMs: number,
  allow: boolean,
  cursor: { current: number },
) {
  const alive: Dot[] = [];
  for (const dot of dots) {
    dot.ageMs += wallMs;
    if (dot.ageMs < FLASH_DECAY_MS) alive.push(dot);
  }
  dots.length = 0;
  for (const dot of alive) dots.push(dot);
  if (!allow || spikes.length === 0) return;
  let scanned = 0;
  while (scanned < spikes.length && dots.length < MAX_DOTS) {
    const neuron = cursor.current;
    cursor.current = (cursor.current + 1) % spikes.length;
    scanned += 1;
    if (!spikes[neuron]) continue;
    if (samplePath(paths, neuron, 0) === null) continue;
    const existing = dots.find((dot) => dot.neuron === neuron);
    if (existing) existing.ageMs = 0;
    else dots.push({ neuron, ageMs: 0 });
  }
}

function writeDots(
  mesh: InstancedMesh | null,
  dots: readonly Dot[],
  paths: NeuronPaths,
  dummy: Object3D,
) {
  if (!mesh) return;
  let visible = 0;
  for (const dot of dots) {
    const point = samplePath(paths, dot.neuron, dot.ageMs / FLASH_DECAY_MS);
    if (!point) continue;
    dummy.position.set(point[0], point[1], point[2]);
    dummy.scale.setScalar(1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(visible, dummy.matrix);
    visible += 1;
    if (visible >= MAX_DOTS) break;
  }
  mesh.count = visible;
  mesh.instanceMatrix.needsUpdate = true;
}

function activityChanged(
  prev: Record<string, number>,
  next: Record<string, number>,
): boolean {
  const keys = Object.keys(next);
  if (keys.length !== Object.keys(prev).length) return true;
  for (const key of keys) {
    if (Math.abs((prev[key] ?? 0) - (next[key] ?? 0)) > 0.008) return true;
  }
  return false;
}
