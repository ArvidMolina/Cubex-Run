# Bot Playtest — 30 partidas BFS-greedy

Generado el 2026-08-05T17:20:11.529Z desde `scripts/bot-playtest.mjs`.
URL: `http://127.0.0.1:8080/?debug=1&v=8`.
Estrategia: cada step, `bfsStep` hacia la salida + tecla de la dirección.
El bot NO esquiva al slime. Es el "best case" del jugador.

## Resumen

| Métrica | Valor |
| --- | ---: |
| Partidas | 30 |
| Wins | 13 |
| Losses | 17 |
| Otros (timeout/abort) | 0 |
| **Completion rate** | **43.3%** |

### Wins

| Métrica | N | Mín | Media | Mediana | Máx |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tiempo (ms) | 13 | 4560 | 4913.31 | 4582 | 6207 |
| Movimientos | 13 | 14 | 15 | 14 | 19 |

### Losses

| Métrica | N | Mín | Media | Mediana | Máx |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tiempo (ms) | 17 | 2608 | 4874.18 | 4888 | 6523 |
| Movimientos | 17 | 8 | 14.94 | 15 | 20 |

## Datos crudos

| Seed | Result | Moves | Tiempo (ms) |
| ---: | --- | ---: | ---: |
| 1 | win | 14 | 4778 |
| 2 | lose | 17 | 5541 |
| 3 | lose | 12 | 3923 |
| 4 | win | 14 | 4581 |
| 5 | win | 14 | 4590 |
| 6 | win | 14 | 4580 |
| 7 | win | 14 | 4560 |
| 8 | win | 16 | 5212 |
| 9 | lose | 16 | 5232 |
| 10 | lose | 14 | 4580 |
| 11 | lose | 14 | 4574 |
| 12 | lose | 15 | 4888 |
| 13 | lose | 14 | 4545 |
| 14 | lose | 19 | 6188 |
| 15 | win | 14 | 4562 |
| 16 | lose | 19 | 6201 |
| 17 | win | 19 | 6207 |
| 18 | lose | 11 | 3591 |
| 19 | lose | 8 | 2608 |
| 20 | lose | 13 | 4244 |
| 21 | win | 14 | 4582 |
| 22 | lose | 18 | 5883 |
| 23 | win | 14 | 4560 |
| 24 | lose | 12 | 3917 |
| 25 | win | 18 | 5868 |
| 26 | lose | 20 | 6523 |
| 27 | lose | 16 | 5214 |
| 28 | lose | 16 | 5209 |
| 29 | win | 16 | 5225 |
| 30 | win | 14 | 4568 |

Console errors: 0. Page errors: 0.
