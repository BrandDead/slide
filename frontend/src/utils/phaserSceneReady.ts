/**
 * Phaser 3 does not attach `scene.events` until the Game boots the scene.
 * Listening with `scene.events.once('ready')` immediately after `new Phaser.Game()`
 * throws: Cannot read properties of undefined (reading 'once').
 *
 * Scenes should call `gate.markReady()` at the end of `create()`.
 * React wrappers call `gate.whenReady(cb)` before constructing the Game.
 */
export class PhaserReadyGate {
  private ready = false;
  private callbacks: Array<() => void> = [];

  whenReady(cb: () => void): void {
    if (this.ready) {
      cb();
      return;
    }
    this.callbacks.push(cb);
  }

  markReady(): void {
    this.ready = true;
    const pending = this.callbacks.splice(0, this.callbacks.length);
    for (const cb of pending) cb();
  }

  get isReady(): boolean {
    return this.ready;
  }
}
