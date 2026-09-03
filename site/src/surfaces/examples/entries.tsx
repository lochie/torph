import type { ComponentType } from "react";

import {
  BubbleSlider,
  CurrencySwap,
  DebugBoxes,
  Delta,
  Dimensions,
  Download,
  Earned,
  ExampleAction,
  ExampleChart,
  ExampleCopy,
  ExampleNumber,
  ExampleResize,
  ExampleRewrite,
  ExampleTicker,
  Filters,
  HexColour,
  HoldToConfirm,
  Install,
  NumbersOff,
  PullToCount,
  RangeShove,
  RatingSlider,
  ReorderList,
  ResultsSummary,
  SloshGauge,
  SpinDial,
  SplitBar,
  Spring,
  SqueezeToAbbreviate,
  SquishyNumber,
  Streaming,
  TrailingTag,
  Units,
  Versions,
  Wallet,
} from "@/surfaces/demos";

export type Demo = {
  label: string;
  Component: ComponentType;
};

export type Section = {
  title: string;
  demos: Demo[];
};

/** Hand-ordered: each section opens with the plainest use of what it covers. */
export const SECTIONS: Section[] = [
  {
    title: "Text",
    demos: [
      { label: "Install command", Component: Install },
      { label: "Hex colour", Component: HexColour },
    ],
  },
  {
    title: "Numbers",
    demos: [
      { label: "Version tag", Component: Versions },
      { label: "Counter", Component: ExampleNumber },
      { label: "Units", Component: Units },
      { label: "Delta", Component: Delta },
      { label: "Currency swap", Component: CurrencySwap },
      { label: "Dimensions", Component: Dimensions },
      { label: "Accruing balance", Component: Earned },
      { label: "Numbers off", Component: NumbersOff },
    ],
  },
  {
    title: "Interface",
    demos: [
      { label: "Action button", Component: ExampleAction },
      { label: "Copy button", Component: ExampleCopy },
      { label: "Rewrite", Component: ExampleRewrite },
      { label: "Ticker", Component: ExampleTicker },
      { label: "Chart readout", Component: ExampleChart },
      { label: "Results summary", Component: ResultsSummary },
      { label: "Wallet", Component: Wallet },
      { label: "Download progress", Component: Download },
      { label: "Filters", Component: Filters },
      { label: "Streamed text", Component: Streaming },
    ],
  },
  {
    title: "Layout",
    demos: [
      { label: "Resize", Component: ExampleResize },
      { label: "Reorder list", Component: ReorderList },
    ],
  },
  {
    title: "Control",
    demos: [
      { label: "Spring", Component: Spring },
      { label: "Debug boxes", Component: DebugBoxes },
    ],
  },
  {
    title: "Gestures",
    demos: [
      { label: "Hold to confirm", Component: HoldToConfirm },
      { label: "Rating slider", Component: RatingSlider },
      { label: "Trailing tag", Component: TrailingTag },
      { label: "Bubble slider", Component: BubbleSlider },
      { label: "Range shove", Component: RangeShove },
      {
        label: "Spin dial spring",
        Component: () => (
          <SpinDial
            duration={900}
            ease={{
              stiffness: 150,
              damping: 19,
              mass: 1.2,
            }}
          />
        ),
      },
      { label: "Pull to count", Component: PullToCount },
    ],
  },
  {
    title: "Matter",
    demos: [
      { label: "Squishy number", Component: SquishyNumber },
      { label: "Squeeze to abbreviate", Component: SqueezeToAbbreviate },
      { label: "Split bar", Component: SplitBar },
      { label: "Slosh gauge", Component: SloshGauge },
    ],
  },
];
