// Blank module interface. Add your own drawing; this template draws nothing.
// Import core helpers from ../../../src/core/index.js when needed.
export const meta = {
  name: "Untitled", desc: "Editable blank effect", tags: [],
  size: [96, 96], origin: [48, 72], duration: 1, loop: false,
  options: { seed: 1, palette: ["#241015", "#b43d20", "#ffc477"], light: 1 },
};
export const events = { release: 0.2 };
export const authoring = { ending: "clear" };
export function draw(p, t, o) {
  // Art pixels: +x right, +y down; t is effect seconds.
  // Convert palette colors with fit()/hex() before passing them to Painter.
}
