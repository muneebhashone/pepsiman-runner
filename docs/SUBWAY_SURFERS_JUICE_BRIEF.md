# Subway Surfers Juice Brief — Pepsiman Runner

## Feel goals

Match the *readable chaos* of Subway Surfers: instant input response, exaggerated body language, constant forward pressure, and reward fireworks on every pickup.

## Motion juice checklist

| Beat | Target | Implementation |
|------|--------|----------------|
| Lane switch | 0.18–0.22s with overshoot + bank lean | `Player.tryLane` + lean damp + Camera FOV punch |
| Jump | ~0.45s sin arc, squash on takeoff | `PLAYER.jumpDuration` + GSAP scale |
| Land | Stretch recovery + camera shake + dust | `justLanded` → `CameraRig.landShake` + `FX.landDust` |
| Slide | ~0.5s flat squash, low hitbox | scale y→0.55, hit mode `slide` |
| Speed ramp | Soft accel to max | `accelPerSec` on `player.speed` |
| Pickup | Magnet suck + burst + combo pitch-up | Collectibles magnet + FX + Audio.pickup |
| Crash | Ragdoll tilt + noise thump + particle spray | `Player.kill` + `Audio.crash` + `FX.crashBurst` |

## Telegraphing

- Lane floor glow fades in as obstacles approach (`SPAWN.telegraphLead`).
- Obstacle silhouette vocabulary: orange barrier (block), low silver rail (slide), hanging red sign (jump), Pepsi truck (block).

## Camera

- Chase behind/above with exponential lag (`CAMERA.lag`).
- FOV rises with speed norm; short punch on lane / pickup.
- Micro shake on land only — never constant camera sickness.

## Audio (synth-only)

- Whoosh on lane, triangle jump blip, noise slide, sine land thump.
- Pickup arpeggio scales with combo.
- Crash = filtered noise + descending saw.

## HUD

- Always-on score / cans / combo / speed + speed bar.
- Glossy Pepsi blue→red panels; combo goes “hot” at x3+.
- Start + Game Over overlays gate input cleanly.

## Anti-goals

- No empty stub systems.
- No asset-pack dependency.
- No package-manager install required for play.
