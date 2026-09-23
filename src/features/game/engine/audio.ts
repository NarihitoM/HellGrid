export type SoundName =
  | 'pistol'
  | 'shotgun'
  | 'rifle'
  | 'sniper'
  | 'reload'
  | 'scope'
  | 'empty'
  | 'enemyHurt'
  | 'enemyDie'
  | 'bruteDie'
  | 'playerHurt'
  | 'fireball'
  | 'swing'
  | 'pickup'
  | 'wave'
  | 'unlock'
  | 'spawn'

export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null

  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.4
      this.master.connect(this.ctx.destination)

      const length = this.ctx.sampleRate
      this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
      const channel = this.noise.getChannelData(0)
      for (let i = 0; i < length; i++) channel[i] = Math.random() * 2 - 1
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  play(name: SoundName, volume = 1) {
    if (!this.ctx || volume <= 0.02) return

    switch (name) {
      case 'pistol':
        this.burst(0.18, 0.9 * volume, 'lowpass', 2800)
        this.tone('triangle', 180, 50, 0.12, 0.6 * volume)
        break
      case 'shotgun':
        this.burst(0.45, 1.3 * volume, 'lowpass', 1500)
        this.tone('sine', 120, 32, 0.32, 1 * volume)
        break
      case 'rifle':
        this.burst(0.1, 0.7 * volume, 'bandpass', 2200, 0.8)
        this.tone('square', 150, 60, 0.06, 0.18 * volume)
        break
      case 'sniper':
        this.burst(0.6, 1.4 * volume, 'lowpass', 2200)
        this.tone('sawtooth', 220, 30, 0.45, 0.7 * volume)
        this.burst(0.08, 0.3 * volume, 'highpass', 3000, 1, 0.5)
        break
      case 'reload':
        this.burst(0.05, 0.5 * volume, 'bandpass', 2600, 2)
        this.burst(0.06, 0.6 * volume, 'bandpass', 1800, 2, 0.35)
        this.burst(0.05, 0.7 * volume, 'bandpass', 3200, 2, 0.7)
        break
      case 'scope':
        this.burst(0.04, 0.35 * volume, 'bandpass', 4000, 3)
        break
      case 'empty':
        this.tone('square', 900, 700, 0.04, 0.2 * volume)
        break
      case 'enemyHurt':
        this.tone('sawtooth', 320, 140, 0.15, 0.3 * volume)
        break
      case 'enemyDie':
        this.tone('sawtooth', 260, 40, 0.6, 0.4 * volume)
        this.burst(0.4, 0.3 * volume, 'lowpass', 600)
        break
      case 'bruteDie':
        this.tone('sawtooth', 130, 24, 1.1, 0.6 * volume)
        this.burst(0.7, 0.5 * volume, 'lowpass', 400)
        break
      case 'playerHurt':
        this.tone('sawtooth', 200, 90, 0.22, 0.5 * volume)
        this.burst(0.12, 0.4 * volume, 'bandpass', 900)
        break
      case 'fireball':
        this.tone('sine', 700, 180, 0.35, 0.3 * volume)
        this.burst(0.3, 0.25 * volume, 'bandpass', 1200)
        break
      case 'swing':
        this.burst(0.16, 0.35 * volume, 'highpass', 1800)
        break
      case 'pickup':
        this.tone('square', 660, 660, 0.07, 0.18 * volume)
        this.tone('square', 990, 990, 0.1, 0.18 * volume, 0.07)
        break
      case 'wave':
        ;[220, 330, 440].forEach((f, i) => this.tone('triangle', f, f, 0.22, 0.3 * volume, i * 0.12))
        break
      case 'unlock':
        ;[440, 554, 659, 880].forEach((f, i) => this.tone('square', f, f, 0.12, 0.14 * volume, i * 0.09))
        break
      case 'spawn':
        this.tone('sine', 200, 900, 0.4, 0.2 * volume)
        break
    }
  }

  destroy() {
    void this.ctx?.close()
    this.ctx = null
  }

  private output(gain: number, start: number, duration: number): GainNode | null {
    if (!this.ctx || !this.master) return null
    const node = this.ctx.createGain()
    node.gain.setValueAtTime(gain, start)
    node.gain.exponentialRampToValueAtTime(0.001, start + duration)
    node.connect(this.master)
    return node
  }

  private tone(type: OscillatorType, from: number, to: number, duration: number, gain: number, delay = 0) {
    if (!this.ctx) return
    const start = this.ctx.currentTime + delay
    const out = this.output(gain, start, duration)
    if (!out) return

    const osc = this.ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(from, start)
    osc.frequency.exponentialRampToValueAtTime(to, start + duration)
    osc.connect(out)
    osc.start(start)
    osc.stop(start + duration)
  }

  private burst(duration: number, gain: number, type: BiquadFilterType, frequency: number, q = 1, delay = 0) {
    if (!this.ctx || !this.noise) return
    const start = this.ctx.currentTime + delay
    const out = this.output(gain, start, duration)
    if (!out) return

    const filter = this.ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = frequency
    filter.Q.value = q
    filter.connect(out)

    const source = this.ctx.createBufferSource()
    source.buffer = this.noise
    source.connect(filter)
    source.start(start, Math.random() * 0.5, duration)
  }
}
