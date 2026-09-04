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
  NumoraField,
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
  label: React.ReactNode;
  Component: ComponentType;
};

/** Hand-ordered: each section opens with the plainest use of what it covers. */
export const DEMOS: Demo[] = [
  { label: "Install command", Component: Install },
  { label: "Bubble slider", Component: BubbleSlider },
  { label: "Range shove", Component: RangeShove },
  {
    label: "Spin dial spring",
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
  { label: "Streamed text", Component: Streaming },
  { label: "Copy button", Component: ExampleCopy },
  { label: "Hex colour", Component: HexColour },
  { label: "Wallet", Component: Wallet },
  { label: "Delta", Component: Delta },
  { label: "Accruing balance", Component: Earned },
  { label: "Filters", Component: Filters },
  { label: "Version tag", Component: Versions },
  { label: "Hold to confirm", Component: HoldToConfirm },
  { label: "Units", Component: Units },
  { label: "Currency swap", Component: CurrencySwap },
  { label: "Action button", Component: ExampleAction },
  { label: "Dimensions", Component: Dimensions },
  { label: "Results summary", Component: ResultsSummary },

  { label: "Rewrite", Component: ExampleRewrite },
  { label: "Ticker", Component: ExampleTicker },
  { label: "Chart readout", Component: ExampleChart },
  { label: "Download progress", Component: Download },
  { label: "Reorder list", Component: ReorderList },
  { label: "Pull to count", Component: PullToCount },
  { label: "Rating slider", Component: RatingSlider },
  { label: "Split bar", Component: SplitBar },

  { label: "Resize", Component: ExampleResize },
  { label: "Squishy number", Component: SquishyNumber },
  { label: "Squeeze to abbreviate", Component: SqueezeToAbbreviate },

  { label: "Slosh gauge", Component: SloshGauge },
  { label: "Reflowing paragraph", Component: ExampleNumber },
  { label: "Trailing tag", Component: TrailingTag },
];
