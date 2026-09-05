# Pepsiman Runner

A complete, self-contained 3D arcade runner made with Three.js. Run through a sunlit coastal city, dodge delivery trucks, jump barriers, slide beneath gates, and collect cans to unleash Pepsi Rush.

## Play locally

Requires Node.js 18+.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite, usually http://localhost:5173. The game needs WebGL 2 and browser hardware acceleration. Dependencies are bundled locally; gameplay has no CDN, remote asset, account, or API requirements.

```sh
npm run build    # Static production files in dist/
npm run preview  # Serve the production build locally
npm test         # Syntax, game systems, spawning, and tutorial checks
```

Serve `dist/` from any static web host. Use an HTTP server rather than opening `index.html` as a file.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move left / right | ← / → or A / D | Swipe left / right, or touch buttons |
| Jump | ↑, W, or Space | Swipe up or ↑ button |
| Slide / dive from a jump | ↓ or S | Swipe down or ↓ button |
| Pause / resume | Esc or P | Pause button |
| Mute / unmute | M | Menu sound button or pause settings |
| Start / retry | Space or Enter | Run button |

## Game modes

- **Endless run:** three lives, increasing speed, and a personal score to beat.
- **90-second rush:** score as much as possible before time runs out; losing all three lives also ends the run.

Both modes save independent personal bests on the current device. A countdown prepares the player before starting or resuming. The game pauses when the tab becomes hidden or the window loses focus.

## Gameplay

- Collect lines of cans to grow a combo, up to ×12. Keep collecting before the combo expires.
- Fill the fizz meter through pickups, close calls, and missions. A six-second **Pepsi Rush** grants invincibility, a magnet across lanes, and double points.
- Three rotating missions award bonus points and fizz. Survival missions reset their unfinished progress on a hit.
- Collisions cost one life and grant a short recovery window. The first jump and slide lessons offer a forgiving retry.
- Trucks require a lane change. Low striped barriers and barrels can be jumped. Overhead striped gates require a slide. Ramps launch the runner.
- Each 600 metres advances through Pacific Coast, Downtown, and Sunset Strip lighting.

## Graphics and sound

The world uses textured buildings and shopfronts, palm fronds, beach views, billboards, street furniture, soft shadows, distance fog, and reflective image-based lighting. The chrome hero has articulated knees and elbows, a grounded running cycle, jumps, slides, and a menu pose. Cans and traffic are complete 3D models.

Textures and geometry are generated locally. City blocks are recycled, static geometry is batched by material, obstacle templates are reused, and collectibles use a fixed pool. Rendering resolution is capped for performance. Music and effects are synthesized with Web Audio after the first player interaction.

The UI supports visible keyboard focus, an instruction dialog, touch controls, audio preferences, reduced camera effects, fullscreen when supported, and responsive layouts. Preferences and scores remain on the device; storage failures do not prevent play.

## Project layout

- `src/game/Game.js` — game states, scoring, health, modes, and integration
- `src/game/Player.js`, `CameraRig.js`, `Input.js` — character, camera, and controls
- `src/game/World.js`, `Art.js`, `ObstacleArt.js` — procedural art and geometry batching
- `src/game/Obstacles.js`, `Collectibles.js` — obstacle patterns, collision, and pickups
- `src/game/Fizz.js`, `Missions.js` — boost and mission systems
- `src/game/Audio.js`, `FX.js`, `UI.js` — feedback, audio, menus, and HUD
- `scripts/` — automated regression checks

A fan-made arcade tribute; not affiliated with or endorsed by PepsiCo.
