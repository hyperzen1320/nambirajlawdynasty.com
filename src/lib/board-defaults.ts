import type { BoardColor } from "@/models/Board";

// Default boards seeded for every advocate's office on first visit to
// Work Flow. Names match the requirements doc; colours are picked to play
// nicely against the Midnight Counsel theme.

export type BoardDefault = {
  title: string;
  description: string;
  color: BoardColor;
};

export const BOARD_DEFAULTS: BoardDefault[] = [
  {
    title: "New Suits & Petitions",
    description: "Fresh matters from intake to first listing.",
    color: "forest",
  },
  {
    title: "Notices",
    description: "Outbound and reply notices with deadlines.",
    color: "copper",
  },
  {
    title: "I.A.s / Petitions",
    description: "Interlocutory applications and miscellaneous petitions.",
    color: "sea",
  },
  {
    title: "C. A.s",
    description: "Criminal appeals and connected matters.",
    color: "terracotta",
  },
  {
    title: "BATTAs",
    description: "Witness summons, batta payments and procedure.",
    color: "ochre",
  },
  {
    title: "Follow-ups",
    description: "Pending replies, payments and client check-ins.",
    color: "plum",
  },
  {
    title: "Instructions",
    description: "Senior instructions and office handovers.",
    color: "ink",
  },
];

/**
 * Every colour a board may carry, in swatch order. This is the single
 * source: the mongoose enum reads it, both API routes validate against it,
 * and the pickers render it. Adding a colour is a one-line change here plus
 * a style entry below.
 */
export const BOARD_COLORS: BoardColor[] = [
  "forest",
  "copper",
  "sea",
  "terracotta",
  "ochre",
  "plum",
  "ink",
  "slate",
  "olive",
  "indigo",
];

// Gradient + accent colour pairs used by the UI. Stays in one place so the
// model and the renderer agree on what each colour means.
export const BOARD_COLOR_STYLES: Record<
  BoardColor,
  {
    gradient: [string, string];
    accent: string;
    text: string;
  }
> = {
  forest: {
    gradient: ["#3a5a40", "#588157"],
    accent: "#a3b18a",
    text: "#f4ede0",
  },
  copper: {
    gradient: ["#c5853a", "#8a5821"],
    accent: "#f5ebd6",
    text: "#2a1c08",
  },
  sea: {
    gradient: ["#56a0a8", "#1f4e54"],
    accent: "#d2e6e7",
    text: "#f4ede0",
  },
  terracotta: {
    gradient: ["#c14a37", "#8b3324"],
    accent: "#f6dccd",
    text: "#fff7ed",
  },
  ochre: {
    gradient: ["#d4a373", "#a0744a"],
    accent: "#fdf6e3",
    text: "#2a1c08",
  },
  plum: {
    gradient: ["#6b2737", "#3d1a25"],
    accent: "#e9d6dd",
    text: "#fff7ed",
  },
  ink: {
    gradient: ["#1a2444", "#0a1124"],
    accent: "#c5853a",
    text: "#f5ebd6",
  },
  slate: {
    gradient: ["#5a6b7a", "#2c3947"],
    accent: "#d8e2ea",
    text: "#f4ede0",
  },
  olive: {
    gradient: ["#7d8347", "#4a4f25"],
    accent: "#e8eac6",
    text: "#f4ede0",
  },
  indigo: {
    gradient: ["#544f92", "#2c2a55"],
    accent: "#dcd9f2",
    text: "#f4ede0",
  },
};
