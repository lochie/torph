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
  Greetings,
  HexColour,
  HoldToConfirm,
  Install,
  NumbersOff,
  NumoraField,
  PullToCount,
  RangeShove,
  RatingSlider,
  RelativeTime,
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
  label?: React.ReactNode;
  Component: ComponentType;
};

/** Hand-ordered: each section opens with the plainest use of what it covers. */
export const DEMOS: Demo[] = [
  { Component: Install },
  { Component: BubbleSlider },
  { Component: RangeShove },
  {
    Component: () => (
      <SpinDial
        ease={{
          stiffness: 150,
          damping: 19,
          mass: 1.2,
        }}
      />
    ),
  },
  {
    label: (
      <>
        <a
          href="https://numeric-input.com/docs/numora/integrations/torph/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Numora
        </a>{" "}
        input
      </>
    ),
    Component: NumoraField,
  },
  { Component: Streaming },
  { Component: ExampleCopy },
  { Component: HexColour },
  { Component: Wallet },
  { Component: Delta },
  { Component: Earned },
  { Component: Filters },
  { Component: Greetings },
  { Component: RelativeTime },
  { Component: Versions },
  { Component: HoldToConfirm },
  { Component: Units },
  { Component: CurrencySwap },
  { Component: ExampleAction },
  { Component: Dimensions },
  { Component: ResultsSummary },

  { Component: ExampleRewrite },
  { Component: ExampleTicker },
  { Component: ExampleChart },
  { Component: Download },
  { Component: ReorderList },
  { Component: PullToCount },
  { Component: RatingSlider },
  { Component: SplitBar },

  { Component: ExampleResize },
  { Component: SquishyNumber },
  { Component: SqueezeToAbbreviate },

  { Component: SloshGauge },
  { Component: ExampleNumber },
  { Component: TrailingTag },
];
