import type { ComponentType } from "react";

import {
  AmountField,
  Announced,
  BubbleSlider,
  ClockFace,
  CurrencySwap,
  Dates,
  DebugBoxes,
  Delta,
  Dimensions,
  Disabled,
  Download,
  DragBreak,
  DragDigit,
  Earned,
  ElasticTabs,
  Emoji,
  Emptying,
  ExampleAction,
  ExampleChart,
  ExampleCopy,
  ExampleNumber,
  ExampleResize,
  ExampleResponsive,
  ExampleRewrite,
  ExampleTicker,
  Filters,
  FlickDigit,
  HexColour,
  HoldToConfirm,
  InlineCount,
  Interrupt,
  Install,
  JengaPull,
  Ledger,
  LetterBeads,
  Locales,
  Magnitude,
  NumbersOff,
  NumericGate,
  Ordinals,
  PiZoom,
  Pricing,
  PullToCount,
  PumpBlock,
  RangeShove,
  RatingSlider,
  Rename,
  ReorderList,
  ResultsSummary,
  Scripts,
  SloshGauge,
  SlotLever,
  SpinDial,
  SplitBar,
  SpreadInsert,
  Spring,
  SqueezeToAbbreviate,
  SquishyNumber,
  Streaming,
  TabularTable,
  TaffyWord,
  TearSentence,
  ThrowValue,
  TrailingTag,
  Units,
  Versions,
  Wallet,
  WheelPicker,
  WhipWord,
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
      { label: "Spin dial", Component: SpinDial },
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
