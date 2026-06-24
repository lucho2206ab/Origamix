# Origamix
Juego de bloques estilo tetris

https://origamix.vercel.app/

<img width="1014" height="851" alt="image" src="https://github.com/user-attachments/assets/ee156271-abc1-45c0-bc88-9499e9e1da59" />

<img width="1035" height="842" alt="image" src="https://github.com/user-attachments/assets/ab023091-5375-46b9-966d-0320aee62ae3" />


Un puzzle game inspirado en Tetris, pero con piezas origami triangulares y un tablero en forma de cruz. Construido en TypeScript + Vite + HTML5 Canvas.

🎮 **Jugar:** 

---

## Concepto

A diferencia de Tetris, las piezas no caen desde arriba: **nacen en el centro del tablero** y el jugador elige hacia cuál de las 4 paredes enviarlas. El tablero tiene forma de cruz, con triángulos en lugar de cuadrados — cada pieza es un grupo de 2 a 6 triángulos conectados, dándole una estética tipo tangram/origami.

La mecánica diferencial: una línea no se completa llenando un solo brazo de la cruz, sino **atravesando todo el ancho o alto del tablero**, lo que obliga a coordinar piezas en zonas opuestas para cerrar una línea.

---

## Cómo jugar

| Acción | Teclado | Mobile |
|---|---|---|
| Rotar pieza | `Espacio` | Botón ↺ |
| Elegir pared / mover | `↑ ↓ ← →` | D-pad |
| Caída rápida | `S` | — |

**Flujo de una pieza:**
1. Nace en el centro, quieta
2. `Espacio` la rota las veces que necesites
3. La primera flecha que presiones decide la pared destino — ahí empieza a moverse sola hacia esa pared
4. Mientras viaja, las flechas perpendiculares la desplazan lateralmente para ajustar la posición
5. Al chocar con la pared o con otra pieza, se traba en su lugar

**Objetivo:** completar líneas para sumar puntaje. Subís de nivel cada 500 puntos, lo que aumenta la velocidad y la complejidad de las piezas. El juego termina si una pieza nueva no entra en el centro, o tras 3 minutos de inactividad.

---

## Stack técnico

- **TypeScript** (strict mode, sin `any`)
- **Vite** como bundler y dev server
- **HTML5 Canvas 2D API** — sin librerías de renderizado externas
- **PWA** — instalable en Android/iOS, con soporte táctil (D-pad virtual)

### Estructura del proyecto

```
src/
├─ main.ts       # Entry point, UI, game loop, controles táctiles
├─ game.ts       # Máquina de estados: spawn, movimiento, lock, líneas
├─ board.ts      # Grilla en cruz, zonas, gravedad, detección de líneas
├─ piece.ts      # Definición de piezas, rotación, triángulos
├─ renderer.ts   # Dibujo en canvas: tablero, piezas, UI, pantalla de título
├─ effects.ts    # Efectos visuales (flashes, partículas)
├─ score.ts      # Cálculo de puntaje, velocidad y nivel
├─ input.ts      # Manejo de teclado
└─ types.ts      # Interfaces compartidas
```

### Arquitectura del tablero

Grilla virtual de 20×20, dividida en 5 zonas:

```
                TOP
                 │
   LEFT  ──  CENTER  ──  RIGHT
                 │
              BOTTOM
```

Cada celda se subdivide en dos triángulos (`TL` y `BR`) por una diagonal que alterna en patrón de tablero de ajedrez según `(row + col) % 2`.

Una línea horizontal se completa cuando **LEFT + CENTER + RIGHT** llenan la fila completa. Una línea vertical, cuando **TOP + CENTER + BOTTOM** llenan la columna completa.

---

## Desarrollo local

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # build de producción
```

## Despliegue

Desplegado en [Vercel](https://vercel.com) con deploy automático desde la rama `main`. Las ramas `feature/*` generan preview deployments automáticos para testing.

---

## Roadmap

- [ ] Modo multijugador local
- [ ] Tabla de puntuaciones online
- [ ] Más tipos de piezas en niveles avanzados
- [ ] Soporte para gestos de swipe alternativos al D-pad
