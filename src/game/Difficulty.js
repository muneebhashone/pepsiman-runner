import { PLAYER, SPAWN } from "./constants.js";

export function difficultyAtSpeed(speed) {
  return Math.max(
    0,
    Math.min(
      1,
      (speed - PLAYER.runSpeedBase) / (PLAYER.runSpeedMax - PLAYER.runSpeedBase),
    ),
  );
}

// Keep spacing in seconds: even at top speed, two lane changes and a fresh
// jump/slide fit between rows. Difficulty increases through choices as well as pace.
export function patternGap(speed, rng = Math.random) {
  const difficulty = difficultyAtSpeed(speed);
  const seconds =
    SPAWN.rowSecondsStart +
    (SPAWN.rowSecondsMin - SPAWN.rowSecondsStart) * difficulty;
  return speed * (seconds + rng() * SPAWN.rowSecondsJitter);
}

const INTRO = ["gate", "mover", "jump", "gate", "slide", "ramp"];

/** Each row has a guaranteed route; moving traffic never crosses that route. */
export class ChallengeDirector {
  constructor() {
    this.reset();
  }

  reset() {
    this.index = 0;
    this.routeLane = 1;
    this.lastKind = null;
    this.lastVerb = "slide";
    this.rowsSinceTurn = 0;
  }

  next(speed, rng = Math.random) {
    const difficulty = difficultyAtSpeed(speed);
    let kind = INTRO[this.index];
    if (!kind) {
      const roll = rng();
      if (this.rowsSinceTurn >= 2) kind = "gate";
      else if (roll < 0.3 + difficulty * 0.25) kind = "mixed";
      else if (roll < 0.78) kind = this.lastVerb === "jump" ? "slide" : "jump";
      else if (roll < 0.9) kind = "gate";
      else kind = this.lastKind === "mover" ? "gate" : "mover";
    }

    let route = this.routeLane;
    let action = "run";
    const hazards = [];
    if (kind === "gate" || kind === "mixed") {
      // Adjacent routes prevent an unfair left-edge to right-edge reversal.
      route = route === 1 ? (rng() < 0.5 ? 0 : 2) : 1;
      for (let lane = 0; lane < 3; lane++) {
        if (lane !== route) {
          hazards.push({ lane, type: rng() < 0.5 ? "truck" : "pepsiWide" });
        }
      }
      if (kind === "mixed") {
        action = this.lastVerb === "jump" ? "slide" : "jump";
        hazards.push({
          lane: route,
          type: action === "slide" ? "rail" : "barrier",
        });
      }
    } else if (kind === "jump" || kind === "slide") {
      action = kind;
      const type = kind === "slide"
        ? "rail"
        : ["barrier", "sign", "barrel"][Math.floor(rng() * 3)];
      for (let lane = 0; lane < 3; lane++) hazards.push({ lane, type });
    } else if (kind === "mover") {
      if (route === 1) route = rng() < 0.5 ? 0 : 2;
      hazards.push({ type: "mover", lane: route === 0 ? 2 : 0, endLane: 1 });
    } else {
      hazards.push({ type: "ramp", lane: route });
    }

    this.rowsSinceTurn = route === this.routeLane ? this.rowsSinceTurn + 1 : 0;
    this.routeLane = route;
    this.lastKind = kind;
    if (action !== "run") this.lastVerb = action;
    this.index++;
    return { kind, routeLane: route, action, hazards };
  }
}
