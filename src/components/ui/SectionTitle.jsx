// The uppercase section header shared across the team page and the team-leaders
// page: a title on the left with an optional right-aligned `note` (e.g. "rank of
// 30") or `action` (e.g. a "See all ›" link). Styled by `.section__title` in
// src/index.css.
export function SectionTitle({ title, note, action }) {
  return (
    <h3 className="section__title">
      <span>{title}</span>
      {note && <em>{note}</em>}
      {action}
    </h3>
  )
}
