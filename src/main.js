import { Game } from './game/Game.js';

const canvas = document.getElementById('game-canvas');
if (!canvas) {
  throw new Error('Missing #game-canvas');
}

const game = new Game(canvas);

window.__pepsimanGame = game;

console.info('Pepsiman Runner ready — click Start Run');
