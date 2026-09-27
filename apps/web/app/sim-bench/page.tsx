import type { Metadata } from "next";
import { Bench } from "./bench";

export const metadata: Metadata = {
  title: "Simulator bench",
  description:
    "Spikes per second for the classroom leaky integrate-and-fire network.",
  // A developer tool, not a page for classrooms or search results.
  robots: { index: false, follow: false },
};

export default function SimBenchPage() {
  return <Bench />;
}
