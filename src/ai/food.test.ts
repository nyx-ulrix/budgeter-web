/// <reference types="node" />
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readHit, scaleMacros } from './food'

test('reads a USDA result per 100 g and scales it to the grams eaten', () => {
  const h = readHit({
    description: 'WHEY PROTEIN ISOLATE', brandOwner: 'Acme', servingSize: 30, servingSizeUnit: 'g',
    foodNutrients: [
      { nutrientId: 1062, unitName: 'kJ', value: 1500 }, { nutrientId: 1008, unitName: 'KCAL', value: 370 },
      { nutrientId: 1003, unitName: 'G', value: 80 }, { nutrientId: 1093, unitName: 'MG', value: 500 },
    ],
  })!
  assert.equal(h.name, 'Whey protein isolate · Acme')
  assert.deepEqual(h.per100, { calories: 370, protein: 80, sodium: 500 })
  assert.equal(h.serving, 30)
  assert.deepEqual(scaleMacros(h.per100, 30), { calories: 111, protein: 24, sodium: 150 })
  assert.equal(readHit({ description: 'Water', foodNutrients: [] }), null)
})
