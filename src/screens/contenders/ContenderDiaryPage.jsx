import { DiaryPage } from '../research/DiaryPage.jsx'
import * as diary from '../../lib/research/contenderDiary/index.js'

// The Contender Diary (route: /admin/contenders, admin only, linked from the footer), drawn by the
// same page and stylesheet as the prospect diary.
export const ContenderDiaryPage = () => (
  <DiaryPage diary={diary} title="Contender diary" heading="What it takes to win" name="the Contender Diary" Name="The Contender Diary" />
)
