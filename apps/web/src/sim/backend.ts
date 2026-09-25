/**
 * WebGPU compute stays off. The typed-array worker holds 60 fps for the
 * 5,000-neuron bench (about 250 ms of CPU time for 60 frames of 0.1 ms
 * steps on one core). Turn this on only if sim-bench reports a miss, and
 * keep any GPU kernel behind the flag.
 */
export const SIM_WEBGPU_ENABLED = false;
