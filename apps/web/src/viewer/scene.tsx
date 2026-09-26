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
import { TICK_MS } from "../sim/index.js";
import { samplePath, type NeuronPaths } from "./centerline.js";
import { drainCommands, setPoker, type ViewerCommand } from "./commands.js";
import { activityByGroup, FLASH_DECAY_MS } from "./flash.js";
import { frameSphere } from "./fit.js";
import { writeFocus } from "./groups.js";
import {
  loadError,
  openCircuit,
  watchLoadProgress,
  type LoadedCircuit,
} from "./load-circuit.js";
import { activePlayback, recordCommand, restartRecording } from "./recorder.js";
import type { StepResult } from "./session.js";
import { useViewerStore } from "./store.js";
import type { ModuleSpec } from "./types.js";

const MAX_DOTS = 32;
/** Spike dot radius as a share of the framed region, so dots read the same zoomed in or out. */
const DOT_SHARE = 0.013;
const MIN_MODEL_MS = 0.2;
const MAX_MODEL_MS = 2;
/** Wall ms between activity meter and puff clock updates. */
const PUBLISH_MS = 100;

type Dot = { neuron: number; ageMs: number };

const NO_SPIKES = new Uint8Array(0);

type Runtime = {
  dots: Dot[];
  cursor: number;
  /** The puff the footer clock follows: its group and first tick. */
  puff: { colorGroup: string; startTick: number } | null;
};

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
    useViewerStore.getState().setStatus("loading");
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
      setModel(null);
    };
  }, [module]);

  useEffect(() => {
    const store = useViewerStore.getState();
    store.setCompass(model?.compass ?? null);
    store.setCircuit(model ? module.id : null);
    return () => {
      useViewerStore.getState().setCompass(null);
      useViewerStore.getState().setCircuit(null);
    };
  }, [model, module.id]);

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
  const fittedDistance = useRef<number | null>(null);
  const modelMs = useRef(1);
  const publishClock = useRef(0);
  const runtime = useRef<Runtime>({ dots: [], cursor: 0, puff: null });
  const failed = useRef(false);
  const allowDots = useRef(true);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const dummy = useMemo(() => new Object3D(), []);
  const dotGeometry = useMemo(() => {
    const radius = model.frameBounds.getBoundingSphere(new Sphere()).radius;
    return new SphereGeometry(Math.max(radius * DOT_SHARE, 0.5), 10, 8);
  }, [model]);
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
        Math.abs(aspect - fittedAspect.current) < 0.02
      ) {
        return;
      }
      fittedAspect.current = aspect;
      const sphere = model.frameBounds.getBoundingSphere(new Sphere());
      const frame = frameSphere(sphere.radius, perspective.fov, aspect);
      const wholeRadius = model.bounds.getBoundingSphere(new Sphere()).radius;
      const whole = frameSphere(wholeRadius, perspective.fov, aspect);
      // Farthest the learner can zoom out, framed on a part or on everything.
      const reach = Math.max(frame.distance, whole.distance) * 3;
      const orbit = orbitRef.current;
      perspective.aspect = aspect;
      if (force || !orbit || fittedDistance.current === null) {
        const direction = new Vector3(0.72, 0.42, 0.86).normalize();
        perspective.position
          .copy(sphere.center)
          .addScaledVector(direction, frame.distance);
        perspective.lookAt(sphere.center);
        orbit?.target.copy(sphere.center);
      } else {
        // The phone sheet grows and shrinks the canvas. Keep the learner's
        // turn and zoom, and only scale the distance to the new fit.
        const offset = perspective.position.clone().sub(orbit.target);
        offset.multiplyScalar(frame.distance / fittedDistance.current);
        perspective.position.copy(orbit.target).add(offset);
      }
      fittedDistance.current = frame.distance;
      perspective.near = frame.near;
      // Past the whole circuit even from the farthest zoom.
      perspective.far = reach + wholeRadius * 3;
      perspective.updateProjectionMatrix();
      if (orbit) {
        orbit.minDistance = Math.max(sphere.radius * 0.18, frame.near * 2);
        orbit.maxDistance = reach;
        orbit.update();
      }
      invalidate();
    },
    [camera, invalidate, model.bounds, model.frameBounds],
  );

  useLayoutEffect(() => {
    placeCamera(false);
  }, [placeCamera, size.width, size.height]);

  // Whatever ran on this circuit before (it is cached across pages) is not
  // part of the next recording. The lesson or replay resets it next.
  useEffect(() => {
    restartRecording(model.session.seed, performance.now());
  }, [model]);

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
    // Frames stop while the tab is hidden, so a puff sent then (or cut off
    // by switching apps) needs a nudge to finish when the learner comes back.
    document.addEventListener("visibilitychange", onChange);
    orbitRef.current = orbit;
    placeCamera(true);
    setPoker(() => invalidate());
    invalidate();
    return () => {
      orbit.removeEventListener("change", onChange);
      document.removeEventListener("visibilitychange", onChange);
      orbit.dispose();
      orbitRef.current = null;
      setPoker(() => undefined);
    };
  }, [camera, gl, invalidate, placeCamera]);

  useEffect(() => {
    const paint = (focus: readonly string[]) => {
      writeFocus(model.focus, model.session.groups, focus);
      model.focusTexture.needsUpdate = true;
      invalidate();
    };
    paint(useViewerStore.getState().focus);
    return useViewerStore.subscribe((state, prev) => {
      if (state.focus !== prev.focus) paint(state.focus);
    });
  }, [model, invalidate]);

  useEffect(() => {
    return () => {
      dotGeometry.dispose();
      dotMaterial.dispose();
    };
  }, [dotGeometry, dotMaterial]);

  const applyCommand = useCallback(
    (command: ViewerCommand, wallMs: number) => {
      const store = useViewerStore.getState();
      const state = runtime.current;
      if (command.type === "reset") {
        model.session.reset(command.seed);
        model.flash.clear();
        model.texture.needsUpdate = true;
        model.compass?.clear();
        state.dots = [];
        state.puff = null;
        const mesh = dotsRef.current;
        if (mesh) {
          mesh.count = 0;
          mesh.instanceMatrix.needsUpdate = true;
        }
        restartRecording(model.session.seed, wallMs);
        store.resetControls();
        return;
      }
      recordCommand(command, model.session.clock, wallMs);
      if (command.type === "stimulate") {
        model.session.stimulate(
          command.colorGroup,
          module.stimulusHz,
          module.stimulusMs,
        );
        state.puff = {
          colorGroup: command.colorGroup,
          startTick: model.session.clock,
        };
        store.setStimulating(command.colorGroup, true);
        store.setPuff({
          colorGroup: command.colorGroup,
          elapsedMs: 0,
          totalMs: module.stimulusMs,
        });
        return;
      }
      model.session.setSilenced(command.colorGroup, command.on);
      store.setSilenced(command.colorGroup, command.on);
    },
    [model, module],
  );

  useFrame((_, delta) => {
    if (failed.current) return;
    const moving = orbitRef.current?.update() ?? false;
    let busy = moving;
    try {
      if (!document.hidden) {
        const now = performance.now();
        for (const command of drainCommands()) applyCommand(command, now);
        const state = runtime.current;
        const wallMs = Math.min(Math.max(delta, 0) * 1000, 64);
        const budget = Math.max(1, Math.round(modelMs.current / TICK_MS));
        const quiet = () =>
          !model.session.running() &&
          !model.flash.busy &&
          state.dots.length === 0;
        const started = performance.now();
        let result: StepResult | null = null;
        let left = budget;
        const playback = activePlayback();
        if (playback && !playback.finished) {
          const outcome = playback.frame(
            model.session,
            budget,
            now,
            quiet,
            (command) => applyCommand(command, now),
          );
          result = outcome.result;
          left = outcome.left;
          busy = true;
          if (outcome.applied > 0) {
            useViewerStore.getState().setPlayback({
              applied: playback.applied,
              total: playback.total,
              done: false,
            });
          }
        }
        if (left > 0 && model.session.running()) {
          const step = model.session.advance(left, result !== null);
          result = {
            spikes: step.spikes,
            finished: [...(result?.finished ?? []), ...step.finished],
          };
        }
        const store = useViewerStore.getState();
        if (result) {
          const elapsed = performance.now() - started;
          if (elapsed > 6)
            modelMs.current = Math.max(MIN_MODEL_MS, modelMs.current * 0.75);
          else if (elapsed < 2.5) {
            modelMs.current = Math.min(MAX_MODEL_MS, modelMs.current + 0.1);
          }
          for (const group of result.finished) {
            store.setStimulating(group, false);
            if (state.puff?.colorGroup === group) {
              state.puff = null;
              store.setPuff(null);
            }
          }
        }
        // Flashes and dots fade on wall time, so they die out even after the
        // brain holds still at the end of a settle.
        if (result || model.flash.busy || state.dots.length > 0) {
          const wasBusy = model.flash.busy;
          model.flash.decay(wallMs);
          if (result) model.flash.mark(result.spikes);
          if (wasBusy || model.flash.busy) model.texture.needsUpdate = true;
          advanceDots(
            state,
            result?.spikes ?? NO_SPIKES,
            model.paths,
            model.focus,
            wallMs,
            allowDots.current,
          );
          writeDots(dotsRef.current, state.dots, model.paths, dummy);
          publishClock.current += wallMs;
          if (publishClock.current >= PUBLISH_MS || quiet()) {
            publishClock.current = 0;
            const next = activityByGroup(
              model.flash.values,
              model.session.groups,
            );
            if (activityChanged(store.activity, next)) store.setActivity(next);
            if (state.puff) {
              store.setPuff({
                colorGroup: state.puff.colorGroup,
                elapsedMs:
                  (model.session.clock - state.puff.startTick) * TICK_MS,
                totalMs: module.stimulusMs,
              });
            }
          }
        }
        if (model.compass?.update(model.flash.values, wallMs)) busy = true;
        if (playback?.finished && quiet()) {
          const shown = store.playback;
          if (shown && !shown.done) store.setPlayback({ ...shown, done: true });
        }
        busy = busy || !quiet();
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

/** Dots follow spikes along neurons in the focus. Dimmed cells flash but get no dot. */
function advanceDots(
  state: Runtime,
  spikes: Uint8Array,
  paths: NeuronPaths,
  focus: Uint8Array,
  wallMs: number,
  allow: boolean,
) {
  const alive: Dot[] = [];
  for (const dot of state.dots) {
    dot.ageMs += wallMs;
    if (dot.ageMs < FLASH_DECAY_MS) alive.push(dot);
  }
  state.dots = alive;
  if (!allow || spikes.length === 0) return;
  let scanned = 0;
  while (scanned < spikes.length && state.dots.length < MAX_DOTS) {
    const neuron = state.cursor;
    state.cursor = (state.cursor + 1) % spikes.length;
    scanned += 1;
    if (!spikes[neuron] || focus[neuron] === 0) continue;
    if (samplePath(paths, neuron, 0) === null) continue;
    const existing = state.dots.find((dot) => dot.neuron === neuron);
    if (existing) existing.ageMs = 0;
    else state.dots.push({ neuron, ageMs: 0 });
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
