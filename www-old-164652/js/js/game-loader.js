let gameModulePromise = null;

export function loadGame() {
  if (!gameModulePromise) {
    gameModulePromise = import('./game.js').catch(error => {
      gameModulePromise = null;
      throw error;
    });
  }
  return gameModulePromise;
}
