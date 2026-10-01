// The win-probability chart's viewBox geometry, shared by WinProbChart and its
// band layer. No axis labels to clear room for, just a small inset. The readout
// sits above the <svg>, and lib/wpa/wpaBandColors.js's WPA_PLOT_SIZE repeats
// W and H. The bands run the full width, edge to edge with the card
// (.winprob__svg bleeds past the card's padding). Only the plays sit inside
// PAD_L/PAD_R, so a numbered marker or the cursor at the first or last play is
// not cut off; the line runs flat out to each edge.
export const W = 328
export const H = 220
const PAD_L = 8
const PAD_R = 8
const PAD_T = 5
const PAD_B = 5
export const PLOT_L = PAD_L
export const PLOT_R = W - PAD_R
export const PLOT_T = PAD_T
export const PLOT_B = H - PAD_B
export const PLOT_W = PLOT_R - PLOT_L
export const PLOT_H = PLOT_B - PLOT_T
