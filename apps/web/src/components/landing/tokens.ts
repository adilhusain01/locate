/// Diagram and ticket tokens, the same values as globals.css. Diagrams use at most two accent elements each.
export const T = {
  paper: "#f6f5f7",
  paper2: "#ffffff",
  ink: "#0e1530",
  muted: "#5f5a6b",
  soft: "#9a93a3",
  rule: "#e6dfe3",
  accent: "#e0313f",
  accentTint: "#ffe8e9",
  lend: "#0b8f69",
  lendTint: "#dff5ec",
  short: "#ea5a2a",
  shortTint: "#ffeadf",
  usdg: "#1f2a4d",
} as const;

/// Orthogonal connector, horizontal first, with a rounded elbow (r = 8).
export function hv(x1: number, y1: number, x2: number, y2: number, r = 8) {
  if (y1 === y2 || x1 === x2) return `M${x1} ${y1} L${x2} ${y2}`;
  const dx = Math.sign(x2 - x1);
  const dy = Math.sign(y2 - y1);
  return `M${x1} ${y1} L${x2 - dx * r} ${y1} Q${x2} ${y1} ${x2} ${y1 + dy * r} L${x2} ${y2}`;
}

/// Orthogonal connector, vertical first, with a rounded elbow (r = 8).
export function vh(x1: number, y1: number, x2: number, y2: number, r = 8) {
  if (y1 === y2 || x1 === x2) return `M${x1} ${y1} L${x2} ${y2}`;
  const dx = Math.sign(x2 - x1);
  const dy = Math.sign(y2 - y1);
  return `M${x1} ${y1} L${x1} ${y2 - dy * r} Q${x1} ${y2} ${x1 + dx * r} ${y2} L${x2} ${y2}`;
}

/// Horizontal, then vertical, then horizontal: for two nodes on different rows that need a clean entry.
export function hvh(x1: number, y1: number, x2: number, y2: number, xm: number, r = 8) {
  if (y1 === y2) return `M${x1} ${y1} L${x2} ${y2}`;
  const dy = Math.sign(y2 - y1);
  const d1 = Math.sign(xm - x1);
  const d2 = Math.sign(x2 - xm);
  return `M${x1} ${y1} L${xm - d1 * r} ${y1} Q${xm} ${y1} ${xm} ${y1 + dy * r} L${xm} ${y2 - dy * r} Q${xm} ${y2} ${xm + d2 * r} ${y2} L${x2} ${y2}`;
}

/// Vertical, then horizontal, then vertical: leaves a bottom edge, runs along y = ym, enters a top edge.
export function vhv(x1: number, y1: number, x2: number, y2: number, ym: number, r = 8) {
  if (x1 === x2) return `M${x1} ${y1} L${x2} ${y2}`;
  const dx = Math.sign(x2 - x1);
  const d1 = Math.sign(ym - y1);
  const d2 = Math.sign(y2 - ym);
  return `M${x1} ${y1} L${x1} ${ym - d1 * r} Q${x1} ${ym} ${x1 + dx * r} ${ym} L${x2 - dx * r} ${ym} Q${x2} ${ym} ${x2} ${ym + d2 * r} L${x2} ${y2}`;
}
