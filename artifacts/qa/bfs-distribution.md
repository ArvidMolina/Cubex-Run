# BFS Spawn Distance — 30 seeds

Generado el 2026-08-03T09:21:39.358Z desde `scripts/bfs-distribution.mjs`.
URL: `http://127.0.0.1:8080/?debug=1&v=6`.

## Stats

| Métrica | Valor |
| --- | ---: |
| N | 30 |
| Mín | 18 |
| p10 | 24 |
| Mediana | 33 |
| Media | 33.03 |
| p90 | 42 |
| Máx | 50 |
| Desv. estándar | 8.44 |

## Gate

Umbral de aceptación: BFS ≥ 7 (=`SLIME_MIN_BFS_DIST`). Por debajo se activa el fallback de delay.

| Condición | Cuenta | % |
| --- | ---: | ---: |
| BFS < 5 (slime casi encima) | 0 | 0.0% |
| BFS < 7 (necesita fallback) | 0 | 0.0% |
| BFS == 0 (patológico, slime en spawn del player) | 0 | 0.0% |
| BFS ≥ 7 (ideal) | 30 | 100.0% |

## Histograma

| BFS range | Bar | Count |
| --- | --- | ---: |
| 18 – 22 | ███ | 3 |
| 22 – 26 | █████ | 5 |
| 26 – 30 | ███ | 3 |
| 30 – 34 | █████ | 5 |
| 34 – 38 | ██ | 2 |
| 38 – 42 | ██████ | 6 |
| 42 – 46 | ████ | 4 |
| 46 – 50 | ██ | 2 |

## Datos crudos

| Seed | BFS | Celda (r, c) |
| ---: | ---: | --- |
| 1 | 42 | (11, 1) |
| 2 | 18 | (1, 7) |
| 3 | 24 | (9, 5) |
| 4 | 32 | (7, 3) |
| 5 | 36 | (1, 9) |
| 6 | 32 | (9, 1) |
| 7 | 24 | (5, 9) |
| 8 | 42 | (9, 3) |
| 9 | 33 | (8, 7) |
| 10 | 28 | (5, 9) |
| 11 | 28 | (7, 7) |
| 12 | 30 | (11, 1) |
| 13 | 26 | (7, 5) |
| 14 | 40 | (5, 9) |
| 15 | 40 | (5, 5) |
| 16 | 42 | (7, 5) |
| 17 | 46 | (11, 1) |
| 18 | 24 | (7, 7) |
| 19 | 18 | (1, 7) |
| 20 | 21 | (7, 8) |
| 21 | 38 | (7, 1) |
| 22 | 38 | (11, 1) |
| 23 | 50 | (9, 3) |
| 24 | 24 | (7, 7) |
| 25 | 40 | (3, 7) |
| 26 | 42 | (3, 9) |
| 27 | 25 | (9, 6) |
| 28 | 36 | (7, 3) |
| 29 | 40 | (5, 9) |
| 30 | 32 | (1, 9) |

## Veredicto

**PASS** — los 30 mazes generaron spawns con BFS ≥ 7. El fix de spawn no recae en el fallback de delay.
