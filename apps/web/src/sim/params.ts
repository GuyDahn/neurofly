/**
 * Shiu et al. 2024, Nature. Membrane and synapse constants are the published
 * values (rest, reset, threshold, tau, refractory, delay, W_syn). The edge
 * sign is the Day 1 neurotransmitter sign: +1 acetylcholine, -1 GABA or
 * glutamate, 0 otherwise.
 *
 * Brian2 integrated this model at 0.1 ms. That quantum divides both the
 * 1.8 ms axonal delay and the 2.2 ms refractory period, so those intervals
 * land on exact ticks.
 */
export const TICK_US = 100;
export const TICK_MS = TICK_US / 1000;

export const SHIU = {
  restMv: -52,
  resetMv: -52,
  thresholdMv: -45,
  tauMembraneMs: 20,
  tauSynapseMs: 5,
  refractoryMs: 2.2,
  delayMs: 1.8,
  /** Millivolts added to postsynaptic g per anatomical synapse. */
  wSynMv: 0.275,
  /**
   * Poisson kicks land on voltage with weight W_syn * poissonGain, which is
   * enough for each event to cross threshold. Shiu et al. use 250.
   */
  poissonGain: 250,
} as const;

/** Above this requested rate the 0.1 ms tick cannot represent the Poisson process. */
export const MAX_STIMULUS_HZ = 2000;
