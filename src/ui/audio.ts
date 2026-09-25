// Every sound in the game is synthesised here, so the game ships with no audio
// files and works offline. Nothing plays until the first tap (browsers
// require a gesture before audio).

type Sfx =
  | 'tap'
  | 'die'
  | 'roll'
  | 'move'
  | 'clean'
  | 'cost'
  | 'fail'
  | 'hurt'
  | 'stinger'
  | 'card'
  | 'alarm'
  | 'panic'
  | 'win'
  | 'death'
  | 'item';

class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private heartTimer: number | null = null;
  private heartRate = 0;
  enabled = true;
  volume = 0.7;

  setEnabled(on: boolean, volume: number): void {
    this.enabled = on;
    this.volume = volume;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? volume * 0.8 : 0, this.ctx.currentTime, 0.2);
    if (!on) this.setHeartbeat(0);
  }

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? this.volume * 0.8 : 0;
    this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.startAmbience();
  }

  private startAmbience(): void {
    const ctx = this.ctx!;
    this.ambience = ctx.createGain();
    this.ambience.gain.value = 0;
    this.ambience.gain.setTargetAtTime(0.5, ctx.currentTime, 3);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 160;
    this.filter.Q.value = 6;
    this.filter.connect(this.ambience);
    this.ambience.connect(this.master!);
    // The hull: two detuned saws an octave apart, heavily filtered.
    for (const [f, g] of [
      [41.2, 0.09],
      [41.5, 0.09],
      [82.6, 0.035],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.value = g;
      o.connect(gain).connect(this.filter);
      o.start();
    }
    // Slow breathing on the filter.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 60;
    lfo.connect(lfoGain).connect(this.filter.frequency);
    lfo.start();
    // Air handling hiss.
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuf;
    n.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.6;
    const ng = ctx.createGain();
    ng.gain.value = 0.012;
    n.connect(bp).connect(ng).connect(this.ambience);
    n.start();
  }

  /** Tension raises the drone and brings in the heartbeat. 0–3. */
  setTension(level: number): void {
    if (!this.ctx || !this.filter) return;
    const t = this.ctx.currentTime;
    this.filter.frequency.setTargetAtTime(160 + level * 70, t, 1.5);
    this.setHeartbeat(level >= 2 ? (level >= 3 ? 1.6 : 1.1) : 0);
  }

  private setHeartbeat(rate: number): void {
    if (rate === this.heartRate) return;
    this.heartRate = rate;
    if (this.heartTimer !== null) window.clearInterval(this.heartTimer);
    this.heartTimer = null;
    if (!rate || !this.enabled) return;
    const beat = () => {
      this.thump(0);
      this.thump(0.22);
    };
    beat();
    this.heartTimer = window.setInterval(beat, 1000 / rate);
  }

  private thump(delay: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.25);
  }

  private tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; delay?: number; slide?: number } = {}): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const o = ctx.createOscillator();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(opts.slide, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.15, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private burst(dur: number, freq: number, opts: { gain?: number; delay?: number; q?: number; sweep?: number } = {}): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noiseBuf) return;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t);
    if (opts.sweep) f.frequency.exponentialRampToValueAtTime(opts.sweep, t + dur);
    f.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  play(s: Sfx): void {
    if (!this.enabled || !this.ctx) return;
    switch (s) {
      case 'tap':
        this.tone(1400, 0.05, { gain: 0.04, type: 'triangle' });
        break;
      case 'die':
        this.burst(0.05, 2400, { gain: 0.12, q: 4 });
        break;
      case 'roll':
        for (let i = 0; i < 6; i++) this.burst(0.04, 1800 + Math.random() * 1600, { gain: 0.1, q: 5, delay: i * 0.055 + Math.random() * 0.02 });
        break;
      case 'move':
        this.burst(0.35, 300, { gain: 0.12, sweep: 900, q: 0.8 });
        break;
      case 'clean':
        this.tone(660, 0.18, { gain: 0.08 });
        this.tone(990, 0.3, { gain: 0.07, delay: 0.08 });
        break;
      case 'cost':
        this.tone(440, 0.22, { gain: 0.08, type: 'triangle' });
        this.tone(415, 0.3, { gain: 0.06, delay: 0.1, type: 'triangle' });
        break;
      case 'fail':
        this.tone(150, 0.35, { gain: 0.12, type: 'sawtooth', slide: 90 });
        break;
      case 'hurt':
        this.tone(90, 0.4, { gain: 0.35, slide: 40 });
        this.burst(0.25, 400, { gain: 0.25, q: 0.7 });
        break;
      case 'stinger':
        for (const [f, d] of [
          [233, 0],
          [247, 0.02],
          [349, 0.04],
          [370, 0.06],
        ] as const) this.tone(f, 1.6, { gain: 0.05, type: 'sawtooth', delay: d });
        this.burst(1.2, 2000, { gain: 0.08, sweep: 300, q: 2 });
        break;
      case 'card':
        this.burst(0.12, 3000, { gain: 0.05, sweep: 1200, q: 1.5 });
        break;
      case 'alarm':
        for (let i = 0; i < 3; i++) {
          this.tone(880, 0.18, { gain: 0.07, type: 'square', delay: i * 0.4 });
          this.tone(660, 0.18, { gain: 0.07, type: 'square', delay: i * 0.4 + 0.2 });
        }
        break;
      case 'panic':
        this.burst(0.9, 600, { gain: 0.2, sweep: 3000, q: 3 });
        this.tone(120, 0.8, { gain: 0.15, type: 'sawtooth', slide: 60 });
        break;
      case 'item':
        this.tone(880, 0.08, { gain: 0.06, type: 'triangle' });
        this.tone(1320, 0.12, { gain: 0.05, type: 'triangle', delay: 0.06 });
        break;
      case 'win':
        [262, 330, 392, 523].forEach((f, i) => this.tone(f, 2.5, { gain: 0.06, delay: i * 0.18 }));
        break;
      case 'death':
        [220, 185, 147, 110].forEach((f, i) => this.tone(f, 1.8, { gain: 0.07, type: 'triangle', delay: i * 0.3 }));
        break;
    }
  }

  vibrate(pattern: number | number[]): void {
    if (!this.enabled) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* not supported */
    }
  }
}

export const audio = new Audio();
