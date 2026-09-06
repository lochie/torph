import type { ComponentType } from "react";

import {
  Breadcrumb,
  BubbleSlider,
  Checklist,
  Chips,
  CodeMorph,
  CurrencySwap,
  DebugBoxes,
  Deck,
  Delta,
  Dimensions,
  Download,
  Earned,
  Emphasis,
  ExampleAction,
  Expand,
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
  MarkdownField,
  NowPlaying,
  NumbersOff,
  OverBudget,
  NumoraField,
  Presence,
  PullToCount,
  RangeShove,
  Rating,
  Reflow,
  RatingSlider,
  ReorderList,
  ResultsSummary,
  Shortcut,
  SloshGauge,
  SpinDial,
  SplitBar,
  Spring,
  SqueezeToAbbreviate,
  SquishyNumber,
  Streaming,
  Toggle,
  TrailingTag,
  Units,
  Uploading,
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
  { Component: Versions },
  { Component: HoldToConfirm },
  { Component: Units },
  { Component: CurrencySwap },
  { Component: ExampleAction },
  { Component: Presence },
  { Component: Shortcut },
  { Component: Rating },
  { Component: Breadcrumb },
  { Component: Emphasis },
  { Component: CodeMorph },
  { Component: MarkdownField },
  { Component: OverBudget },
  { Component: Expand },
  { Component: Chips },
  { Component: Reflow },
  { Component: Checklist },
  { Component: Deck },
  { Component: NowPlaying },
  { Component: Uploading },
  { Component: Toggle },
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
