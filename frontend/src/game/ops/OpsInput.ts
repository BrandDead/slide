export type OpsAction = 'fire' | 'reload' | 'interact' | 'retreat' | 'camera' | 'next-member' | 'previous-member' | 'pause';

export interface OpsMovementInput {
  forward: number;
  strafe: number;
}

export interface OpsLookDelta {
  x: number;
  y: number;
}

/** DOM input owner for Modern Ops. All listeners are removed by dispose(). */
export class OpsInput {
  private readonly keys = new Set<string>();
  private readonly pressed = new Set<OpsAction>();
  private lookX = 0;
  private lookY = 0;
  private disposed = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  movement(): OpsMovementInput {
    const forward = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp'))
      - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    const strafe = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight'))
      - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    return { forward, strafe };
  }

  consume(action: OpsAction): boolean {
    const active = this.pressed.has(action);
    this.pressed.delete(action);
    return active;
  }

  consumeLookDelta(): OpsLookDelta {
    const result = { x: this.lookX, y: this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return result;
  }

  isPointerLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  requestPointerLock(): void {
    if (this.isPointerLocked()) return;
    void this.canvas.requestPointerLock?.();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.keys.clear();
    this.pressed.clear();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) {
      this.keys.add(event.code);
      return;
    }
    this.keys.add(event.code);
    const action = this.actionForCode(event.code);
    if (action) {
      this.pressed.add(action);
      if (event.code !== 'Escape') event.preventDefault();
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly onBlur = (): void => {
    this.keys.clear();
  };

  private readonly onMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return;
    this.pressed.add('fire');
    if (!this.isPointerLocked()) this.requestPointerLock();
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (!this.isPointerLocked()) return;
    this.lookX += event.movementX;
    this.lookY += event.movementY;
  };

  private readonly onPointerLockChange = (): void => {
    if (!this.isPointerLocked()) this.keys.clear();
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  private actionForCode(code: string): OpsAction | null {
    if (code === 'Space') return 'fire';
    if (code === 'KeyR') return 'reload';
    if (code === 'KeyE') return 'interact';
    if (code === 'KeyQ') return 'retreat';
    if (code === 'KeyV') return 'camera';
    if (code === 'BracketRight') return 'next-member';
    if (code === 'BracketLeft') return 'previous-member';
    if (code === 'Escape') return 'pause';
    return null;
  }
}
