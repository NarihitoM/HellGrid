import assert from 'node:assert/strict'
import {
  MAP_H,
  MAP_LAYOUT,
  MAP_W,
  pickupSpots,
  playerStart,
  spawnPoints,
  tileAt,
} from '../src/features/game/engine/map.ts'
import { castRay, createRayHit, FlowField, hasLineOfSight } from '../src/features/game/engine/nav.ts'

for (const row of MAP_LAYOUT) assert.equal(row.length, MAP_W, `row "${row}" has wrong width`)

for (let x = 0; x < MAP_W; x++) {
  assert.ok(tileAt(x, 0) > 0 && tileAt(x, MAP_H - 1) > 0, 'map border must be solid')
}
for (let y = 0; y < MAP_H; y++) {
  assert.ok(tileAt(0, y) > 0 && tileAt(MAP_W - 1, y) > 0, 'map border must be solid')
}

assert.equal(spawnPoints.length, 6)
assert.ok(pickupSpots.length > 0)

const hit = castRay(1.5, 1.5, -1, 0, createRayHit())
assert.ok(Math.abs(hit.dist - 0.5) < 1e-9, 'ray should hit the west wall half a tile away')

const diagonal = castRay(1.5, 1.5, Math.SQRT1_2, Math.SQRT1_2, createRayHit())
assert.ok(diagonal.dist > 1 && Number.isFinite(diagonal.dist))

assert.ok(hasLineOfSight(1.5, 1.5, 5.5, 1.5))
assert.ok(!hasLineOfSight(9.5, 1.5, 11.5, 1.5), 'wall at column 10 blocks sight')

const flow = new FlowField()
flow.update(playerStart.x, playerStart.y)

for (let y = 0; y < MAP_H; y++) {
  for (let x = 0; x < MAP_W; x++) {
    if (tileAt(x, y) === 0) assert.ok(flow.dist[y * MAP_W + x] >= 0, `floor tile ${x},${y} is unreachable`)
  }
}

for (const spawn of spawnPoints) {
  const walker = { x: spawn.x, y: spawn.y }
  const target = { x: 0, y: 0 }
  let steps = 0
  while (flow.next(walker.x, walker.y, target)) {
    walker.x = target.x
    walker.y = target.y
    steps++
    assert.ok(steps < MAP_W * MAP_H, 'flow field must not loop')
  }
  assert.equal(Math.floor(walker.x), Math.floor(playerStart.x))
  assert.equal(Math.floor(walker.y), Math.floor(playerStart.y))
}

console.log('engine checks passed')
