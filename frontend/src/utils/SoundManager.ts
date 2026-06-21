// ============================================================
// SoundManager.ts — Web Audio API sound engine (Sprint 5D)
// Singleton that manages:
//   - Ambient loops per screen (street noise, lab bubbling, etc.)
//   - SFX one-shots (gunshot, cash register, card flip, etc.)
//   - Master volume, SFX volume, music volume
//   - Procedural synthesis fallback (no audio files required for MVP)
// ============================================================

// ─── Types ───────────────────────────────────────────────────

export type AmbientTrack =
  | 'street'    // idle block — traffic, distant voices
  | 'lab'       // alchemy lab — bubbling, hum
  | 'casino'    // casino — chatter, chips
  | 'combat'    // drive-by — tension drone
  | 'menu';     // main menu — lo-fi

export type SFXEvent =
  | 'gunshot'
  | 'gunshot_distant'
  | 'cash_register'
  | 'card_flip'
  | 'glass_break'
  | 'alert_raid'
  | 'alert_driveby'
  | 'level_up'
  | 'bail_paid'
  | 'member_down'
  | 'deal_accept'
  | 'deal_reject'
  | 'morale_drop'
  | 'heat_spike'
  | 'ui_tap'
  | 'ui_swipe';

// ─── SoundManager ────────────────────────────────────────────

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;

  private currentAmbientTrack: AmbientTrack | null = null;
  private ambientNodes: AudioNode[] = [];

  private enabled = true;
  private masterVolume = 0.8;
  private sfxVolume = 0.7;
  private ambientVolume = 0.4;

  // ── Init ──
  private init(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain  = this.ctx.createGain();
      this.sfxGain     = this.ctx.createGain();
      this.ambientGain = this.ctx.createGain();

      this.masterGain.gain.value  = this.masterVolume;
      this.sfxGain.gain.value     = this.sfxVolume;
      this.ambientGain.gain.value = this.ambientVolume;

      this.sfxGain.connect(this.masterGain);
      this.ambientGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      return this.ctx;
    } catch {
      console.warn('[SoundManager] Web Audio API not available');
      return null;
    }
  }

  private getCtx(): AudioContext | null {
    if (!this.enabled) return null;
    return this.init();
  }

  // ── Volume controls ──

  setMasterVolume(v: number): void {
    this.masterVolume = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.value = this.masterVolume;
  }

  setSFXVolume(v: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume;
  }

  setAmbientVolume(v: number): void {
    this.ambientVolume = Math.max(0, Math.min(1, v));
    if (this.ambientGain) this.ambientGain.gain.value = this.ambientVolume;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.stopAmbient();
  }

  // ── Ambient loops (procedural synthesis) ──

  playAmbient(track: AmbientTrack): void {
    if (track === this.currentAmbientTrack) return;
    this.stopAmbient();

    const ctx = this.getCtx();
    if (!ctx || !this.ambientGain) return;
    this.currentAmbientTrack = track;

    switch (track) {
      case 'street':    this._playStreetAmbient(ctx); break;
      case 'lab':       this._playLabAmbient(ctx); break;
      case 'casino':    this._playCasinoAmbient(ctx); break;
      case 'combat':    this._playCombatAmbient(ctx); break;
      case 'menu':      this._playMenuAmbient(ctx); break;
    }
  }

  stopAmbient(): void {
    for (const node of this.ambientNodes) {
      try { (node as OscillatorNode).stop?.(); } catch { /* already stopped */ }
    }
    this.ambientNodes = [];
    this.currentAmbientTrack = null;
  }

  // ── SFX one-shots ──

  play(event: SFXEvent): void {
    const ctx = this.getCtx();
    if (!ctx || !this.sfxGain) return;

    switch (event) {
      case 'gunshot':          this._synthGunshot(ctx, false); break;
      case 'gunshot_distant':  this._synthGunshot(ctx, true); break;
      case 'cash_register':    this._synthCashRegister(ctx); break;
      case 'card_flip':        this._synthCardFlip(ctx); break;
      case 'glass_break':      this._synthGlassBreak(ctx); break;
      case 'alert_raid':       this._synthAlert(ctx, 880, 0.4); break;
      case 'alert_driveby':    this._synthAlert(ctx, 660, 0.3); break;
      case 'level_up':         this._synthLevelUp(ctx); break;
      case 'bail_paid':        this._synthCashRegister(ctx); break;
      case 'member_down':      this._synthMemberDown(ctx); break;
      case 'deal_accept':      this._synthTone(ctx, 440, 0.08, 'sine', 0.15); break;
      case 'deal_reject':      this._synthTone(ctx, 220, 0.08, 'sawtooth', 0.2); break;
      case 'morale_drop':      this._synthTone(ctx, 180, 0.12, 'sawtooth', 0.35); break;
      case 'heat_spike':       this._synthAlert(ctx, 1200, 0.2); break;
      case 'ui_tap':           this._synthTone(ctx, 800, 0.03, 'sine', 0.06); break;
      case 'ui_swipe':         this._synthTone(ctx, 600, 0.02, 'sine', 0.08); break;
    }
  }

  // ─── Procedural synth helpers ─────────────────────────────

  private _node(ctx: AudioContext): GainNode {
    const g = ctx.createGain();
    g.connect(this.sfxGain!);
    return g;
  }

  private _ambientNode(ctx: AudioContext): GainNode {
    const g = ctx.createGain();
    g.connect(this.ambientGain!);
    this.ambientNodes.push(g);
    return g;
  }

  private _synthTone(
    ctx: AudioContext,
    freq: number,
    gain: number,
    type: OscillatorType,
    duration: number,
  ): void {
    const osc = ctx.createOscillator();
    const g   = this._node(ctx);
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(g);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.01);
  }

  private _synthGunshot(ctx: AudioContext, distant: boolean): void {
    const g = this._node(ctx);
    const bufSize = ctx.sampleRate * 0.15;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.08));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;

    // Low-pass for distant shot
    if (distant) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 400;
      src.connect(lp);
      lp.connect(g);
    } else {
      src.connect(g);
    }

    g.gain.setValueAtTime(distant ? 0.3 : 0.7, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    src.start(ctx.currentTime);
  }

  private _synthCashRegister(ctx: AudioContext): void {
    // Two quick high tones
    [1200, 1600].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g   = this._node(ctx);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.08;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.3, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  private _synthCardFlip(ctx: AudioContext): void {
    const g = this._node(ctx);
    const bufSize = ctx.sampleRate * 0.05;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.3)) * 0.4;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(g);
    g.gain.value = 0.5;
    src.start(ctx.currentTime);
  }

  private _synthGlassBreak(ctx: AudioContext): void {
    const g = this._node(ctx);
    const bufSize = ctx.sampleRate * 0.4;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      const t = i / bufSize;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 8) * (1 - t);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2000;
    src.connect(hp);
    hp.connect(g);
    g.gain.value = 0.6;
    src.start(ctx.currentTime);
  }

  private _synthAlert(ctx: AudioContext, freq: number, gain: number): void {
    const osc = ctx.createOscillator();
    const g   = this._node(ctx);
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + 0.3);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.connect(g);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.45);
  }

  private _synthLevelUp(ctx: AudioContext): void {
    [440, 550, 660, 880].forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.1;
      const osc = ctx.createOscillator();
      const g   = this._node(ctx);
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  private _synthMemberDown(ctx: AudioContext): void {
    const osc = ctx.createOscillator();
    const g   = this._node(ctx);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.5);
    g.gain.setValueAtTime(0.4, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    osc.connect(g);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.65);
  }

  // ─── Ambient synth tracks ─────────────────────────────────

  private _playStreetAmbient(ctx: AudioContext): void {
    // Low rumble + occasional noise bursts
    const g = this._ambientNode(ctx);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 200;
    osc.connect(lp);
    lp.connect(g);
    g.gain.value = 0.06;
    osc.start();
    this.ambientNodes.push(osc);
  }

  private _playLabAmbient(ctx: AudioContext): void {
    // Slow bubbling oscillation
    const g = this._ambientNode(ctx);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 110;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 20;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(g);
    g.gain.value = 0.08;
    osc.start();
    lfo.start();
    this.ambientNodes.push(osc, lfo);
  }

  private _playCasinoAmbient(ctx: AudioContext): void {
    // Bright chatter-like noise
    const g = this._ambientNode(ctx);
    const bufSize = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.03;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1200;
    bp.Q.value = 0.5;
    src.connect(bp);
    bp.connect(g);
    g.gain.value = 0.15;
    src.start();
    this.ambientNodes.push(src);
  }

  private _playCombatAmbient(ctx: AudioContext): void {
    // Tension drone — two detuned oscillators
    const g = this._ambientNode(ctx);
    [110, 111.5].forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 300;
      osc.connect(lp);
      lp.connect(g);
      osc.start();
      this.ambientNodes.push(osc);
    });
    g.gain.value = 0.12;
  }

  private _playMenuAmbient(ctx: AudioContext): void {
    // Lo-fi pad — soft sine chord
    const g = this._ambientNode(ctx);
    [220, 277, 330].forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(g);
      osc.start();
      this.ambientNodes.push(osc);
    });
    g.gain.value = 0.06;
  }
}

// ─── Singleton export ─────────────────────────────────────────

export const soundManager = new SoundManager();
export default soundManager;
