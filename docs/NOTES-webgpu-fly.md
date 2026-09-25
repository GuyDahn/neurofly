# Notes on abgnydn/webgpu-fly

Read from a clone at `~/Projects/webgpu-fly` (outside this repo). Nothing from that project is copied into Neurofly.

## What it is

[abgnydn/webgpu-fly](https://github.com/abgnydn/webgpu-fly) is a browser demo that runs a FlyWire female-brain connectome plus the Janelia MANC ventral nerve cord as leaky integrate-and-fire networks on WebGPU, then drives a MuJoCo fly body. It is not MaleCNS. Neuron ids, edge lists, and coordinates from that repo do not apply here.

## License

| Piece                                             | License                                  | Reuse here                                                                |
| ------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------- |
| webgpu-fly code, including `src/shaders/lif.wgsl` | MIT, copyright 2026 Ahmet Baris Gunaydin | Not copied. MIT would allow a later port if the copyright notice is kept. |
| TuragaLab flybody model (`LICENSE-FLYBODY`)       | Apache-2.0                               | Not used. Neurofly does not ship a body.                                  |
| FlyWire / MANC data inside that app               | CC BY, separate from MaleCNS             | Not used. Neurofly's data is MaleCNS v1.0, also CC BY, from Janelia.      |

## LIF kernel

`src/shaders/lif.wgsl` is one compute pass per timestep, one thread per neuron. The host stores the connectome as CSR (`row_ptr`, `col_idx`, `weight`) with weights already signed by neurotransmitter. Spikes are a bitset. Two bindings ping-pong so the gather reads last step's spikes.

The synapse is the two-state alpha filter from Shiu et al. 2024, not a single-step current pulse:

- `g_y` decays and then adds the previous `g_x`
- `g_x` decays and then adds the gathered spike input
- synaptic current is `g_y * w_syn`

`A_SYN` is a compile-time constant `exp(-1/5)` for a 1 ms step and a 5 ms synaptic time constant. The host (`src/simParams.ts`) refuses any other `dt`. Membrane leak uses `alpha = exp(-dt / tau_m)` with `tau_m = 20` ms. Threshold, reset, and rest are the Shiu values (`-45` mV threshold, `-52` mV reset and rest) with a refractory period of about 2.2 ms. `w_syn` in that repo is tuned so Kenyon cells land in a 5–15% activity band. That calibration is for FlyWire, not a constant to copy onto MaleCNS.

A second entry point, `clear_spikes`, zeroes the spike bitset at the start of the step. The shader needs more than the default eight storage buffers, so device creation has to raise `maxStorageBuffersPerShaderStage`.

## What is worth reusing later

- CSR plus a signed weight, which matches the `graph.bin` layout this pipeline writes (`src` index, `dst` index, int16 weight, presynaptic neurotransmitter sign).
- The fused gather / alpha synapse / leak / threshold / reset step, including the 1 ms `dt` constraint if the same alpha synapse is ported.
- Ping-pong spike bitsets and an explicit clear pass.
- The reminder that `w_syn` is a free parameter and has to be calibrated on the circuit you actually ship (Kenyon-cell sparsity is the check they used).

## What is not reusable

- FlyWire and MANC edge tables, neuron indices, and visual-input wiring.
- The walking policy, tripod gait, and flybody MJCF.
- Their empirical `w_syn` (0.005 in the current source, against a 0.275 mV note from the Shiu model). MaleCNS weights are anatomical synapse counts and need their own scale.
