// The picker map's zoom (#1526, SPEC §9.3). The map is a 975 x 610 canvas; a state's box
// `b = [x0, y0, x1, y1]` (from map/us.json) is scaled to fill `factor` of it and centred.
export const MAP_VIEW = [975, 610]
export const PICKER_ZOOM = 0.86
export const LOCATOR_ZOOM = 0.6 // a place page's locator shows the state smaller, with room around it

export function zoomTransform(box, factor = PICKER_ZOOM, view = MAP_VIEW) {
  if (!box) return { k: 1, tx: 0, ty: 0 }
  const [x0, y0, x1, y1] = box
  const w = Math.max(x1 - x0, 1)
  const h = Math.max(y1 - y0, 1)
  const k = Math.min(view[0] / w, view[1] / h) * factor
  return { k, tx: (view[0] - w * k) / 2 - x0 * k, ty: (view[1] - h * k) / 2 - y0 * k }
}

// The CSS transform for the zoom, in map units (a `<g>` inside the svg takes px as user units).
export function zoomCss(box, factor) {
  const { k, tx, ty } = zoomTransform(box, factor)
  return `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${k.toFixed(4)})`
}
