import { PlayerInputState } from '../types/game';

interface ButtonFlags {
  pass: boolean;
  shoot: boolean;
  lob: boolean;
  steal: boolean;
  pause: boolean;
}

const EMPTY_FLAGS: ButtonFlags = {
  pass: false,
  shoot: false,
  lob: false,
  steal: false,
  pause: false,
};

export interface GamepadStatus {
  p1Connected: boolean;
  p2Connected: boolean;
  p1Name: string;
  p2Name: string;
}

export type VirtualButtonName = 'pass' | 'shoot' | 'lob' | 'sprint' | 'steal';

interface VirtualPlayerPad {
  stick: { dx: number; dy: number };
  buttons: Record<VirtualButtonName, boolean>;
}

function createEmptyVirtualPad(): VirtualPlayerPad {
  return {
    stick: { dx: 0, dy: 0 },
    buttons: {
      pass: false,
      shoot: false,
      lob: false,
      sprint: false,
      steal: false,
    },
  };
}

export class InputManager {
  private keys = new Set<string>();
  private prevP1: ButtonFlags = { ...EMPTY_FLAGS };
  private prevP2: ButtonFlags = { ...EMPTY_FLAGS };
  // Latches garantem que toques super rápidos (press + release entre frames) nunca sejam perdidos
  private latchP1: ButtonFlags = { ...EMPTY_FLAGS };
  private latchP2: ButtonFlags = { ...EMPTY_FLAGS };
  private virtualPads: Record<1 | 2, VirtualPlayerPad> = {
    1: createEmptyVirtualPad(),
    2: createEmptyVirtualPad(),
  };
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundBlur: () => void;
  private boundVisibility: () => void;

  constructor() {
    this.boundKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      const tag = (e.target as HTMLElement | null)?.tagName;
      const isTextInput = tag === 'INPUT' || tag === 'TEXTAREA';

      // Previne rolagem da página e disparo acidental de botões HTML com setas ou espaço
      if (
        !isTextInput &&
        (code === 'ArrowUp' ||
          code === 'ArrowDown' ||
          code === 'ArrowLeft' ||
          code === 'ArrowRight' ||
          code === 'Space')
      ) {
        e.preventDefault();
      }

      if (!e.repeat && !this.keys.has(code)) {
        this.latchKeyboardCode(code);
      }
      this.keys.add(code);
    };

    this.boundKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };

    this.boundBlur = () => {
      this.clearAllInputs();
    };

    this.boundVisibility = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        this.clearAllInputs();
      }
    };
  }

  private latchKeyboardCode(code: string): void {
    // P1
    if (code === 'KeyZ' || code === 'Numpad1') this.latchP1.pass = true;
    if (code === 'KeyX' || code === 'Numpad2') this.latchP1.shoot = true;
    if (code === 'KeyC' || code === 'Numpad3') this.latchP1.lob = true;
    if (code === 'KeyV' || code === 'Numpad4') this.latchP1.steal = true;
    if (code === 'Escape' || code === 'KeyP') this.latchP1.pause = true;

    // P2
    if (code === 'KeyF' || code === 'KeyU') this.latchP2.pass = true;
    if (code === 'KeyG' || code === 'KeyI') this.latchP2.shoot = true;
    if (code === 'KeyH' || code === 'KeyO') this.latchP2.lob = true;
    if (code === 'KeyJ' || code === 'KeyK') this.latchP2.steal = true;
  }

  private clearAllInputs(): void {
    this.keys.clear();
    this.resetVirtualInputs();
    this.resetEdgeStates();
  }

  public setVirtualStick(dx: number, dy: number, playerNum: 1 | 2 = 1): void {
    const pad = this.virtualPads[playerNum];
    pad.stick.dx = Math.max(-1, Math.min(1, Number.isFinite(dx) ? dx : 0));
    pad.stick.dy = Math.max(-1, Math.min(1, Number.isFinite(dy) ? dy : 0));
  }

  public setVirtualButton(btn: VirtualButtonName, pressed: boolean, playerNum: 1 | 2 = 1): void {
    const pad = this.virtualPads[playerNum];
    const wasPressed = pad.buttons[btn];
    pad.buttons[btn] = pressed;

    if (pressed && !wasPressed && btn !== 'sprint') {
      const latch = playerNum === 1 ? this.latchP1 : this.latchP2;
      latch[btn] = true;
    }
  }

  public resetVirtualInputs(playerNum?: 1 | 2): void {
    if (!playerNum || playerNum === 1) {
      this.virtualPads[1] = createEmptyVirtualPad();
      this.latchP1 = { ...EMPTY_FLAGS };
    }
    if (!playerNum || playerNum === 2) {
      this.virtualPads[2] = createEmptyVirtualPad();
      this.latchP2 = { ...EMPTY_FLAGS };
    }
  }

  public attach(): void {
    window.addEventListener('keydown', this.boundKeyDown, { passive: false });
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('blur', this.boundBlur);
    document.addEventListener('visibilitychange', this.boundVisibility);
  }

  public detach(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('blur', this.boundBlur);
    document.removeEventListener('visibilitychange', this.boundVisibility);
    this.clearAllInputs();
  }

  public getGamepadStatus(): GamepadStatus {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) {
      return { p1Connected: false, p2Connected: false, p1Name: '', p2Name: '' };
    }
    const pads = Array.from(navigator.getGamepads()).filter(
      (g): g is Gamepad => g !== null && g.connected
    );
    return {
      p1Connected: pads.length >= 1,
      p2Connected: pads.length >= 2,
      p1Name: pads[0]?.id ?? '',
      p2Name: pads[1]?.id ?? '',
    };
  }

  private readGamepad(padIndex: number): {
    dx: number;
    dy: number;
    pass: boolean;
    shoot: boolean;
    lob: boolean;
    steal: boolean;
    sprint: boolean;
    pause: boolean;
  } {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) {
      return {
        dx: 0,
        dy: 0,
        pass: false,
        shoot: false,
        lob: false,
        steal: false,
        sprint: false,
        pause: false,
      };
    }
    const pads = Array.from(navigator.getGamepads()).filter(
      (g): g is Gamepad => g !== null && g.connected
    );
    const pad = pads[padIndex];
    if (!pad) {
      return {
        dx: 0,
        dy: 0,
        pass: false,
        shoot: false,
        lob: false,
        steal: false,
        sprint: false,
        pause: false,
      };
    }

    let dx = 0;
    let dy = 0;

    // Analógico esquerdo ou manche Arcade USB (eixos 0/1) com zona morta limpa
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    if (Math.abs(ax) > 0.22) dx = ax;
    if (Math.abs(ay) > 0.22) dy = ay;

    // D-Pad padrão (botões 12=Up, 13=Down, 14=Left, 15=Right) somando opostos sem travar
    const dpadX = (pad.buttons[15]?.pressed ? 1 : 0) - (pad.buttons[14]?.pressed ? 1 : 0);
    const dpadY = (pad.buttons[13]?.pressed ? 1 : 0) - (pad.buttons[12]?.pressed ? 1 : 0);
    if (dpadX !== 0) dx = dpadX;
    if (dpadY !== 0) dy = dpadY;

    // Botões padrão SNES / Xbox / PS / Fliperama USB 6 botões
    const pass = Boolean(pad.buttons[0]?.pressed); // Botão 1 (A / Cross) = Passe / Trocar
    const shoot = Boolean(pad.buttons[1]?.pressed || pad.buttons[2]?.pressed); // Botão 2/3 (B / X) = Chute / Carrinho
    const lob = Boolean(pad.buttons[3]?.pressed); // Botão 4 (Y / Triangle) = Lançamento Alto
    const steal = Boolean(pad.buttons[4]?.pressed || pad.buttons[6]?.pressed); // LB / L2 / Botão 5 = Tomar Bola / Pedalar
    const sprint = Boolean(pad.buttons[5]?.pressed || pad.buttons[7]?.pressed); // RB / R2 / Botão 6 = Correr
    const pause = Boolean(pad.buttons[9]?.pressed || pad.buttons[8]?.pressed); // Start / Select

    return { dx, dy, pass, shoot, lob, steal, sprint, pause };
  }

  public pollPlayer(playerNum: 1 | 2, allowSinglePlayerWasd = false): PlayerInputState {
    const prev = playerNum === 1 ? this.prevP1 : this.prevP2;
    const latch = playerNum === 1 ? this.latchP1 : this.latchP2;
    const pad = this.readGamepad(playerNum - 1);
    const vpad = this.virtualPads[playerNum];

    let dx = pad.dx;
    let dy = pad.dy;
    let pass = pad.pass;
    let shoot = pad.shoot;
    let lob = pad.lob;
    let steal = pad.steal;
    let sprint = pad.sprint;
    let pause = pad.pause;

    // Joystick e botões virtuais Fliperama (funciona para P1 e P2 simultaneamente)
    if (Math.abs(vpad.stick.dx) > 0.08 || Math.abs(vpad.stick.dy) > 0.08) {
      dx = vpad.stick.dx;
      dy = vpad.stick.dy;
    }
    if (vpad.buttons.pass) pass = true;
    if (vpad.buttons.shoot) shoot = true;
    if (vpad.buttons.lob) lob = true;
    if (vpad.buttons.steal) steal = true;
    if (vpad.buttons.sprint) sprint = true;

    if (playerNum === 1) {
      // Teclado P1: Setas (+ WASD opcional no modo 1P vs CPU!), Z/Numpad1, X/Numpad2, C/Numpad3, V/Numpad4, Shift/Numpad0
      const kLeft = this.keys.has('ArrowLeft') || (allowSinglePlayerWasd && this.keys.has('KeyA'));
      const kRight = this.keys.has('ArrowRight') || (allowSinglePlayerWasd && this.keys.has('KeyD'));
      const kUp = this.keys.has('ArrowUp') || (allowSinglePlayerWasd && this.keys.has('KeyW'));
      const kDown = this.keys.has('ArrowDown') || (allowSinglePlayerWasd && this.keys.has('KeyS'));

      const kdx = (kRight ? 1 : 0) - (kLeft ? 1 : 0);
      const kdy = (kDown ? 1 : 0) - (kUp ? 1 : 0);
      if (kdx !== 0 || kdy !== 0) {
        dx = kdx;
        dy = kdy;
      }

      if (this.keys.has('KeyZ') || this.keys.has('Numpad1')) pass = true;
      if (this.keys.has('KeyX') || this.keys.has('Numpad2')) shoot = true;
      if (this.keys.has('KeyC') || this.keys.has('Numpad3')) lob = true;
      if (this.keys.has('KeyV') || this.keys.has('Numpad4')) steal = true;
      if (
        this.keys.has('ShiftLeft') ||
        this.keys.has('ShiftRight') ||
        this.keys.has('Numpad0') ||
        (allowSinglePlayerWasd && this.keys.has('Space'))
      ) {
        sprint = true;
      }
      if (this.keys.has('Escape') || this.keys.has('KeyP')) pause = true;
    } else {
      // Teclado P2 (Fliperama Local): WASD (mover), F/U (passe), G/I (chute), H/O (lançar), J/K (tomar/pedalar), Espaço/R/L (correr)
      const kdx = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
      const kdy = (this.keys.has('KeyS') ? 1 : 0) - (this.keys.has('KeyW') ? 1 : 0);
      if (kdx !== 0 || kdy !== 0) {
        dx = kdx;
        dy = kdy;
      }

      if (this.keys.has('KeyF') || this.keys.has('KeyU')) pass = true;
      if (this.keys.has('KeyG') || this.keys.has('KeyI')) shoot = true;
      if (this.keys.has('KeyH') || this.keys.has('KeyO')) lob = true;
      if (this.keys.has('KeyJ') || this.keys.has('KeyK')) steal = true;
      if (this.keys.has('Space') || this.keys.has('KeyR') || this.keys.has('KeyL')) sprint = true;
    }

    // Aplica latches de cliques ultra-rápidos (se soltou antes do tick, segura 1 frame para disparar JustPressed)
    const latchedPass = latch.pass && !prev.pass;
    const latchedShoot = latch.shoot && !prev.shoot;
    const latchedLob = latch.lob && !prev.lob;
    const latchedSteal = latch.steal && !prev.steal;
    const latchedPause = latch.pause && !prev.pause;

    if (latchedPass) pass = true;
    if (latchedShoot) shoot = true;
    if (latchedLob) lob = true;
    if (latchedSteal) steal = true;
    if (latchedPause) pause = true;

    latch.pass = false;
    latch.shoot = false;
    latch.lob = false;
    latch.steal = false;
    latch.pause = false;

    // Normaliza diagonais
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }

    const state: PlayerInputState = {
      dx,
      dy,
      pass,
      passJustPressed: pass && !prev.pass,
      passJustReleased: !pass && prev.pass,
      shoot,
      shootJustPressed: shoot && !prev.shoot,
      shootJustReleased: !shoot && prev.shoot,
      lob,
      lobJustPressed: lob && !prev.lob,
      lobJustReleased: !lob && prev.lob,
      steal,
      stealJustPressed: steal && !prev.steal,
      sprint,
      pauseJustPressed: pause && !prev.pause,
    };

    prev.pass = pass;
    prev.shoot = shoot;
    prev.lob = lob;
    prev.steal = steal;
    prev.pause = pause;

    return state;
  }

  public resetEdgeStates(): void {
    this.prevP1 = { ...EMPTY_FLAGS };
    this.prevP2 = { ...EMPTY_FLAGS };
    this.latchP1 = { ...EMPTY_FLAGS };
    this.latchP2 = { ...EMPTY_FLAGS };
  }
}
