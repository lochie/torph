import { Suspense } from "react";
import { Playground } from "@/surfaces/playground";

export default function Page() {
  return (
    <Suspense>
      <Playground />
    </Suspense>
  );
}
