import { Children } from 'react'
import '../../styles/worldseries/flow.css'

// BALANCED COLUMNS: the cards laid down as many columns of at least 340px as fit, each at its own
// height (styles/worldseries/flow.css). Pass the cards as children; each rides in an item. A child
// that is false or null is skipped here, and one that renders nothing leaves an empty item the CSS
// does not draw.
export function Flow({ children }) {
  return (
    <div className="ww-flow">
      {Children.toArray(children).map((child) => (
        <div key={child.key} className="ww-flow__item">
          {child}
        </div>
      ))}
    </div>
  )
}
