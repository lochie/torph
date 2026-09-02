import type { Metadata } from "next";
import { Showcase } from "@/surfaces/showcase";

export const metadata: Metadata = {
  title: "Showcase – Torph",
  description: "Interfaces people have built with Torph",
};

export default function Page() {
  return <Showcase />;
}
