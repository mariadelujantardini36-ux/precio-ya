/**
 * Paleta de colores por supermercado. No hace falta tocar este archivo al
 * agregar un supermercado nuevo — alcanza con elegir un "color" (de esta
 * misma lista de nombres) en stores.config.ts.
 */
export interface StoreColorClasses {
  dot: string;
  badgeActive: string;
  thBg: string;
}

const PALETTE: Record<string, StoreColorClasses> = {
  emerald: { dot: "bg-emerald-400", badgeActive: "bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-500/30", thBg: "bg-emerald-50/50 text-emerald-850" },
  sky: { dot: "bg-sky-400", badgeActive: "bg-sky-600 text-white border-sky-500 ring-2 ring-sky-500/30", thBg: "bg-sky-50/50 text-sky-850" },
  amber: { dot: "bg-amber-400", badgeActive: "bg-amber-600 text-white border-amber-500 ring-2 ring-amber-500/30", thBg: "bg-amber-50/50 text-amber-850" },
  rose: { dot: "bg-rose-400", badgeActive: "bg-rose-600 text-white border-rose-500 ring-2 ring-rose-500/30", thBg: "bg-rose-50/50 text-rose-850" },
  violet: { dot: "bg-violet-400", badgeActive: "bg-violet-600 text-white border-violet-500 ring-2 ring-violet-500/30", thBg: "bg-violet-50/50 text-violet-850" },
  cyan: { dot: "bg-cyan-400", badgeActive: "bg-cyan-600 text-white border-cyan-500 ring-2 ring-cyan-500/30", thBg: "bg-cyan-50/50 text-cyan-850" },
  lime: { dot: "bg-lime-400", badgeActive: "bg-lime-600 text-white border-lime-500 ring-2 ring-lime-500/30", thBg: "bg-lime-50/50 text-lime-850" },
  fuchsia: { dot: "bg-fuchsia-400", badgeActive: "bg-fuchsia-600 text-white border-fuchsia-500 ring-2 ring-fuchsia-500/30", thBg: "bg-fuchsia-50/50 text-fuchsia-850" },
  orange: { dot: "bg-orange-400", badgeActive: "bg-orange-600 text-white border-orange-500 ring-2 ring-orange-500/30", thBg: "bg-orange-50/50 text-orange-850" },
  teal: { dot: "bg-teal-400", badgeActive: "bg-teal-600 text-white border-teal-500 ring-2 ring-teal-500/30", thBg: "bg-teal-50/50 text-teal-850" },
  indigo: { dot: "bg-indigo-400", badgeActive: "bg-indigo-600 text-white border-indigo-500 ring-2 ring-indigo-500/30", thBg: "bg-indigo-50/50 text-indigo-850" },
  pink: { dot: "bg-pink-400", badgeActive: "bg-pink-600 text-white border-pink-500 ring-2 ring-pink-500/30", thBg: "bg-pink-50/50 text-pink-850" },
  yellow: { dot: "bg-yellow-400", badgeActive: "bg-yellow-600 text-white border-yellow-500 ring-2 ring-yellow-500/30", thBg: "bg-yellow-50/50 text-yellow-850" },
  blue: { dot: "bg-blue-400", badgeActive: "bg-blue-600 text-white border-blue-500 ring-2 ring-blue-500/30", thBg: "bg-blue-50/50 text-blue-850" },
  red: { dot: "bg-red-400", badgeActive: "bg-red-600 text-white border-red-500 ring-2 ring-red-500/30", thBg: "bg-red-50/50 text-red-850" },
};

const DEFAULT_COLOR = PALETTE.emerald;

export function getStoreColor(colorName: string): StoreColorClasses {
  return PALETTE[colorName] || DEFAULT_COLOR;
}
