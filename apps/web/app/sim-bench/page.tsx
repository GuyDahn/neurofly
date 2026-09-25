import type { Metadata } from "next";
import { Bench } from "./bench";

export const metadata: Metadata = {
  title: "Simulator bench",
  description:
    "Spikes per second for the classroom leaky integrate-and-fire network.",
};

export default function SimBenchPage() {
  return <Bench />;
}
