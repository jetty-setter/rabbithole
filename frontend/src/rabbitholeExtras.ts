/** Page-specific visual-evidence modules, keyed by RabbitHole slug. These are
 *  presentational only -- not part of the RabbitHoleDetail API shape, not
 *  stored in the content schema, and never touch a citation or credibility
 *  state. Component shapes (SignalSpecimen, BeamExplainer) are generic and
 *  reusable; only the data here is specific to one article. A RabbitHole
 *  with no entry simply renders the plain generic reader. */

export interface SignalCharacterSpec {
  char: string;
  intensityLabel: string;
  /** Relative magnitude used to size the bar -- not a display value. */
  value: number;
}

export interface SnapshotField {
  label: string;
  value: string;
}

export interface SignalSpecimenSpec {
  characters: SignalCharacterSpec[];
  sampleSeconds: number;
  totalSeconds: number;
  /** The handful of facts that belong beside the reading itself, not a
   *  seven-field dashboard. */
  primaryFacts: SnapshotField[];
  note: string;
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
        { char: "6", intensityLabel: "≈6–7×", value: 6.5 },
        { char: "E", intensityLabel: "≈14–15×", value: 14.5 },
        { char: "Q", intensityLabel: "≈26–27×", value: 26.5 },
        { char: "U", intensityLabel: "≈30–31×", value: 30.5 },
        { char: "J", intensityLabel: "≈19–20×", value: 19.5 },
        { char: "5", intensityLabel: "≈5–6×", value: 5.5 },
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
    },
    beamExplainer: {
      title: "It should have appeared twice",
      description:
        "Big Ear read the sky through two feed horns aimed at slightly different points. A genuine fixed source drifting through should have crossed both.",
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
