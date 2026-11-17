// The explorers' shared baseball copy (src/lib/explorers/copy.js): the rules every explorer
// card writes with, so they all sound like one beat writer.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { club, ord, lastName, past } from '../src/lib/explorers/copy.js'

test('ordinals, including the teens', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ord), [
    '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th',
  ])
})

test('a player by his last name, suffixes dropped', () => {
  assert.equal(lastName('Ronald Acuña Jr.'), 'Acuña')
  assert.equal(lastName('Ken Griffey Sr'), 'Griffey')
  assert.equal(lastName('Cal Ripken III'), 'Ripken')
  assert.equal(lastName(''), '')
})

test('a club in a sentence is its nickname', () => {
  assert.equal(club(111), 'Red Sox')
  assert.equal(club(145), 'White Sox')
})

test('a play told after the fact', () => {
  assert.equal(past('Peña triples'), 'Peña tripled')
  assert.equal(past('Smith lines out'), 'Smith lined out')
  assert.equal(past('Jones pops out'), 'Jones popped out')
  assert.equal(past('Lee reaches on an error'), 'Lee reached on an error')
  assert.equal(past('Diaz is hit by a pitch'), 'Diaz was hit by a pitch')
})
