// Coverage for src/api/gameStory.js's pure helpers: pulling an mlb.com
// article slug back out of the RSS-derived story URL, and building a
// card-sized photo crop from the content API's Cloudinary-style template.
// Fixtures are real shapes verified live 2026-08-21 against gamePk 823035
// and dapi.mlbinfra.com/v2/content/en-us/stories/{slug}.
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildStoryPhotoUrl, slugFromStoryUrl } from '../src/api/gameStory.js'

test('slugFromStoryUrl pulls the slug out of a normalized mlb.com/news URL', () => {
  assert.equal(
    slugFromStoryUrl('https://www.mlb.com/news/luis-lara-brewers-prospect-call-up'),
    'luis-lara-brewers-prospect-call-up',
  )
})

test('slugFromStoryUrl returns null for a non-news URL or missing input', () => {
  assert.equal(slugFromStoryUrl('https://www.mlb.com/brewers'), null)
  assert.equal(slugFromStoryUrl(undefined), null)
  assert.equal(slugFromStoryUrl(''), null)
})

test('buildStoryPhotoUrl fills the {formatInstructions} placeholder at the requested size', () => {
  const thumbnail = {
    templateUrl:
      'https://img.mlbstatic.com/mlb-images/image/upload/{formatInstructions}/mlb/narkwy27usqjdnlnjkfk',
  }
  assert.equal(
    buildStoryPhotoUrl(thumbnail),
    'https://img.mlbstatic.com/mlb-images/image/upload/w_640,h_360,c_fill,g_auto,q_auto,f_jpg/mlb/narkwy27usqjdnlnjkfk',
  )
  assert.equal(
    buildStoryPhotoUrl(thumbnail, { width: 200, height: 200 }),
    'https://img.mlbstatic.com/mlb-images/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_jpg/mlb/narkwy27usqjdnlnjkfk',
  )
})

test('buildStoryPhotoUrl returns null with no thumbnail or template', () => {
  assert.equal(buildStoryPhotoUrl(null), null)
  assert.equal(buildStoryPhotoUrl({}), null)
})
