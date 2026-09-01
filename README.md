# Pepsiman Runner

A playable Pepsiman-inspired **3D endless runner** (Subway Surfers-class juice) built with Three.js + GSAP from CDN. No install required.

## Open the game

Open this file in Chrome (`file://` works because all modules use absolute HTTPS CDN imports):

```
/workspace/pepsiman-runner/index.html
```

Or serve the folder with any static file server if you prefer.

## Controls

| Action        | Keyboard              | Mobile        |
|---------------|-----------------------|---------------|
| Lane left     | Left Arrow or A       | Swipe left    |
| Lane right    | Right Arrow or D      | Swipe right   |
| Jump          | Up Arrow, W, or Space | Swipe up      |
| Slide         | Down Arrow or S       | Swipe down    |

## Features

- 3-lane endless highway with neon city buildings + Pepsi billboards
- Procedural glossy Pepsiman (blue/red, swirl emblem, run bob, lean, squash/stretch)
- Obstacles: barriers, low rails (slide under), high signs (jump), trucks — lane telegraph glow
- Collectible Pepsi cans with bob, magnet suck, particle pop, combo scoring
- Chase camera with lag, FOV punch, land shake
- ACESFilmic tone mapping, shadows, fog, capped DPR
- WebAudio synth whooshes / pickups / thumps (no asset packs)
- Pepsi blue/red glossy HUD + start / game over overlays

## Project layout

```
index.html
src/main.js
src/styles.css
src/game/
  constants.js  Game.js  Input.js  CameraRig.js
  Player.js     World.js Obstacles.js Collectibles.js
  FX.js         Audio.js UI.js
docs/
  SUBWAY_SURFERS_JUICE_BRIEF.md
  AAA_CRITIC_RUBRIC.md
```

## CDN deps

- three@0.170.0 (jsDelivr ESM)
- gsap@3.12.5 (jsDelivr ESM)

CDN-first for `file://` play — skip any local package installs.
