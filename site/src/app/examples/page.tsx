import type { Metadata } from "next";
import { Examples } from "@/surfaces/examples";

export const metadata: Metadata = {
  title: "Examples • Torph",
  description:
    "Runnable patterns for animating text and numbers with torph: copy buttons, live counters, chart readouts, reflowing paragraphs, streamed text, amount fields and accruing balances.",
};

export default function Page() {
  return <Examples />;
}
