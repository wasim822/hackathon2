# Neon Brand City

A cyberpunk brand-city arcade driving game built with Three.js and Vite. This is an unofficial fan/hackathon project and is not affiliated with or endorsed by any company shown.

## Run

```
npm install
npm run dev        # open http://localhost:5173 and click START DRIVING
npm run build      # production build in dist/
npm run test:physics   # headless handling tests
```

## Controls

| Key | Action |
|---|---|
| W / S | Accelerate / brake, then reverse |
| A / D | Steer |
| Space | Handbrake / drift |
| C | Cycle camera (chase, far chase, hood) |
| V | Look back (also automatic when reversing) |
| R | Reset car onto the nearest road |
| Mouse | Look around (click to lock the pointer) |
| M / N / F / Q / H | Map / mute / stats / quality / help |

Gamepad: left stick steers, RT throttle, LT brake, A handbrake, Y camera, B reset.

If you crash into a company building, a Yes/No prompt appears. A site opens in a new tab only when you click Yes.

## Architecture (`src/`)

- `main.js`: game loop with fixed 120 Hz physics (capped catch-up) and interpolated rendering. Also handles brand-contact prompts, adaptive quality and actions.
- `config/`: map grid, ramps and spawn (`map.js`); the brand and district data table with URLs (`brands.js`); vehicle tuning (`vehicles.js`).
- `world/`: city generation (`city.js`), building archetypes (`buildings.js`), per-company themed buildings and plazas (`brandThemes.js`, one entry per brand: iconic structure, brand-coloured plaza floor, props and collision bounds), merged geometry batching (`batcher.js`), height field for curbs and ramps (`terrain.js`), static colliders with a broadphase grid (`colliders.js`), procedural textures, materials, sky, bloom.
- `vehicle/`: bicycle-model tire physics (`carPhysics.js`), visual suspension model, smoke/sparks/skid marks, reset spot finder.
- `camera/`, `input/`, `ui/` (HUD, minimap, website modal), `audio/` (synthesized engine).

## Vehicle tuning (`src/config/vehicles.js`)

Each vehicle sets its own mass, drive force, top speed, brake and handbrake force, drag, front/rear grip, cornering stiffness, steering range and falloff, and the arcade assists. The Neon GT does 0–100 km/h in about 4 s, tops out around 217 km/h, and brakes from 100 km/h to 0 in about 33 m.

## Deferred (hackathon time)

- No AI traffic or pedestrians.
- Elevated sections are solid "skyway" humps, not multi-level overpasses.
- Buildings are stylised primitives with text signs, not real logos.
- No shadows, to protect frame rate.
