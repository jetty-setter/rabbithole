/** Page-specific interactive-evidence modules, keyed by RabbitHole slug.
 *  Presentational only -- not part of the RabbitHoleDetail API shape, not
 *  stored in the content schema, and never touches a citation or
 *  credibility state. Component shapes (SignalReplay, TwoFeedReplay) are
 *  generic and reusable; only the data here is specific to one article. A
 *  RabbitHole with no entry simply renders the plain generic reader. */

export interface SignalCharacterSpec {
  char: string;
  intensityLabel: string;
  /** Relative magnitude used to size the bar -- not a display value. */
  value: number;
  /** Plain-language read of this sample, shown when it's selected. */
  meaning: string;
}

export interface SnapshotField {
  label: string;
  value: string;
}

export interface HighlightRegion {
  /** Percentages of the image's natural width/height, so the box stays
   *  correctly positioned at every rendered size. */
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface SignalSpecimenSpec {
  characters: SignalCharacterSpec[];
  sampleSeconds: number;
  totalSeconds: number;
  /** The handful of facts that belong beside the reading itself, not a
   *  seven-field dashboard. */
  primaryFacts: SnapshotField[];
  note: string;
  /** Where the real 6EQUJ5 sequence sits in the archival crop, measured
   *  directly against Wow_Signal_Archive_Crop_Wide.webp (720x290) -- not a
   *  guess. Used to highlight the real artifact once the reader engages
   *  the replay. */
  highlightRegion: HighlightRegion;
}

export interface SignalPassSpec {
  label: string;
  timing?: string;
  detected: boolean;
  state: string;
}

export interface BeamExplainerSpec {
  title: string;
  description: string;
  conclusion: string;
  passes: SignalPassSpec[];
}

export interface RabbitHoleExtras {
  signalSpecimen?: SignalSpecimenSpec;
  beamExplainer?: BeamExplainerSpec;
}

export const RABBITHOLE_EXTRAS: Record<string, RabbitHoleExtras> = {
  "the-wow-signal": {
    signalSpecimen: {
      characters: [
        {
          char: "6",
          intensityLabel: "≈6–7×",
          value: 6.5,
          meaning: "Just above the noise floor — the reading begins.",
        },
        {
          char: "E",
          intensityLabel: "≈14–15×",
          value: 14.5,
          meaning: "Rising quickly as Big Ear's beam sweeps onto the source.",
        },
        {
          char: "Q",
          intensityLabel: "≈26–27×",
          value: 26.5,
          meaning: "Nearing the peak of the pattern.",
        },
        {
          char: "U",
          intensityLabel: "≈30–31×",
          value: 30.5,
          meaning: "The strongest reading — about 30 times the background level.",
        },
        {
          char: "J",
          intensityLabel: "≈19–20×",
          value: 19.5,
          meaning: "Falling as the beam moves past the source.",
        },
        {
          char: "5",
          intensityLabel: "≈5–6×",
          value: 5.5,
          meaning: "Back near the noise floor as the reading ends.",
        },
      ],
      sampleSeconds: 12,
      totalSeconds: 72,
      primaryFacts: [
        { label: "Frequency", value: "1420.4556 ± 0.005 MHz" },
        { label: "Date", value: "August 15, 1977" },
        { label: "Telescope", value: "Big Ear" },
        { label: "Repeated", value: "Never" },
      ],
      note: "Not a decoded message — Big Ear's own shorthand for six successive signal-strength readings, each roughly this many times the background level. Unexplained; likely astrophysical.",
      highlightRegion: { left: 12.8, top: 17.5, width: 7.5, height: 33.5 },
    },
    beamExplainer: {
      title: "It should have appeared twice",
      description:
        "Big Ear read the sky through two feed horns aimed at slightly different points. A genuine fixed source drifting through should have crossed both.",
      conclusion:
        "A fixed celestial source crossing Big Ear's observing pattern would normally be expected to appear in the other feed response as Earth rotated. But the Wow! Signal appeared only once.",
      passes: [
        { label: "First pass", detected: true, state: "Detected" },
        {
          label: "Second pass",
          timing: "2 min 52 sec later",
          detected: false,
          state: "Nothing detected",
        },
      ],
    },
  },
};
