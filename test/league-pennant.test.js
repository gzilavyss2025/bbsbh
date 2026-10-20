import test from 'node:test'
import assert from 'node:assert/strict'
import { pennantModel } from '../src/components/honors/pennantModel.js'
import { contrastRatio } from '../src/lib/contrast.js'

test('the season league is explicit, including the Brewers American League pennant', () => {
  const model = pennantModel({ teamId: 158, season: 1982, league: 'AL' })
  assert.equal(model.label, '1982 Milwaukee Brewers, American League champions')
  assert.match(model.logoUrl, /\/logos\/mono\/158\.svg\?v=/)
  assert.equal(pennantModel({ teamId: 158, season: 1982 }), null)
})

test('champion wording works before the championship series existed', () => {
  const model = pennantModel({ teamId: 147, season: 1927, league: 'AL' })
  assert.equal(model.leagueName, 'American')
  assert.doesNotMatch(model.label, /ALCS|World Series/)
})

test('incomplete records and seasons without a league pennant render nothing', () => {
  for (const season of [undefined, '', 0, 1982.5, 1994, NaN]) {
    assert.equal(pennantModel({ teamId: 158, season, league: 'AL' }), null)
  }
  assert.equal(pennantModel({ teamId: 147, season: 1900, league: 'AL' }), null)
  assert.equal(pennantModel({ teamId: 121, season: 1986, league: 'Central' }), null)
})

test('covered historical identities use the era name and abbreviation rather than a modern logo', () => {
  const model = pennantModel({ teamId: 119, season: 1955, league: 'NL' })
  assert.equal(model.name, 'Brooklyn Dodgers')
  assert.equal(model.abbreviation, 'BRO')
  assert.equal(model.logoUrl, null)
})

test('explicit period art, names and palette override identity defaults', () => {
  const model = pennantModel({
    teamId: 119, season: 1955, league: 'NL', teamName: 'Brooklyn Dodgers',
    clubLabel: 'BROOKLYN', abbreviation: 'B', logoUrl: '/approved-period-mark.svg',
    palette: { field: '#FFFFFF', border: '#005A9C', ink: '#005A9C', year: '#005A9C' },
  })
  assert.equal(model.logoUrl, '/approved-period-mark.svg')
  assert.equal(model.clubLabel, 'BROOKLYN')
  assert.equal(model.palette.field, '#FFFFFF')
  assert.equal(model.palette.year, '#005A9C')
})

test('a missing knockout has a named fallback and keeps ink readable', () => {
  const model = pennantModel({
    season: 1986, league: 'NL', teamName: 'New York Mets', abbreviation: 'NY', logoUrl: null,
    palette: { field: '#F1E7CC', ink: '#FFFFFF', year: '#F1E7CC' },
  })
  assert.equal(model.logoUrl, null)
  assert.equal(model.abbreviation, 'NY')
  assert.ok(contrastRatio(model.palette.field, model.palette.ink) >= 4.5)
  assert.ok(contrastRatio(model.palette.field, model.palette.year) >= 4.5)
})

test('mid-tone custom fields retain readable year and title ink', () => {
  for (const field of ['#777777', '#808080']) {
    const model = pennantModel({ teamId: 121, season: 1986, league: 'NL', palette: { field } })
    assert.ok(contrastRatio(field, model.palette.ink) >= 4.5)
    assert.ok(contrastRatio(field, model.palette.year) >= 4.5)
  }
})
