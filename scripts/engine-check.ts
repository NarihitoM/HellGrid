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
import { Sfx } from '../src/features/game/engine/audio.ts'
import type { InputFrame } from '../src/features/game/engine/input.ts'
import { castRay, createRayHit, FlowField, hasLineOfSight } from '../src/features/game/engine/nav.ts'
import { World } from '../src/features/game/engine/world.ts'

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

const world = new World(new Sfx())
world.squad = 3
world.reset()
assert.equal(world.allies.length, 3)
for (const [i, a] of world.allies.entries()) {
  assert.equal(tileAt(Math.floor(a.x), Math.floor(a.y)), 0, `${a.name} spawned inside a wall`)
  for (const b of world.allies.slice(i + 1)) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 0.5, 'allies overlap')
}

const idle: InputFrame = {
  forward: 0,
  strafe: 0,
  sprint: false,
  turn: 0,
  look: 0,
  fire: false,
  aim: false,
  aimPressed: false,
  reload: false,
  inspect: false,
  slot: null,
  cycle: 0,
}
let farthest = 0
for (let t = 0; t < 60 * 60; t++) {
  world.update(1 / 60, idle)
  for (const a of world.allies) {
    if (a.hp > 0) farthest = Math.max(farthest, Math.hypot(a.x - world.player.x, a.y - world.player.y))
  }
}
assert.ok(world.kills >= 4, `squad should clear wave 1 on its own, got ${world.kills} kills`)
assert.ok(world.wave >= 2, 'next wave should start after the squad clears wave 1')
assert.ok(farthest < 10, `allies should stay close to the player, strayed ${farthest.toFixed(1)}`)

world.squad = 0
world.reset()
assert.equal(world.allies.length, 0)
assert.deepEqual(world.hud().squad, [])

console.log('engine checks passed')
