# Memory Leak Test — 20 regeneraciones

Generado el 2026-08-05T17:27:06.348Z desde `scripts/memory-leak.mjs`.
URL: `http://127.0.0.1:8080/?debug=1&v=8`.

## Stats

| Métrica | Mín | Media | Máx |
| --- | ---: | ---: | ---: |
| Geometrías (Three.js) | 15 | 15.25 | 16 |
| Draw calls | 11 | 11.6 | 23 |
| Triángulos | 2164 | 2188.8 | 2330 |
| Texturas | 1 | 1 | 1 |
| `world.children` | 8 | 8 | 8 |

## Leak check

Comparación primera mitad vs segunda mitad del run, mirando el **máximo de geometrías** por mitad. Un drift > 30% es sospechoso.

| Métrica | Valor |
| --- | ---: |
| Geometrías pico — 1ª mitad | 15 |
| Geometrías pico — 2ª mitad | 16 |
| Drift absoluto | 1 |
| Drift relativo | 6.7% |
| Geometrías última ronda | 16 |

## Datos crudos

| Ronda | Geom. | Calls | Triángulos | Texturas | world | Phase |
| ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 0 | 15 | 11 | 2164 | 1 | 8 | playing |
| 1 | 15 | 11 | 2164 | 1 | 8 | playing |
| 2 | 15 | 11 | 2186 | 1 | 8 | playing |
| 3 | 15 | 11 | 2186 | 1 | 8 | playing |
| 4 | 15 | 11 | 2164 | 1 | 8 | playing |
| 5 | 15 | 11 | 2186 | 1 | 8 | playing |
| 6 | 15 | 11 | 2186 | 1 | 8 | playing |
| 7 | 15 | 11 | 2186 | 1 | 8 | playing |
| 8 | 15 | 11 | 2186 | 1 | 8 | playing |
| 9 | 15 | 11 | 2186 | 1 | 8 | playing |
| 10 | 15 | 11 | 2164 | 1 | 8 | playing |
| 11 | 15 | 11 | 2186 | 1 | 8 | playing |
| 12 | 15 | 11 | 2186 | 1 | 8 | playing |
| 13 | 15 | 11 | 2186 | 1 | 8 | playing |
| 14 | 15 | 11 | 2186 | 1 | 8 | playing |
| 15 | 16 | 23 | 2330 | 1 | 8 | playing |
| 16 | 16 | 11 | 2186 | 1 | 8 | playing |
| 17 | 16 | 11 | 2186 | 1 | 8 | playing |
| 18 | 16 | 11 | 2186 | 1 | 8 | playing |
| 19 | 16 | 11 | 2186 | 1 | 8 | playing |

## Veredicto

**PASS — geometrías estables; no se observa leak entre la primera y la segunda mitad.**

Console errors: 0. Page errors: 0.
