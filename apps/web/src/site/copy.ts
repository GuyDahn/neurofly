import {
  AUTHOR,
  COFFEE_URL,
  LINKS,
  PAPER,
  REPO_URL,
  SITE_NAME,
} from "./site.js";
import type { Link, Rich } from "./text.js";

/** A point with a bold lead-in, for lists a reader skims. */
type Item = { title: string; body: Rich };

/**
 * Every string the landing page, the about page, and the site footer show.
 * Lesson text lives with the lessons in content/modules.
 *
 * To translate, copy `en` into a new locale typed as `SiteCopy` and keep the
 * shape. A `Rich` value is a sentence split into plain runs and links, so a
 * translation can move the link anywhere in the sentence.
 */

const en = {
  meta: {
    title: `${SITE_NAME}: explore a real fruit fly brain`,
    description:
      "Free classroom lessons on the real wiring of a fruit fly’s nervous system. Stimulate and silence neurons from the MaleCNS connectome in your browser. No install, no login.",
    shareTitle: "Watch a fly’s escape reflex race through its real wiring",
    shareSubtitle: "Free classroom lessons on the MaleCNS connectome",
    shareAlt:
      "The escape reflex lighting up in a real fruit fly’s wiring diagram, from WiredMind",
    aboutTitle: "About",
    aboutDescription:
      "What’s real and what’s simplified in WiredMind’s fruit fly brain lessons, who built it, and how to support it.",
  },
  nav: {
    home: `${SITE_NAME} home`,
    lessons: "Lessons",
    teachers: "For teachers",
    about: "About",
  },
  hero: {
    eyebrow: "Free neuroscience lessons for the classroom",
    title:
      "Fire a neuron in a real fruit fly’s brain and watch the signal race from its eyes to its legs.",
    lead: "WiredMind runs the real wiring diagram of a fruit fly’s nervous system in the browser. Students stimulate neurons, silence them, and see what changes, in three short guided lessons.",
    start: "Start the first lesson",
    teachers: "For teachers",
  },
  loop: {
    label: "Animation of the escape reflex in the fly’s wiring diagram",
    caption: [
      "The first 64 ms after a swatter appears, from the escape lesson, slowed 100 times. The wiring is real, from the MaleCNS connectome. The spikes come from a simple simulation. ",
      { text: "What’s simplified", href: "/about#real-and-simplified" },
    ] satisfies Rich,
    steps: {
      looming: "Looming neurons spot the swatter",
      gf: "The giant fiber fires",
      jump: "The jump neurons kick",
    } as Record<string, string>,
    cells: "{count} cells",
    at: "{ms} ms",
    clock: "{ms} ms of fly time",
    waiting: "Swatter incoming",
    pause: "Pause the animation",
    play: "Play the animation",
    loading: "Loading the circuit…",
    failed: "The animation did not load. The lessons still work.",
  },
  lessons: {
    title: "Three lessons, one real nervous system",
    lead: "Each lesson is a few taps long. Students stimulate and silence real cell types, answer one question, then explore on their own.",
    lesson: "Lesson {n}",
    meta: "{steps} steps and a question · about 10 minutes",
    start: "Start lesson {n}",
  },
  teachers: {
    title: "For teachers",
    lead: "Put the link on the board or send it to students’ own devices. Nothing else to set up.",
    points: [
      {
        title: "1–2 class periods",
        body: "Each lesson takes about 10 minutes. All three, with discussion, fit in one or two periods.",
      },
      {
        title: "No install, no login",
        body: "It runs in the browser on laptops, Chromebooks, tablets, and phones. Students never make an account or type an email.",
      },
      {
        title: "Free",
        body: "No ads, no paid tier, nothing to buy.",
      },
      {
        title: "Open source",
        body: "The code is MIT licensed, so you can read how it works or run your own copy.",
      },
      {
        title: "Shareable runs",
        body: "The Share button copies a link that replays a student’s run, spike for spike, so you see what they saw.",
      },
      {
        title: "Honest about the science",
        body: "A simple model of real wiring. The about page says exactly what is real and what is simplified.",
      },
    ],
    source: {
      text: "View the source on GitHub",
      href: REPO_URL,
    } satisfies Link,
    science: {
      text: "What’s real and what’s simplified",
      href: "/about#real-and-simplified",
    } satisfies Link,
  },
  credits: {
    title: "Where the neurons come from",
    body: [
      "Every neuron and synapse count comes from the ",
      { text: "MaleCNS v1.0 connectome", href: LINKS.maleCns },
      " of the male fruit fly’s central nervous system, made by ",
      { text: "HHMI Janelia FlyEM", href: LINKS.janelia },
      ", the ",
      { text: "University of Cambridge", href: LINKS.cambridge },
      ", the ",
      { text: "MRC Laboratory of Molecular Biology", href: LINKS.mrcLmb },
      ", and ",
      { text: "Google Research", href: LINKS.googleResearch },
      ".",
    ] satisfies Rich,
    citation: PAPER.citation,
    doi: { text: `doi:${PAPER.doi}`, href: PAPER.url } satisfies Link,
    license: [
      "The data is licensed under ",
      { text: "CC BY 4.0", href: LINKS.ccBy },
      ". WiredMind changes it: it cuts out three small circuits, drops connections of fewer than five synapses, and draws each neuron as a simplified line. The simulator uses the neuron model of ",
      { text: "Shiu et al. (2024)", href: LINKS.shiu },
      ".",
    ] satisfies Rich,
  },
  about: {
    title: "About WiredMind",
    lead: "WiredMind is a set of free classroom lessons built on the real wiring diagram of a fruit fly. It is a teaching tool, not a research model. This page is for readers who want to know exactly where the line falls.",
    real: {
      id: "real-and-simplified",
      title: "What’s real and what’s simplified",
      realTitle: "Real",
      realItems: [
        {
          title: "The neurons.",
          body: [
            "Each lesson uses 3,000 to 4,500 reconstructed neurons from the ",
            { text: "MaleCNS v1.0", href: LINKS.maleCns },
            " connectome, the whole central nervous system of one male fly, with the cell types its authors assigned.",
          ],
        },
        {
          title: "The synapse counts.",
          body: [
            "The weight of every connection is the number of synapses the dataset reports between the two cells, at detection confidence 0.5 or above.",
          ],
        },
        {
          title: "The signs.",
          body: [
            "A neuron’s predicted transmitter sets whether it excites or inhibits: acetylcholine excites, GABA and glutamate inhibit. Cells predicted to release dopamine, serotonin, octopamine, or an unclear transmitter have no effect in the model.",
          ],
        },
        {
          title: "The shapes and positions.",
          body: [
            "Each neuron is drawn from its own skeleton in the dataset, where it really sits in the fly.",
          ],
        },
      ] satisfies Item[],
      simplifiedTitle: "Simplified",
      simplifiedItems: [
        {
          title: "Small cuts.",
          body: [
            "Each lesson runs a subcircuit of 3,000 to 4,500 neurons, not the whole nervous system. The smell circuit is four cell populations: receptors, projection neurons, Kenyon cells, and output neurons. The compass and escape circuits grow two hops out from their seed cell types and keep the most strongly connected partners. Connections of fewer than five synapses are dropped. Everything outside the cut is gone, including inhibition that would normally balance the network.",
          ],
        },
        {
          title: "One neuron model for every cell.",
          body: [
            "Leaky integrate-and-fire point neurons with the same parameters everywhere, the published values of ",
            { text: "Shiu et al. (2024)", href: LINKS.shiu },
            ": rest and reset −52 mV, threshold −45 mV, membrane time constant 20 ms, synaptic time constant 5 ms, 2.2 ms refractory period, 1.8 ms delay, 0.275 mV per synapse. No dendritic computation, no graded or non-spiking neurons, no neuromodulation, and no learning: synapses never change.",
          ],
        },
        {
          title: "No gap junctions.",
          body: [
            "The connectome records chemical synapses only, so electrical synapses are absent. This matters most in the escape lesson: in a real fly the giant fiber’s link to the jump motor neuron is a mixed synapse that leans heavily on gap junctions. Here that link is its 90 chemical synapses.",
          ],
        },
        {
          title: "Nothing learns.",
          body: [
            "The smell lesson shows where a fly stores odor memories, the synapses from Kenyon cells to output neurons, but the model has no dopamine neurons and no plasticity. The cut also leaves out the APL neuron that keeps Kenyon cell activity sparse.",
          ],
        },
        {
          title: "Idealized stimulation.",
          body: [
            "Stimulate drives every neuron in a group with independent Poisson input (40 Hz for 200 ms in the smell and escape lessons, 60 Hz for 800 ms for the turn neurons), each event strong enough to fire the cell, much like optogenetic activation. A real odor activates a few receptor types in a pattern; the lesson’s smell fires all 1,861 receptor neurons in the cut. The swatter fires all 304 looming cells at once, where a real looming object recruits them as it grows.",
          ],
        },
        {
          title: "Silence is a hard clamp.",
          body: [
            "A silenced group sits at rest, never spikes, and sends nothing. Real silencing tools such as Kir2.1 or tetanus toxin are partial, slower, and can leave electrical synapses working.",
          ],
        },
        {
          title: "Compass landmarks.",
          body: [
            "The ring neurons receive no visual input in the model. Silencing them removes their inhibition of the compass, which is what lets the bump drift here. In a real fly they bring landmarks and other cues in from the senses.",
          ],
        },
        {
          title: "Timing.",
          body: [
            "Latencies come from one uniform 1.8 ms delay and the membrane and synaptic time constants, not from recordings. They land in a plausible range, but nothing was tuned to match measured escape latencies. The viewer plays it all in slow motion, 0.2 to 2 ms of fly time per frame depending on the device, and stops simulating 150 ms after the last stimulus, because some cuts have excitatory loops that would otherwise echo forever without the inhibition left outside.",
          ],
        },
        {
          title: "Drawings, not morphology.",
          body: [
            "Each neuron is drawn as a 12-point line along its skeleton, not its real branches. Flashes mark spikes. The moving dots are illustration, not conduction speed or the real path of a spike.",
          ],
        },
      ] satisfies Item[],
      researchTitle: "What a research tool would do differently",
      researchItems: [
        [
          "Simulate the whole central nervous system, or cut it on principled boundaries with modeled inputs, and keep weak connections.",
        ],
        [
          "Fit parameters by cell type to recordings, allow graded and non-spiking neurons, and use conductance-based or multi-compartment models where dendrites matter.",
        ],
        [
          "Add gap junctions from other data, neuromodulators such as dopamine and octopamine, and plasticity, for example dopamine-gated depression at Kenyon cell to output neuron synapses.",
        ],
        [
          "Drive sensory neurons the way the world does: odor-specific receptor patterns, and looming stimuli that recruit cells as the object grows.",
        ],
        [
          "Treat the transmitter predictions and weights as uncertain, sweep them, run many seeds, and compare the results with electrophysiology and behavior.",
        ],
      ] satisfies Rich[],
      furtherTitle: "Go to the source",
      further: [
        [
          { text: "neuPrint", href: LINKS.neuprint },
          ": query MaleCNS v1.0 cell by cell and synapse by synapse.",
        ],
        [{ text: "The MaleCNS paper", href: PAPER.url }, `: ${PAPER.citation}`],
        [
          { text: "Shiu et al. (2024)", href: LINKS.shiu },
          ": the whole-brain leaky integrate-and-fire model whose parameters WiredMind borrows.",
        ],
        [
          { text: "The source code", href: REPO_URL },
          ": the data pipeline, the simulator, the lessons, and tests that check each lesson’s claims on the real circuits.",
        ],
      ] satisfies Rich[],
    },
    who: {
      id: "who-made-this",
      title: "Who made this",
      body: `WiredMind was built by ${AUTHOR.name}, a full-stack developer and SEO strategist in ${AUTHOR.city}, over one week in September 2026.`,
      github: { text: "GitHub", href: AUTHOR.github } satisfies Link,
      website: { text: "guy-dev.com", href: AUTHOR.website } satisfies Link,
    },
    support: {
      id: "support",
      title: "Support",
    },
    privacy: {
      title: "Privacy",
      body: "No accounts and no cookies. Page views are counted with Vercel Web Analytics, which does not use cookies.",
    },
  },
  support: {
    pitch:
      "WiredMind is free and always will be. If it helped your class, coffee keeps the server humming.",
    coffee: { text: "☕ Buy me a coffee", href: COFFEE_URL } satisfies Link,
  },
  a11y: {
    newTab: "(opens in a new tab)",
    skip: "Skip to content",
  },
  footer: {
    builtBy: `Built by ${AUTHOR.name}`,
    github: "GitHub",
    about: "About",
    license: "Code MIT · Data CC BY 4.0",
  },
};

type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly Widen<U>[]
    : { readonly [K in keyof T]: Widen<T[K]> };

export type SiteCopy = Widen<typeof en>;

const COPY: Record<string, SiteCopy> = { en };

export function siteCopy(locale = "en"): SiteCopy {
  return COPY[locale] ?? en;
}
