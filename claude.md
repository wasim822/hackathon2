# Megabyte Hackathon — Cyberpunk Brand City Driving Game

## Your Role and Main Objective

You are an expert Three.js game developer. **Build a playable, polished, browser-based 3D driving game** inspired by the attached cyberpunk city reference image.

**Do not stop at a plan, mockup, or static scene. Implement and run the game in the browser.** Use whatever supporting libraries, packages, and development tools are useful, but **use Three.js for 3D rendering**. Prioritize a smooth, enjoyable driving experience and a city that is easy to navigate.

This is a hackathon project: deliver a working vertical slice first, then add polish without sacrificing frame rate.

## Visual Reference and Creative Direction

Use the **attached city image** as a reference for overall visual style and high-level composition, **not as an exact blueprint to copy**.

- Create an original cyberpunk metropolis at night with neon blue, purple, pink, and cyan lighting.
- Put a distinctive **Google-themed landmark in the center**, surrounded by a major roundabout or connected central road system.
- Organize the surrounding city into **six recognizable company districts** (the earlier reference image depicts five, but the company list below contains six; **implement all six**).
- Give each district its own architecture, colors, and mood: sleek technology towers, energetic social-media signs, playful entertainment landmarks, game-inspired buildings, commercial food streets, and professional insurance offices.
- Make roads **wide, readable, and driveable**. Include continuous streets surrounding each company building so players can drive around every building.
- Connect districts through a clear network of intersections, broad avenues, loops, and occasional elevated roads.
- Remove most decorative trees and clutter; prioritize vehicle navigation, building visibility, clear silhouettes, and performance.
- Add glossy/wet-looking pavement, emissive signage, neon highlights, headlights, and city glow, while avoiding excessive expensive lighting.
- Use recognizable company names on building signs. The districts should look distinct, **not like a literal recreation of the reference image**.

### City Layout Requirements

1. Central Google landmark with a navigable loop around it.
2. Six surrounding districts, connected by wide roads without loading screens when feasible.
3. **Each brand building must have accessible roads on all sides**; do not block entrances with disconnected decorative blocks.
4. City streets must support turning, braking, drifting, intersections, ramps, tunnels, and elevated sections where practical.
5. Add solid collision geometry to roadsides, buildings, barriers, curbs, and the perimeter.
6. Surround the entire map with a **continuous visible brick perimeter wall** that cannot be driven through, with no exits or gaps.
7. Add an **invisible collision barrier extending above the perimeter wall** so cars cannot jump or fly over it. This barrier should not obstruct the normal camera view.
8. Spawn the player on a road, facing a usable driving route, with enough room to accelerate immediately.

## Companies and Brands

Every company listed below should have an identifiable building or landmark, a readable sign, collision geometry, and an associated official website URL for the building interaction system.

### 1. Technology & Online Services

- Google — **central landmark**
- Amazon
- eBay
- Wikipedia
- National Geographic
- Kickstarter
- Spotify
- Cisco
- Apple

**Design:** Sleek glass towers, clean geometric forms, corporate blue/white accents, animated data-style lighting, minimalist roadsides.

### 2. Social Media & Communication

- YouTube
- Facebook
- Twitter / X
- Instagram
- Snapchat
- Pinterest
- Reddit

**Design:** Vibrant neon displays, giant screens, animated billboards, vivid pink/purple lights, visually expressive facades.

### 3. Disney & Entertainment Brands

- Disney
- Disneyland
- Pixar
- Marvel
- Lucasfilm (Star Wars)
- The Muppets

**Design:** Whimsical structures, colorful illuminated landmarks, stylized castle or entertainment silhouettes, playful details that remain efficient to render.

### 4. Video Games & Gaming Companies

- GameStop
- Steam
- Xbox
- EA Games
- Nintendo

**Design:** Arcade-inspired architecture, LED accents, game-controller motifs, lively green/red/blue lighting, fun bold facades.

### 5. Fast Food, Restaurants & Coffee

- McDonald's
- Burger King
- Wendy's
- Starbucks
- KFC

**Design:** Compact storefronts, colorful illuminated signs, drive-through-inspired roads, dense but navigable commercial blocks.

### 6. Insurance Companies

- Manulife
- Sun Life
- Intact Insurance

**Design:** Professional office towers, restrained green/yellow/blue brand accents, geometric glass and steel buildings.

**Implementation note:** Maintain a structured configuration/data table for all company buildings, including company name, district, position, dimensions, collision bounds, signage style, and official website URL. Verify official destinations rather than guessing uncertain links. The game is an unofficial fan/hackathon project and should not claim endorsement or affiliation with any of these brands.

## Core Gameplay: GTA V–Inspired Arcade Driving

**Goal:** Make the driving feel like a normal sports car in GTA V: smooth and fast, with believable vehicle weight, easy steering, controllable slides, and a cinematic third-person camera. **Do not fake it by simply translating a car forward and rotating its model left or right.** Use actual velocity, acceleration, momentum, tire traction, steering response, suspension, and collision handling.

### 1. Vehicle Movement

- **Acceleration:** Holding W progressively builds speed; engine power and vehicle configuration influence acceleration.
- **Braking:** S slows the moving vehicle smoothly and more strongly than engine acceleration.
- **Reverse:** After the car slows to a stop, continuing to hold S engages reverse, without abrupt direction changes.
- **Steering:** A/D turn the wheels; sharp and responsive at low speed, progressively reduced steering sensitivity at high speed.
- **Momentum:** Releasing W allows the vehicle to coast and gradually slow from rolling resistance and aerodynamic drag.
- **Weight:** No instantaneous stops, direction changes, or spins.
- **Differences between cars:** Support per-vehicle acceleration, top speed, mass, grip, braking, turning radius, and drag values, even if only one main sports car is initially playable.

### 2. Steering and Handling

- Smoothly interpolate steering input, rather than snapping steering angle.
- Automatically return steering toward center when A/D are released.
- Make tight low-speed turns easy and high-speed steering stable.
- Simulate lateral tire grip and speed-dependent understeer/slip.
- Allow hard high-speed cornering to reduce grip or initiate a slight slide.
- Add visual body roll during turns, nose dive under braking, and rear squat under hard acceleration.
- Car control should remain approachable and predictable, not floaty or ice-like.

### 3. Handbrake and Drifting

- **Space** activates the handbrake.
- When engaged, reduce rear-wheel lateral grip and permit controlled sideways sliding while preserving forward momentum.
- Enable countersteering to hold or correct a drift.
- Restore traction progressively after Space is released.
- Emit inexpensive tire smoke during heavy slides and leave short-lived skid marks on the pavement.
- Make drifting fun and responsive rather than chaotic.

### 4. Physics, Collisions, and Terrain

- Use a fixed-timestep simulation independent of rendering frame rate.
- Model engine force, braking, velocity, yaw rotation, tire lateral grip, momentum, and drag.
- Use an appropriate physics library if helpful (for example, Rapier or cannon-es), or a robust custom arcade vehicle controller integrated with reliable collision detection.
- Use a stable vehicle collision body and suspension or suspension-like contact handling.
- Support bumps, curbs, uneven road sections, ramps, airborne motion, and landings.
- Landing should visibly compress suspension and briefly impact handling.
- Crashes should reduce speed, push or deflect the car, and produce visible impact feedback.
- Keep the simulation stable; prevent vehicles from tunneling through walls or getting stuck in geometry.
- Include a reliable **R — Reset Vehicle** action that puts the car upright on a safe nearby road.

### 5. Cinematic Third-Person Camera

- Place the default camera behind and slightly above the vehicle.
- Smoothly chase vehicle position and heading; let it lag a little on turns before catching up.
- Look farther ahead and zoom out modestly at higher speed.
- Allow mouse movement to rotate the camera independently, with a smooth return to chase mode after user input stops.
- Provide a way to look backward while reversing.
- **C** cycles camera modes (for example: normal chase, wider chase, hood view).
- Prevent the camera from intersecting or clipping through buildings, barriers, or terrain.
- Avoid abrupt camera snapping and excessive shake.

### 6. Controls

| Input | Action |
|---|---|
| W | Accelerate |
| S | Brake / Reverse |
| A | Steer left |
| D | Steer right |
| Space | Handbrake / Drift |
| C | Change camera view |
| R | Reset / recover vehicle |
| Mouse | Look around independently |

Where practical, add gamepad support with analog steering, throttle, and braking. Prevent these keyboard inputs from scrolling the page during play.

### 7. Driving Experience Targets

- Easy to learn, rewarding to master.
- Fun to drive quickly through wide streets and around tight corners.
- Stable at higher speeds.
- Momentum and weight feel believable without realistic-simulator complexity.
- Braking, reversing, cornering, handbrake slides, and traction recovery are smooth.
- Car reacts visibly to collisions, jumps, and landings.
- Different cars can be tuned through exposed parameters without rewriting the controller.

## Building Website Interaction

When the player's car **collides with a company building**, offer to open that company's official website.

- Display an in-game modal with the company's name and the message: **“Visit [Company]'s official website?”**
- Provide **Yes** and **No** buttons.
- **Yes:** Open the official URL in a new browser tab using a direct user click. Use `noopener,noreferrer` where possible. Never navigate merely because the collision occurred.
- **No:** Close the modal and continue driving.
- Pause or suppress driving controls while the modal is visible so the car doesn't continue accelerating into the building.
- **Debounce interactions:** One collision should not repeatedly open the popup every frame. Only allow a new prompt for that building after the vehicle separates and collides again, or after an appropriate cooldown.
- Keep player position and game state intact when dismissing the modal.
- Ignore collisions with scenery that is not associated with a company website.

## Smooth Performance Is a Core Requirement

Build for a normal desktop browser and optimize for playable, stable frame rates **rather than excessive detail**.

- Aim for **60 FPS on a reasonably capable desktop**, degrade gracefully on less powerful machines, and avoid promising a fixed rate on all hardware.
- Favor reusable geometry, instanced meshes, geometry merging, atlased textures, and shared materials.
- Keep the number of dynamic lights and shadow-casting objects low. Favor emissive materials, baked-looking effects, and selective postprocessing.
- Limit the pixel ratio on high-DPI screens when needed.
- Cull geometry outside the camera view; use distance-based LOD and simplified faraway buildings.
- Simulate high-detail physics only for active / nearby objects. Treat most buildings as static colliders.
- Pool particle effects for smoke, debris, and lighting effects; cap particle and skid-mark counts.
- Avoid dozens of independent animations or expensive updates per building.
- Profile CPU frame time, GPU load, and collider counts as the map grows.
- Handle resize, tab switching, and pause/resume without exploding physics steps.
- Do not let visual embellishments compromise the feel of driving.

## Technical Architecture

- Use **Three.js** for the 3D scene, camera, objects, materials, and rendering.
- Choose a suitable browser development stack (e.g., Vite with TypeScript or JavaScript).
- Keep the implementation modular, with clear separation of:
  - app initialization and game loop
  - city generation and district/building data
  - vehicle physics and tunable parameters
  - user and gamepad input
  - camera controller
  - collision triggers and website modal
  - lighting, effects, HUD, and performance controls
- Use a **fixed simulation timestep** (e.g., 1/60 second) with an accumulator and a cap on catch-up work; render frames independently.
- Interpolate visual state where appropriate to avoid frame jitter.
- Do not couple camera movement or particles directly to core vehicle physics.
- Make vehicle and map tuning settings straightforward to edit.
- Provide simple speedometer, district name, controls hint, and reset UI without cluttering the view.

## Implementation Priorities

Implement in this order so there is always a runnable project:

1. **Runnable browser app:** working Three.js scene with a ground plane, camera, game loop, and road network.
2. **Driveable vehicle:** W/A/S/D input, believable acceleration, momentum, braking/reverse, steering, collision, and chase camera.
3. **City layout:** central Google landmark, six connected districts, wide building-access roads, and enclosed perimeter wall with high invisible collision extension.
4. **Company buildings:** all brands represented with signs, static collisions, and official website mappings.
5. **Interaction modal:** collision-based Yes/No website prompt with cooldown.
6. **Driving polish:** handbrake/drifting, tire smoke/skid marks, body effects, bumps, ramps, suspension-like responses, and multiple camera modes.
7. **Visual and runtime polish:** cyberpunk lighting, neon reflection look, readable HUD, frame-rate optimization, and gamepad support if time allows.

If time is constrained, **protect the working driving experience and complete navigable map first**. Do not spend the entire build on visual polish before the vehicle can drive.

## Acceptance Checklist

- [ ] The game starts and runs locally in a browser with documented commands.
- [ ] The player can immediately drive a vehicle using W/A/S/D.
- [ ] Steering is speed-sensitive, velocity-based, and smooth.
- [ ] The car coasts when W is released and brakes/reverses naturally using S.
- [ ] Handbrake sliding is controllable and traction recovers on release.
- [ ] The camera follows cinematically; C, R, and mouse-look work.
- [ ] A Google landmark anchors the center of an original neon city.
- [ ] **All six** districts and all listed brand buildings exist.
- [ ] Roads connect the districts, and roads surround each building.
- [ ] Cars collide with buildings and with a continuous brick map boundary.
- [ ] An invisible vertical barrier prevents escape above the wall.
- [ ] Crashing into a company building opens a Yes/No website prompt, never an automatic website redirect.
- [ ] Clicking Yes opens the correct official company website; No returns to gameplay.
- [ ] Popups don't repeatedly fire while the car remains pressed against a building.
- [ ] The game remains reasonably smooth while driving through the city.
- [ ] The city reflects the reference image's cyberpunk feel **without copying it exactly**.

## Deliverables

1. A complete runnable project with source code and dependencies.
2. A short `README.md` with installation and browser launch commands.
3. A concise overview of architecture, controls, and vehicle tuning values.
4. A note about implemented features versus any optional features deferred due to hackathon time constraints.
5. Actually run the development server, verify the application loads, and fix any build or runtime errors you can detect before declaring completion.

**Final instruction:** Build a playable driving game, not just an attractive city visualization. The highest priorities are **responsive arcade vehicle physics, fully navigable roads around every building, complete six-district map coverage, safe company website interaction, and sustained browser performance**.


