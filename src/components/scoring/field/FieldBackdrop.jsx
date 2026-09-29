// Shared by the defense alignment and the player's innings-by-position chart.
// 90-foot square: 58 units per half-diagonal. Rubber: 60.5 feet from home;
// dirt arc: 95 feet from the rubber. The outfield is shortened for the card,
// and the bases are enlarged for legibility. Reference: MLB field diagram,
// https://img.mlbstatic.com/mlb-images/image/upload/mlb/atcjzj9j7wrgvsm8wnjq#page=169
export function FieldBackdrop({ className }) {
  return (
    <svg className={className} viewBox="0 0 340 255" aria-hidden="true" focusable="false">
      <path d="M170 218 21.51 69.51 A210 210 0 0 1 318.49 69.51Z" fill="var(--field-outfield)" />
      <path d="M21.51 69.51 A210 210 0 0 1 318.49 69.51" fill="none" stroke="var(--field-fence)" strokeWidth="2" />
      <path d="M170 224 86.2 140.2 A86.58 86.58 0 0 1 253.8 140.2Z" fill="var(--field-dirt)" />
      <path d="M170 110 220 160 170 210 120 160Z" fill="var(--field-infield)" />
      <circle cx="170" cy="218" r="11.85" fill="var(--field-dirt)" />
      <circle cx="170" cy="164.23" r="8.2" fill="var(--field-dirt)" />
      <path d="M21.51 69.51 170 218 318.49 69.51" fill="none" stroke="var(--field-chalk)" strokeWidth="1.4" />
      <path d="M108 156 112 152 116 156 112 160Z M166 102 170 98 174 102 170 106Z M224 156 228 152 232 156 228 160Z" fill="var(--field-chalk)" />
      <path d="M167 212h6v3l-3 3-3-3Z" fill="var(--field-chalk)" />
      <path d="M167 162.86h6" stroke="var(--field-chalk)" strokeWidth="1.5" />
      <path d="M160 210h4v7h-4Z M176 210h4v7h-4Z" fill="none" stroke="var(--field-chalk)" strokeWidth=".8" />
    </svg>
  )
}
