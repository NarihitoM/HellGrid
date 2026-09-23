# Hellgrid

A wave-based first person shooter that runs in the browser, built with React, TypeScript and a hand-written raycasting engine. There is no game engine or 3D library: every wall, sprite and weapon is drawn on a single canvas.

## Features

- Raycast 3D world with textured walls, floor and ceiling, distance fog, look up/down and muzzle-flash lighting
- CS:GO-style weapon viewmodel on the right with mouse sway, strafe lean, walk bob, recoil, sprint pose and weapon-switch animation
- Magazine-based ammo with reload animations (the magazine drops out) and a weapon inspect animation
- Aim down sights on every weapon, plus a sniper rifle with a 2.5x / 5x scope that can shoot through several enemies
- Four weapons unlocked as the waves progress: pistol, shotgun, rifle and sniper
- Three enemy types (melee grunt, ranged gunner, heavy brute) that path-find toward the player
- Health and ammo pickups, enemy loot drops, score and a saved best score
- Procedurally generated textures, sprites and sound effects, so there are no image or audio files
- Minimap, HUD, pause menu and adjustable mouse sensitivity

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Look |
| Left click / Space | Fire |
| Right click | Aim down sights / cycle sniper scope |
| R | Reload |
| F | Inspect weapon |
| Shift | Sprint |
| 1-4 / Mouse wheel | Switch weapon |
| Esc | Pause |

## Getting started

Requires Node.js 22.18 or newer.

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal and click **Deploy** to start. The game captures the mouse while you play; press Esc to release it.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with Oxlint |
| `npm run check` | Run the engine checks (map layout, raycasting, line of sight, enemy path-finding) |

## Project structure

```
src/
├── App.tsx
├── main.tsx
├── index.css
└── features/game/
    ├── components/      React UI: game page, HUD, menus, styles
    ├── engine/          Game loop, world simulation, renderer, input, audio, assets
    ├── types/           Shared game types
    └── index.ts
scripts/
└── engine-check.ts      Engine checks, run directly with Node
```

React only renders the HUD and menus. The game loop, simulation and canvas rendering all live in `engine/`, and the HUD re-renders only when something it shows actually changes.

## Tech stack

- React 19
- TypeScript (strict)
- Vite
- Canvas 2D and the Web Audio API

## Credits

- [NarihitoM](https://github.com/NarihitoM)
- Claude Opus 5.5 (co-author)
