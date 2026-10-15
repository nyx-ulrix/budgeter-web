/// <reference types="node" />
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gramsOf, readHits, scaleMacros } from './food'

test('reads AI look up matches per 100 g and scales them to the amount eaten', () => {
  const [h, plain] = readHits({ foods: [
    { name: 'Whey protein isolate', portion: '1 scoop', portion_grams: 30, per100g: { calories: 370, protein: 80, sodium: 500, fat: 'n/a' } },
    { name: 'Rice, white, cooked', per100g: { calories: 130 } },
    { name: 'No numbers', per100g: {} },
  ] })
  assert.equal(h.name, 'Whey protein isolate')
  assert.deepEqual(h.per100, { calories: 370, protein: 80, sodium: 500 })
  assert.deepEqual(h.portion, { grams: 30, label: '1 scoop (30 g)' })
  assert.equal(gramsOf(2, 'portion', h), 60)
  assert.equal(gramsOf(1, 'tbsp', h), 15)
  assert.equal(gramsOf(1, 'portion', plain), 100)       // no portion given: 100 g
  assert.deepEqual(scaleMacros(h.per100, 30), { calories: 111, protein: 24, sodium: 150 })
  assert.deepEqual(readHits({ nope: 1 }), [])
})
