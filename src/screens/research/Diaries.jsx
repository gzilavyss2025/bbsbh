import { DiaryPage } from './DiaryPage.jsx'
import * as research from '../../lib/research/diary/index.js'
import * as contender from '../../lib/research/contenderDiary/index.js'

// The two admin diaries, as config for the one page, DiaryPage.jsx. Admin only, linked from the footer.
// /admin/research: everything the minor-league development spikes found, newest first, retractions
// included. /admin/contenders: the Contender Diary, "what it takes to win".
const diaryOf = (props) => function Diary() { return <DiaryPage {...props} /> }

export const ResearchDiaryPage = diaryOf({
  diary: research,
  title: 'Research diary',
  heading: 'What we know about prospects',
  name: 'the research diary',
  Name: 'The research diary',
})

export const ContenderDiaryPage = diaryOf({
  diary: contender,
  title: 'Contender diary',
  heading: 'What it takes to win',
  name: 'the Contender Diary',
  Name: 'The Contender Diary',
})
