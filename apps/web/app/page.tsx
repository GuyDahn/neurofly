export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <p className="text-sm uppercase tracking-wide text-neutral-500">
        Neurofly
      </p>
      <h1 className="text-4xl font-semibold tracking-tight">
        Fly Brain for Classrooms
      </h1>
      <p className="text-lg text-neutral-700">
        The classroom circuits run a leaky integrate-and-fire model. The{" "}
        <a className="underline" href="/sim-bench">
          simulator bench
        </a>{" "}
        prints spikes per second for a 5,000-neuron network.
      </p>
    </main>
  );
}
