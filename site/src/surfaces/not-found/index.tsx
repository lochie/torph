"use client";

import styles from "./styles.module.scss";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TextMorph } from "torph/react";
import { useWebHaptics } from "web-haptics/react";

import { Footer } from "@/components/footer";
import { useMascotSpot } from "@/components/mascot/spots";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import {
  nearest,
  repairSteps,
  tidyPath,
  type Match,
  type Step,
} from "./repair";

const ROUTES = ["/", "/docs", "/examples", "/how", "/playground", "/showcase"];

const OPENING = "404"; // The typed path is client-only, so the server needs a value it can't mismatch
const SETTLE = 1400; // Beat to read what you asked for before the first character moves
const STEP = 700;

type Plan = Match & { steps: Step[] };

export const NotFound = () => {
  const pathname = usePathname();
  const reducedMotion = usePrefersReducedMotion();
  const { trigger } = useWebHaptics();

  const [plan, setPlan] = React.useState<Plan | null>(null);
  const [step, setStep] = React.useState(0);
  const [revealed, setRevealed] = React.useState(false);

  React.useEffect(() => {
    const typed = tidyPath(pathname || window.location.pathname);
    const match = nearest(typed, ROUTES);
    setPlan({ ...match, steps: repairSteps(typed, match.route) });
    setStep(0);
  }, [pathname]);

  const last = plan ? plan.steps.length - 1 : 0;
  const done = plan !== null && step === last;

  React.useEffect(() => {
    if (done) setRevealed(true);
  }, [done]);

  React.useEffect(() => {
    if (!plan || done) return;
    if (reducedMotion) {
      setStep(last);
      return;
    }
    const id = window.setTimeout(
      () => {
        setStep(step + 1);
        trigger("selection");
      },
      step === 0 ? SETTLE : STEP,
    );
    return () => window.clearTimeout(id);
  }, [plan, step, last, done, reducedMotion, trigger]);

  // The running commentary is his, so the card carries the path and nothing else.
  const label = !plan
    ? "You were close!"
    : done
      ? plan.close
        ? "This page?"
        : "How about home?"
      : step === 0
        ? "Are you lost?"
        : `How about...`;

  const narrator = useMascotSpot<HTMLDivElement>({ side: "on", says: label });

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.stage}>
          <div className={styles.content} data-found={done} aria-hidden>
            <div className={styles.narrator} ref={narrator} />
            <TextMorph className={styles.path}>
              {plan ? plan.steps[step]!.text : OPENING}
            </TextMorph>
          </div>

          <div className={styles.actions}>
            {revealed && plan && (
              <Link className={styles.go} href={plan.route}>
                Take me to there &rarr;
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
