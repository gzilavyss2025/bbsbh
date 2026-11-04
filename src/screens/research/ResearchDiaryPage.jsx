import { DiaryPage } from './DiaryPage.jsx'
import * as diary from '../../lib/research/diary/index.js'

// The prospect-research diary (route: /admin/research, admin only, linked from the footer):
// everything the minor-league development spikes found, newest first, retractions included.
export const ResearchDiaryPage = () => (
  <DiaryPage diary={diary} title="Research diary" heading="What we know about prospects" name="the research diary" Name="The research diary" />
)
