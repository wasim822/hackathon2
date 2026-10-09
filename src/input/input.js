// Keyboard + mouse + gamepad input. Produces analog values each frame and
// one-shot "pressed" actions (camera cycle, reset, ...).

const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyC', 'KeyR', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyV', 'KeyM', 'KeyH', 'KeyN', 'KeyF', 'KeyQ', 'Backquote']);

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDX = 0; this.mouseDY = 0;
    this.enabled = true;
    this.canvas = canvas;
    this.dragging = false;
    this.gamepadIndex = null;
    this.prevPadButtons = [];
    this.state = { throttle: 0, brake: 0, steer: 0, handbrake: false, lookX: 0, lookY: 0, lookBack: false };
    this.lastDevice = 'keyboard';
    this.listeners = [];

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      this.lastDevice = 'keyboard';
      this.listeners.forEach((f) => f(e.code));
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => this.keys.clear());

    // mouse look: pointer lock on click, or click-drag as fallback
    canvas.addEventListener('mousedown', (e) => {
      this.dragging = true;
      if (e.button === 0 && document.pointerLockElement !== canvas && this.enabled) {
        canvas.requestPointerLock?.()?.catch?.(() => {});
      }
    });
    window.addEventListener('mouseup', () => { this.dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (document.pointerLockElement === canvas || this.dragging) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
    window.addEventListener('gamepadconnected', (e) => { this.gamepadIndex = e.gamepad.index; });
    window.addEventListener('gamepaddisconnected', () => { this.gamepadIndex = null; });
  }

  onKey(f) { this.listeners.push(f); }

  releasePointer() {
    if (document.pointerLockElement) document.exitPointerLock();
    this.dragging = false;
  }

  // Call once per render frame
  poll() {
    const k = this.keys, s = this.state;
    const kb = {
      throttle: k.has('KeyW') || k.has('ArrowUp') ? 1 : 0,
      brake: k.has('KeyS') || k.has('ArrowDown') ? 1 : 0,
      steer: (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) - (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0),
      handbrake: k.has('Space'),
    };
    s.throttle = kb.throttle; s.brake = kb.brake; s.steer = kb.steer; s.handbrake = kb.handbrake;
    s.lookX = this.mouseDX; s.lookY = this.mouseDY;
    s.lookBack = k.has('KeyV');
    this.mouseDX = 0; this.mouseDY = 0;

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = this.gamepadIndex != null ? pads[this.gamepadIndex] : [...pads].find((p) => p);
    if (pad) {
      const dz = (v, d = 0.12) => (Math.abs(v) < d ? 0 : (v - Math.sign(v) * d) / (1 - d));
      const steer = -dz(pad.axes[0] || 0);
      const rt = pad.buttons[7]?.value || 0, lt = pad.buttons[6]?.value || 0;
      const used = Math.abs(steer) > 0 || rt > 0.05 || lt > 0.05 || pad.buttons.some((b) => b.pressed);
      if (used) this.lastDevice = 'gamepad';
      if (Math.abs(steer) > Math.abs(s.steer)) s.steer = steer;
      s.throttle = Math.max(s.throttle, rt);
      s.brake = Math.max(s.brake, lt);
      s.handbrake = s.handbrake || !!pad.buttons[0]?.pressed || !!pad.buttons[5]?.pressed;
      s.lookX += dz(pad.axes[2] || 0, 0.18) * 14;
      s.lookY += dz(pad.axes[3] || 0, 0.18) * 10;
      s.lookBack = s.lookBack || !!pad.buttons[10]?.pressed || !!pad.buttons[11]?.pressed;
      const edge = (i, code) => {
        const now = !!pad.buttons[i]?.pressed;
        if (now && !this.prevPadButtons[i]) this.pressed.add(code);
        this.prevPadButtons[i] = now;
      };
      edge(3, 'KeyC');   // Y: camera
      edge(1, 'KeyR');   // B: reset
      edge(9, 'KeyH');   // Start: help
    }
    if (!this.enabled) {
      s.throttle = 0; s.brake = 0; s.steer = 0; s.handbrake = false; s.lookX = 0; s.lookY = 0;
    }
    return s;
  }

  consume(code) {
    if (this.pressed.has(code)) { this.pressed.delete(code); return true; }
    return false;
  }

  clearPressed() { this.pressed.clear(); }
}
