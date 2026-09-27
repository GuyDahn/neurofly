# WiredMind — a real fly brain you can poke, in your browser

[![CI](https://github.com/GuyDahn/wiredmind-edu/actions/workflows/ci.yml/badge.svg)](https://github.com/GuyDahn/wiredmind-edu/actions/workflows/ci.yml) [![Code: MIT](https://img.shields.io/badge/code-MIT-blue)](LICENSE) [![Data: CC BY 4.0](https://img.shields.io/badge/data-CC%20BY%204.0-lightgrey)](DATA_LICENSE.md) [![Languages: 18](https://img.shields.io/badge/languages-18-8b5cf6)](#languages)

Free classroom lessons on the real wiring of a fruit fly's nervous system. Students stimulate and silence neurons from the MaleCNS connectome in the browser, with no install and no login, in their own language.

**[Open WiredMind](https://wiredmind-edu.vercel.app)** · [Languages](#languages) · [What's real and what's simplified](#whats-real-and-whats-simplified) · [Roadmap and good first issues](#roadmap--good-first-issues)

![The escape lesson mid-stimulation: looming neurons firing in the MaleCNS wiring diagram](docs/screenshot.webp)

> **3 lessons · 11,500 real neurons · 18 languages · 10 minutes each · no install, no login, no ads**
>
> Press a button and a smell travels from the fly's antennae to where its memories are stored. Silence one cell, the giant fiber, and a 30-millisecond escape jump never happens. Every one of those neurons, and every synapse between them, was reconstructed from a real fly.

Every neuron and synapse count in WiredMind comes from MaleCNS v1.0, the complete connectome of a male fruit fly's central nervous system. The activity is a deliberately simple simulation, and [the section below](#whats-real-and-whats-simplified) says exactly where that line falls. Each lesson's claims are checked by tests that run it on the real circuits, and the heavy neuron data stays out of git so the repository is something a stranger can clone.

## The lessons

| Lesson                                                                                       | What students do                                                                                                              | Circuit                               |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1. [How a fly remembers a smell](https://wiredmind-edu.vercel.app/modules/smell-memory)      | Send a smell from the receptors to the Kenyon cells and output neurons, then silence the Kenyon cells and see what goes dark. | Smell pathway, 4,500 neurons          |
| 2. [How a fly knows which way it's facing](https://wiredmind-edu.vercel.app/modules/compass) | Push the compass bump around with the turn neurons, then silence the ring neurons and watch it drift.                         | Head-direction compass, 4,000 neurons |
| 3. [The 30-millisecond escape](https://wiredmind-edu.vercel.app/modules/escape)              | Follow a swatter from the looming neurons to the giant fiber and the jump neurons, then silence the giant fiber.              | Giant fiber escape, 3,000 neurons     |

Each lesson is four or five one-tap steps, one check question, and free play, about 10 minutes in all. For a class, that is one or two periods with discussion. The Share button copies a link that replays a student's run, spike for spike.

## Languages

Every page and every lesson is served in 18 languages, each at its own indexed address (`/he/modules/escape`, `/ja/about`), with `hreflang` links, a sitemap per language, and a share image rendered in the reader's own script.

| Language   | Path  | Language           | Path     | Language   | Path  |
| ---------- | ----- | ------------------ | -------- | ---------- | ----- |
| English    | `/en` | Deutsch            | `/de`    | 한국어     | `/ko` |
| עברית ↔    | `/he` | Português (Brasil) | `/pt-BR` | हिन्दी     | `/hi` |
| العربية ↔  | `/ar` | Русский            | `/ru`    | Italiano   | `/it` |
| Español    | `/es` | 简体中文           | `/zh-CN` | Türkçe     | `/tr` |
| Français   | `/fr` | 日本語             | `/ja`    | Polski     | `/pl` |
| Nederlands | `/nl` | Bahasa Indonesia   | `/id`    | Tiếng Việt | `/vi` |

↔ Hebrew and Arabic flip the whole layout right to left, the lesson panels and controls included.

**Which language you see.** Only the bare address `/` ever guesses, and it tries, in order: a language you picked from the language menu (the one cookie WiredMind sets), your browser's languages, your country when it has one clear classroom language (Israel gets Hebrew, Brazil Portuguese), then English. It only accepts a close relative (Malay readers get Indonesian) and never a cross-language guess, so Ukrainian readers get English, not Russian. A URL that names its language is always served in that language, so a shared lesson opens the way it was shared.

**Next in line.** فارسی, اردو, Українська, বাংলা, ไทย, Bahasa Melayu, Filipino, Kiswahili, தமிழ், తెలుగు, मराठी, Svenska, Dansk, Norsk bokmål, Suomi, Čeština, Ελληνικά, Română, Magyar, Català, and 繁體中文 already have addresses. `/fa/about` serves the English page with a note asking for help, stays out of search results, and switches over (right to left, for Persian and Urdu) the day its translation passes the check.

**How translations are made.** English in [apps/web/messages/en.json](apps/web/messages/en.json) is the source. `pnpm i18n:draft <locale>` drafts a language with Claude from English, a [glossary](apps/web/i18n/glossary.json) of terms every language must use the same way, and a per-language [style guide](apps/web/i18n/style-guide.json). `pnpm i18n:check` then holds every file to English: the same keys, valid ICU messages with the same placeholders and plural forms, the glossary's terms, the brand, the same numbers, and titles short enough for a search result. CI fails on any missing or broken string. Machine drafts stay marked unreviewed until a native speaker signs them off, and that review is the most useful contribution a bilingual teacher can make.

## Run it locally

You need Node 22.22.3 or newer (pinned in `.nvmrc`) and pnpm 10. The Python data pipeline and the full test suite also need [uv](https://docs.astral.sh/uv/) with Python 3.12.

```bash
pnpm install        # also installs the git hooks
pnpm data:fetch     # downloads data-v1 (about 19 MB) and bakes the landing loop
pnpm dev            # http://localhost:3000
```

`pnpm data:fetch` reads `data.lock.json`, downloads that data release from GitHub into `apps/web/public/data/`, checks each file's sha256, and bakes the landing page loop from the escape circuit. That directory is gitignored. If you already have the circuit files, `pnpm data:cascade` rebakes only the loop.

To rebuild the data itself, run `uv sync --directory tools/data`, then `uv run --directory tools/data make-data`. It downloads the MaleCNS flat files into `tools/data/raw/` (also gitignored), checks their MD5s, and cuts the circuits out of them. [tools/data/README.md](tools/data/README.md) describes each stage, and [tools/data/release.md](tools/data/release.md) has the publish command.

Before a pull request, run the same checks as CI:

```bash
pnpm lint           # ESLint, Prettier, ruff, and the translation check
pnpm typecheck
pnpm test           # node:test suites and pytest
```

The science tests skip until `pnpm data:fetch` has run.

## How it works

The pipeline is data → subcircuit → simulation → viewer. A Python pipeline cuts three circuits of 3,000 to 4,500 neurons out of MaleCNS and bakes them into `graph.bin` (the wiring), `neurons.json` (types and labels), and a Draco-compressed glTF (the shapes). They are published as a GitHub Release (`data-v1`) and pinned by sha256 in `data.lock.json`. The browser runs a leaky integrate-and-fire (LIF) simulation of the circuit with seeded noise, so the same button presses on the same ticks always give the same spikes, and draws the result with three.js.

| Page                           | What it is                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `/`                            | Picks a language (see [Languages](#languages)) and redirects to `/<lang>`                                    |
| `/<lang>`                      | Landing page: an 8-second loop of the escape lesson's first swatter, the lessons, and a section for teachers |
| `/<lang>/modules/smell-memory` | Lesson 1                                                                                                     |
| `/<lang>/modules/compass`      | Lesson 2                                                                                                     |
| `/<lang>/modules/escape`       | Lesson 3                                                                                                     |
| `/<lang>/about`                | What's real and what's simplified, credits, who made it, and how to support it                               |
| `/sim-bench`                   | Simulator speed on your machine, for developers (not indexed)                                                |

Addresses from before the site had languages, such as `/about`, redirect to their English page.

**Science tests.** `tests/lesson-science.test.ts` runs each lesson's steps on the real circuits and checks what the copy says lights up, moves, or goes dark. `tests/about-science.test.ts` checks the numbers the about page quotes against the same data, so the copy cannot drift from a new data release.

**Share links.** A link's `?r=` parameter is base64url for the lesson id, the noise seed, and each button press with the simulator tick it landed on, so opening it repeats the same spikes. Links made before the landing page existed pointed at `/?r=` and redirect to the lesson.

**The landing loop** is baked, not recorded. `scripts/cascade-bake.ts` reads the escape circuit, traces each neuron's centerline the way the viewer does, runs the escape lesson's first stimulus on the lesson's seed, and writes the first 64 ms of spikes to `escape-cascade.json` (about 45 KB compressed). The page draws it on a 2D canvas 100 times slower than life, holds a still frame for readers who prefer reduced motion, and pauses off screen.

**Hosting.** Vercel builds from `apps/web` with `pnpm --dir ../.. data:fetch && pnpm build` ([apps/web/vercel.json](apps/web/vercel.json)) and serves `wiredmind-edu.vercel.app`. Everything under `/data/` gets a one-year immutable cache. The viewer asks for each circuit file with `?v=<data release>`, and the landing page asks for the loop with a hash of its contents, so new data is always a new URL. There are no accounts and no tracking. The only cookie remembers a language picked from the menu, and page views are counted with Vercel Web Analytics, which is cookie-free, and replay parameters are stripped before a view is sent.

**Speed.** Measured on the live site over a throttled 4G connection (9 Mbps, 170 ms round trip) with the CPU slowed four times: the landing page paints in 0.9 s. A lesson's text paints in under a second, and its circuit is ready to use after 4.7 s (escape) to 6 s (smell and compass). Most of that wait is downloading and decoding the 3D meshes, which [the roadmap](#roadmap--good-first-issues) aims to cut.

### Where things are

```text
apps/web/             Next.js app, and the Vercel project root
  app/[locale]/       routes: landing, about, lessons, each under its language
  app/                share images, sitemaps, robots, and error pages
  middleware.ts       the one place a language is guessed, and the old-URL redirects
  messages/           every string on the site, one file per language
  i18n/               the translation glossary and style guide
  content/            circuit definitions (module.json) and lesson scripts (modules/*.json)
  src/sim/            leaky integrate-and-fire simulator
  src/viewer/         3D viewer, lesson runner, and share-link replays
  src/site/           landing loop, header, footer, language menu, and metadata
  src/i18n/           the language list, detection, and right-to-left rules
  src/og/             share images, with text shaped for every script
  public/draco/       Draco decoder, copied from three.js
scripts/              data download and sha256 checks, the landing-loop bake, translation draft and check, git hooks
tools/data/           Python pipeline that cuts the circuits out of MaleCNS
tests/                node:test suites, including the science checks
docs/                 notes, the screenshot, and USER_TEST.md
data.lock.json        the data release tag and each file's sha256
```

## What's real and what's simplified

WiredMind is a teaching tool, not a research model. If you know the fly literature, this is the section to read before you trust or reuse anything here. The same account, in plainer words, is on the [about page](https://wiredmind-edu.vercel.app/about).

**Real**

- **Neurons and cell types.** Every neuron is a reconstructed body from [MaleCNS v1.0](https://male-cns.janelia.org/), with the cell type its authors assigned. Only typed neurons are used; glia and fragments are excluded. The cuts hold 4,500 (smell), 4,000 (compass), and 3,000 (escape) neurons.
- **Synapse counts.** Each connection's weight is the number of synapses the dataset reports between the two neurons, from the `minconf-0.5` connectome table (synapse detection confidence 0.5 or above).
- **Transmitter signs.** A neuron's consensus transmitter prediction signs all of its outputs: acetylcholine +1, GABA and glutamate −1, and everything else (dopamine, serotonin, octopamine, unclear) 0, so those synapses do nothing.
- **Shapes and positions.** Neurons are drawn from their SWC skeletons in dataset coordinates.

**Simplified**

- **Pruned subcircuits of 3,000 to 4,500 neurons.** Seeds and hop counts are in [tools/data/seeds.yaml](tools/data/seeds.yaml). The smell cut is its four seed populations only (ORNs, antennal lobe PNs, Kenyon cells, MBONs), capped at 4,500 by taking each population's most strongly connected cells in turn. The compass cut (ring neurons, E-PG, P-EN, P-EG, EL) and the escape cut (DNp01, the giant fiber) grow two hops out and keep the most strongly connected partners. Connections with fewer than 5 synapses are dropped. Everything outside a cut is gone, including inhibition that would normally balance it.
- **Uniform leaky integrate-and-fire point neurons.** One parameter set for every cell, the published values of [Shiu et al. 2024](https://doi.org/10.1038/s41586-024-07763-9): rest and reset −52 mV, threshold −45 mV, τ<sub>m</sub> 20 ms, τ<sub>syn</sub> 5 ms, 2.2 ms refractory period, 1.8 ms axonal delay, 0.275 mV per synapse, 0.1 ms steps ([apps/web/src/sim/params.ts](apps/web/src/sim/params.ts)). There is no dendritic computation, no graded or non-spiking neurons, no neuromodulation, and no plasticity.
- **No gap junctions.** The connectome records chemical synapses only, so the model has no electrical synapses. This matters most in the escape lesson: in a real fly the giant fiber's connection to the jump motor neuron (TTMn) is a mixed synapse that leans heavily on gap junctions. Here that link is its 90 chemical synapses.
- **Nothing learns.** The smell lesson shows where odor memories are stored, at the Kenyon cell to MBON synapses, but its cut has no dopaminergic neurons, no APL neuron, and no learning rule, so those weights never change.
- **Idealized stimulation.** Stimulate drives every neuron in a group with independent Poisson input (40 Hz for 200 ms in the smell and escape lessons, 60 Hz for 800 ms on the P-EN2 turn neurons), and every event crosses threshold (W<sub>syn</sub> × 250, as in Shiu et al.), much like optogenetic activation. The lesson's smell is all 1,861 ORNs in the cut at once, not an odor-specific receptor pattern. The swatter is all 304 LC4 and LPLC2 cells at once, not recruitment that follows a growing looming object.
- **Silence is a hard clamp.** Silenced neurons are held at rest and send nothing, as in Shiu et al.'s removal of outgoing synapses. Genetic tools such as Kir2.1 or tetanus toxin are partial and slower, and tetanus toxin leaves gap junctions working.
- **Compass landmarks.** The ring neurons receive no visual input in the model. Silencing them removes their GABAergic inhibition of the E-PG compass neurons, which is what lets the bump drift in the lesson.
- **Timing.** Latencies come out of the uniform delay and time constants and were not fitted to recordings. In the escape lesson the jump neurons first fire 13.2 ms after the stimulus starts. The viewer advances 0.2 to 2 ms of fly time per frame, depending on the device, and stops simulating 150 ms after the last stimulus, because some cuts have excitatory loops that would otherwise reverberate without the inhibition left outside.
- **Drawings, not morphology.** Each neuron is a 12-point line through its skeleton. Flashes mark spikes; the moving dots are illustration, not conduction.

**What a research tool would do differently**

- Simulate the whole central nervous system, or cut it on principled boundaries with modeled inputs, keep weak connections, and test how much the cut changes the result.
- Fit parameters by cell type to electrophysiology, model graded and non-spiking neurons, and use conductance-based or multi-compartment models where dendrites matter.
- Add gap junctions from other data, neuromodulators such as dopamine and octopamine, and plasticity, for example dopamine-gated depression at Kenyon cell to MBON synapses.
- Drive sensory neurons with realistic input: odor-specific receptor patterns, and looming stimuli that recruit LC4 and LPLC2 as the object expands.
- Treat transmitter predictions and weights as uncertain, sweep them, run many seeds, and validate against recordings and behavior.

To go deeper, query the dataset in [neuPrint](https://neuprint.janelia.org/?dataset=male-cns%3Av1.0) (dataset `male-cns:v1.0`), read [the MaleCNS paper](https://doi.org/10.1016/j.cell.2026.08.015), and see [Shiu et al. 2024](https://doi.org/10.1038/s41586-024-07763-9) for the whole-brain LIF model these parameters come from.

## Roadmap / good first issues

Read [CONTRIBUTING.md](CONTRIBUTING.md) first, and open an issue before starting anything large. Any change to lesson copy has to pass the science tests on the real circuits.

**Good first issues**

- **Review a translation in your language.** `pnpm i18n:check --locale <code> --unreviewed` lists the lines no native speaker has signed off yet. Fixing a term in [the glossary](apps/web/i18n/glossary.json) fixes it everywhere.
- **Put the brain dorsal side up in the viewer.** MaleCNS y grows ventrally, so the viewer's default camera (`placeCamera` in [apps/web/src/viewer/scene.tsx](apps/web/src/viewer/scene.tsx)) shows the nervous system upside down. The landing loop already uses a dorsal-up view (`VIEW` in [apps/web/src/site/cascade-scene.ts](apps/web/src/site/cascade-scene.ts)).
- **Test the order of the smell lesson's step 2.** The copy says receptors fire, then projection neurons, then Kenyon cells. Add a check to [tests/lesson-science.test.ts](tests/lesson-science.test.ts) that the first spikes arrive in that order.
- **Add a web app manifest** (`apps/web/app/manifest.ts`) so classroom tablets can add WiredMind to the home screen.
- **Keyboard shortcuts for lessons,** such as a key that presses the cued button and one for Next, in [apps/web/src/viewer/module-runner.tsx](apps/web/src/viewer/module-runner.tsx).
- **A printable teacher sheet for each lesson,** built from the steps and check question in [apps/web/content/modules/](apps/web/content/modules/).

**Roadmap**

- **21 more languages.** Persian, Urdu, Ukrainian, Bengali, Thai, and the rest of [the list above](#languages) already have addresses and fall back to English. Each one goes live when its messages file passes `pnpm i18n:check`.
- **Lighter lesson downloads.** The viewer draws one 12-point line per neuron, but each lesson downloads full Draco tube meshes (1.4 MB compressed for the escape circuit) and decodes them to get those lines. A data release that ships the lines, the way the landing loop already does, would roughly halve a lesson's download and skip decoding.
- **Decode off the main thread.** Parsing a circuit and tracing its lines run on the main thread, and that is most of a lesson's blocking time on slow phones. A worker would keep the page responsive while it loads.
- **Learning in the smell circuit.** Add dopaminergic neurons to the cut and a dopamine-gated Kenyon cell to MBON rule, so the model remembers instead of only showing where memory lives.
- **Gap junctions for the escape circuit,** with a conductance taken from giant fiber recordings.
- **Offline classrooms.** Cache the data release in a service worker for schools with patchy Wi-Fi.
- **More circuits,** such as CO₂ avoidance or courtship song.
- **A WebGPU simulator** behind `SIM_WEBGPU_ENABLED`, if larger cuts need it. [docs/NOTES-webgpu-fly.md](docs/NOTES-webgpu-fly.md) has notes.

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) covers setup, the git hooks, and the rules for data: neuron data, raw downloads, and baked assets never go in git. Commits follow [Conventional Commits](https://www.conventionalcommits.org/). [USER_TEST.md](docs/USER_TEST.md) is a printable script for watching one person try lesson 1, if you want to test with a real student. Everyone taking part is expected to follow the [code of conduct](CODE_OF_CONDUCT.md).

## Credits

Neurons from the MaleCNS v1.0 connectome by [HHMI Janelia FlyEM](https://www.janelia.org/project-team/flyem), the [University of Cambridge](https://www.cam.ac.uk/), the [MRC Laboratory of Molecular Biology](https://www2.mrc-lmb.cam.ac.uk/), and [Google Research](https://research.google/), under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). WiredMind changes the data: it cuts out three small circuits, drops connections of fewer than five synapses, and draws each neuron as a simplified line.

> Berg, S., Beckett, I. R., Costa, M., Schlegel, P., Januszewski, M., et al. (2026). Sexual dimorphism in the complete _Drosophila_ male central nervous system connectome. _Cell_ 189, 5504–5526.e15. https://doi.org/10.1016/j.cell.2026.08.015

The simulator uses the neuron model and parameters of:

> Shiu, P. K., et al. (2024). A _Drosophila_ computational brain model reveals sensorimotor processing. _Nature_ 634, 210–219. https://doi.org/10.1038/s41586-024-07763-9

The Draco decoder in `apps/web/public/draco/` is Google's glTF build (Apache-2.0), copied unchanged from three.js 0.169.0. Nothing else is vendored. [docs/NOTES-webgpu-fly.md](docs/NOTES-webgpu-fly.md) records what in [abgnydn/webgpu-fly](https://github.com/abgnydn/webgpu-fly) (MIT) could be ported later; none of that code was copied.

Built with [Next.js](https://nextjs.org/), [three.js](https://threejs.org/), [Tailwind CSS](https://tailwindcss.com/), and [Vercel](https://vercel.com/).

## License

The code is MIT licensed; see [LICENSE](LICENSE). The neuron data, and anything baked from it, is CC BY 4.0; [DATA_LICENSE.md](DATA_LICENSE.md) says how to credit it if you reuse it.

## About

Built by [Guy Dahan](https://guy-dev.com) over one week in September 2026. WiredMind is free and always will be. If it helped your class, [coffee keeps the server humming](https://buymeacoffee.com/guydahn).

Formerly NeuroFly (renamed Sept 2026 to avoid a name clash); the `NFLY` magic bytes at the start of each `graph.bin` are left from that name so the published `data-v1` files keep loading.
