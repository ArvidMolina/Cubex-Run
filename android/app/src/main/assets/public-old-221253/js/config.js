// ============================================================
// CONFIG — Portrait 9:16 (mobile-first)
// ============================================================
export const W = 540, H = 960;

export const cfg = {
  COLS: 11,
  ROWS: 13,
  PLAYER_SPEED: 5.0,
  ENEMY_SPEED: 2.5,            // bajado desde 3.0 para juego sin dash: 1 mecánica, simple y justo
  CAM_BASE_Y: 14,
  SLIME_SPAWN_DELAY_MS: 500,
  FADE_IN_S: 1.2,
  FOG_RADIUS: 3,
  ENEMY_REPATH_MS: 200,
  currentMode: 'normal',
};

// Curva de dificultad dinámica para los primeros niveles
export function getDifficultyParams(level) {
  if (level === 1) {
    return {
      spawnDelayMs: 2500,  // 2.5s de tiempo para entender y empezar a correr
      fadeInS: 2.0,        // slime aparece más gradualmente
      enemySpeed: 2.0,      // velocidad reducida para dar margen de maniobra
      extraCarveCount: 5,   // remueve 5 paredes internas para pasillos más abiertos
    };
  } else if (level === 2) {
    return {
      spawnDelayMs: 1800,  // 1.8s
      fadeInS: 1.6,
      enemySpeed: 2.2,
      extraCarveCount: 3,   // 3 paredes extra abiertas
    };
  } else if (level === 3) {
    return {
      spawnDelayMs: 1200,  // 1.2s
      fadeInS: 1.4,
      enemySpeed: 2.4,
      extraCarveCount: 1,   // 1 pared extra abierta
    };
  }
  // Nivel 4+ (Dificultad estándar y máxima tensión)
  return {
    spawnDelayMs: cfg.SLIME_SPAWN_DELAY_MS,
    fadeInS: cfg.FADE_IN_S,
    enemySpeed: cfg.ENEMY_SPEED,
    extraCarveCount: 0,
  };
}

