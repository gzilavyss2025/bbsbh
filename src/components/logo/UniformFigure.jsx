
// Gameday's batter figure for tonight's uniform (#1852): the pants image under
// the jersey image, same canvas, in a box of fixed width and height so nothing
// shifts while they load. Static art
// (docs/uniforms-and-logos.md, "Batter figure images"). `crossOrigin` lets the
// service worker's CacheFirst rule store the response. `urls` is
// `batterFigureUrls`' result, which the caller has already checked for null.
// The box size lives in uniform-figure.css (.ufig).
export function UniformFigure({ urls, label, onError }) {
  const img = (src, alt) => (
    <img
      className="ufig__img"
      src={src}
      alt={alt}
      loading="lazy"
      crossOrigin="anonymous"
      onError={onError}
    />
  )
  return (
    <span className="ufig">
      {urls.pants && img(urls.pants, '')}
      {img(urls.jersey, label)}
    </span>
  )
}
