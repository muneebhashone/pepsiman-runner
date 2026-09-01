# Arcade Polish Checklist — Pepsiman Runner

Score against [AAA_CRITIC_RUBRIC.md](./AAA_CRITIC_RUBRIC.md) and [SUBWAY_SURFERS_JUICE_BRIEF.md](./SUBWAY_SURFERS_JUICE_BRIEF.md).

## FX / Juice

- [x] Run particle trail (Pepsi blue/red/cyan sparks behind feet)
- [x] Speed streaks — side rails + center rush lines at high speed
- [x] Pickup burst — radial sparks + expanding ring, scales with combo
- [x] Land dust — scaled puff count + ground ripple
- [x] Crash burst — additive spray + DOM hit-flash vignette
- [x] Additive blending on neon streaks for glossy pop

## UI / HUD

- [x] Pepsi blue → red gradient panels with glass blur
- [x] Score / Cans / Combo / Speed always visible
- [x] Combo “hot” state at ×3+ with glow
- [x] Combo pop animation on increment
- [x] Score pulse on can pickup
- [x] Speed bar with max-speed pulse
- [x] Start screen — tap anywhere / Space / button
- [x] Game Over — score, cans, best combo, retry
- [x] Pause overlay — button + Esc / P
- [x] Mobile-friendly compact stat layout

## Audio (procedural WebAudio)

- [x] Lane whoosh (bandpass saw + stereo pan)
- [x] Jump triangle blip
- [x] Slide noise scrape
- [x] Land sine thump + noise puff
- [x] Can sparkle arpeggio (combo pitch-up) + percussive pop
- [x] Crash filtered noise + descending saw
- [x] Game Over chord sting (separate from crash)
- [x] Start run sting on begin

## Renderer / Tech

- [x] ACES Filmic tone mapping (exposure 1.22)
- [x] DPR capped at 2 (`RENDER.maxPixelRatio`)
- [x] PCF soft shadows
- [x] Emissive neon world materials (World.js)
- [x] Fog depth balance (World.js)
- [x] No npm install — CDN ESM Three.js + GSAP

## Game Flow

- [x] Menu → playing gate (overlay blocks input)
- [x] Tap / click / Space / Enter to start
- [x] Pause / resume (button + Esc / P)
- [x] Clean restart — resets player, world, obstacles, collectibles, FX, HUD anims
- [x] Game over — crash SFX + game-over sting + retry

## Manual playtest

1. Open `index.html` via local HTTP server.
2. Tap Start — hear start sting, HUD undims.
3. Lane switch — whoosh + FOV punch + trail.
4. Jump / land — blip + thump + dust + camera shake.
5. Collect cans — sparkle arpeggio, combo pop, score pulse, burst VFX.
6. Hit obstacle — crash spray, red flash, game over overlay.
7. Pause mid-run, resume, retry — all states clean.

## Rubric self-score (target ≥ 4.0 avg)

| Axis | Score | Notes |
|------|-------|-------|
| Instant readability | 4 | Telegraph + silhouettes from slice |
| Input latency & weight | 4 | Lane overshoot, squash, audio layers |
| Pacing & difficulty | 4 | Soft speed ramp, recovery gaps |
| Reward loop | 5 | Combo pop + sparkle + burst stack |
| Visual direction | 4 | Pepsi palette, neon city, glossy HUD |
| Technical polish | 4 | ACES, DPR cap, stable loop |
| Juice density | 5 | Every verb has anim + cam + audio + particles |

**Weighted average: ~4.3** — arcade-ready vertical slice.
