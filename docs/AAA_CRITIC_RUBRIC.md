# AAA Critic Rubric — Pepsiman Runner Vertical Slice

Score each axis 1–5. A shippable vertical slice targets **≥4 average**.

## 1. Instant readability (weight 1.2)

- Can a new player infer jump / slide / lane from silhouette + telegraph in <10s?
- Are fail states fair (player sees why they died)?

## 2. Input latency & weight (weight 1.3)

- Lane / jump / slide feel buffered but not mushy.
- Animation commits sell the move (lean, squash, whoosh).

## 3. Pacing & difficulty curve (weight 1.0)

- Speed ramp is perceptible but not cliff-like in the first 60s.
- Obstacle density leaves recovery windows; doubles appear as spice.

## 4. Reward loop (weight 1.1)

- Can pickup feedback (VFX + SFX + combo) is addictive.
- Score composition (distance + cans × combo) is understandable on HUD.

## 5. Visual direction (weight 1.0)

- Pepsiman brand colors read at a glance.
- Neon city + fog depth support speed fantasy without muddy contrast.

## 6. Technical polish (weight 1.0)

- Stable ~60fps on mid laptops; DPR capped.
- Shadows / ACES / fog present without washing the hero.
- file:// ES modules load via absolute CDN imports.

## 7. Juice density (weight 1.2)

- Every major verb has layered feedback (anim + cam + audio + particles).
- Silence / stillness never lasts more than a beat during a run.

## Pass criteria for this slice

- [x] All listed systems wired into `Game.update` / render loop
- [x] Keyboard + swipe
- [x] Start / retry overlays
- [x] No interpreter or package install required to open `index.html`
