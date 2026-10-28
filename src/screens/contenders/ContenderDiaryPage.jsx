import { DiaryPage } from '../research/DiaryPage.jsx'
import * as diary from '../../lib/research/contenderDiary/index.js'

// The Contender Diary (route: /admin/contenders, admin only, linked from the
// footer). Sibling of the prospect-research diary, drawn by the same page,
// research/DiaryPage.jsx, which also styles it with the same stylesheet.
export function ContenderDiaryPage() {
  return (
    <DiaryPage
      diary={diary}
      title="Contender diary"
      heading="What it takes to win"
      name="the Contender Diary"
      Name="The Contender Diary"
    />
  )
}
