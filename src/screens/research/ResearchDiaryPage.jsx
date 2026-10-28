import { DiaryPage } from './DiaryPage.jsx'
import * as diary from '../../lib/research/diary/index.js'

// The prospect-research diary (route: /admin/research, admin only, linked from
// the footer). Everything the minor-league development spikes have found, in
// one place, newest first — including the parts that were later taken back.
// The page itself, and why it looks the way it does, is DiaryPage.jsx.
export function ResearchDiaryPage() {
  return (
    <DiaryPage
      diary={diary}
      title="Research diary"
      heading="What we know about prospects"
      name="the research diary"
      Name="The research diary"
    />
  )
}
