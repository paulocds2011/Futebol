// Sintetizador Web Audio API 100% procedural + Fanfarras de Estádio + Narração Masculina Realista por IA (Gemini TTS)

export type NarrationMood = 'calm' | 'excited' | 'goal';
export type BroadcastSpeaker = 'galvao' | 'casagrande' | 'ronaldo' | 'neto';
export type MusicTrack = 'pais_do_futebol' | 'musica_da_copa';

export interface DialogueTurn {
  speaker: BroadcastSpeaker;
  text: string;
}

const MAX_CLIENT_NARRATION_CACHE = 160;
const STREAM_PCM_SAMPLE_RATE = 24000;
const PAIS_DO_FUTEBOL_MP3_URL =
  '/assets/aistudio/MC_Guime_-_Pa_s_do_Futebol_Part._Emicida__Audio_Oficial__MP3_160K__129157d1.mp3';

// Bloqueio absoluto de vozes femininas ou genéricas do navegador (Google português, Maria, Luciana, Francisca, etc.)
const FEMALE_OR_AMBIGUOUS_VOICE_RE =
  /maria|luciana|francisca|vit[oó]ria|raquel|helena|fernanda|camila|let[ií]cia|thalita|yara|joana|in[eê]s|am[eé]lia|beatriz|sofia|ana\b|clara|paula|carla|elza|yasmim|giovanna|google portugu[eê]s|female|mulher|femin/i;

// Lista explícita de vozes masculinas em português confirmadas no sistema operacional/navegador
const CONFIRMED_MALE_PT_VOICE_RE =
  /daniel|ant[oô]nio|felipe|ricardo|f[aá]bio|tiago|thiago|humberto|nicolau|j[uú]lio|donato|val[eé]rio|duarte|cristiano|carlos|marcos|paulo|rodrigo|gustavo|male|masculin/i;

class RetroAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicBusGain: GainNode | null = null;
  private crowdBusGain: GainNode | null = null;
  private narratorBusGain: GainNode | null = null;
  private muted = false;
  private menuMusicInterval: number | null = null;
  private stadiumInterval: number | null = null;
  private musicStep = 0;
  private drumStep = 0;
  private isMenuMusicPlaying = false;
  private currentMusicTrack: MusicTrack = 'pais_do_futebol';
  private mp3Audio: HTMLAudioElement | null = null;
  private mp3FadeInterval: number | null = null;
  private mp3PendingPlay = false;
  private mp3Ducked = false;
  private readonly mp3BaseVolume = 0.56;
  private isStadiumActive = false;
  private lastSpeechTime = 0;
  private lastHighSpeechTime = 0;
  private anthemBusyUntil = 0;

  // Ambiência contínua realista de estádio lotado (ruído rosa + formantes vocais dinâmicos)
  private crowdAmbienceSource: AudioBufferSourceNode | null = null;
  private crowdAmbienceGain: GainNode | null = null;
  private crowdAmbienceLowFilter: BiquadFilterNode | null = null;
  private crowdAmbienceHighFilter: BiquadFilterNode | null = null;
  private currentExcitement = 0.3;

  // Estado da Narração Masculina por IA em Streaming PCM (Web Audio API) + Watchdog anti-travamento
  private narrationCache = new Map<string, AudioBuffer>();
  private narrationInFlight = new Map<string, Promise<AudioBuffer | null>>();
  private activeNarratorSources: AudioBufferSourceNode[] = [];
  private activeNarratorGain: GainNode | null = null;
  private activeNarrationAbort: AbortController | null = null;
  private narrationSeq = 0;
  private isNarratorSpeaking = false;
  private narratorSpeakingUntilMs = 0;
  private narrationErrorCount = 0;
  private narrationCooldownUntil = 0;

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.4;
      this.masterGain.connect(this.ctx.destination);

      // Barramento exclusivo da trilha musical (País do Futebol / Música da Copa) com fade suave
      this.musicBusGain = this.ctx.createGain();
      this.musicBusGain.gain.value = 0.92;
      this.musicBusGain.connect(this.masterGain);

      // Barramento exclusivo da torcida e fanfarras (nunca é cortado pela narração!)
      this.crowdBusGain = this.ctx.createGain();
      this.crowdBusGain.gain.value = 1.0;
      this.crowdBusGain.connect(this.masterGain);

      // Barramento exclusivo da Cabine de Transmissão (Headset High-Pass → Compressor Broadcast TV → Saída)
      this.narratorBusGain = this.ctx.createGain();
      this.narratorBusGain.gain.value = 1.98;

      const headsetHighPass = this.ctx.createBiquadFilter();
      headsetHighPass.type = 'highpass';
      headsetHighPass.frequency.value = 95;
      headsetHighPass.Q.value = 0.7;

      const broadcastComp = this.ctx.createDynamicsCompressor();
      broadcastComp.threshold.value = -18;
      broadcastComp.knee.value = 12;
      broadcastComp.ratio.value = 4.2;
      broadcastComp.attack.value = 0.005;
      broadcastComp.release.value = 0.14;

      this.narratorBusGain.connect(headsetHighPass);
      headsetHighPass.connect(broadcastComp);
      broadcastComp.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.tryResumeMp3IfWanted();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.38, this.ctx.currentTime, 0.02);
    }
    if (this.mp3Audio) {
      this.mp3Audio.muted = mute;
      if (mute) {
        this.clearMp3Fade();
        this.mp3Audio.volume = 0;
      } else if (this.isMenuMusicPlaying && this.currentMusicTrack === 'pais_do_futebol') {
        const target = this.mp3Ducked ? 0.14 : this.mp3BaseVolume;
        this.rampMp3Volume(target, 0.2, false);
        if (this.mp3Audio.paused) {
          this.mp3Audio
            .play()
            .then(() => {
              this.mp3PendingPlay = false;
            })
            .catch(() => {
              this.mp3PendingPlay = true;
            });
        }
      }
    }
    if (mute) {
      this.stopNarration();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private getCrowdOutput(): GainNode | null {
    return this.crowdBusGain ?? this.masterGain;
  }

  private duckBackgroundForVoice(): void {
    this.mp3Ducked = true;
    if (this.ctx) {
      if (this.crowdBusGain) {
        this.crowdBusGain.gain.setTargetAtTime(0.7, this.ctx.currentTime, 0.08);
      }
      if (this.musicBusGain && this.isMenuMusicPlaying) {
        this.musicBusGain.gain.setTargetAtTime(0.18, this.ctx.currentTime, 0.08);
      }
    }
    if (this.mp3Audio && this.isMenuMusicPlaying && this.currentMusicTrack === 'pais_do_futebol' && !this.muted) {
      this.rampMp3Volume(0.14, 0.14, false);
    }
  }

  private restoreCrowdVolume(): void {
    this.mp3Ducked = false;
    if (this.ctx) {
      if (this.crowdBusGain) {
        this.crowdBusGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.14);
      }
      if (this.musicBusGain && this.isMenuMusicPlaying) {
        this.musicBusGain.gain.setTargetAtTime(0.92, this.ctx.currentTime, 0.16);
      }
    }
    if (this.mp3Audio && this.isMenuMusicPlaying && this.currentMusicTrack === 'pais_do_futebol' && !this.muted) {
      this.rampMp3Volume(this.mp3BaseVolume, 0.24, false);
    }
  }

  private stopActiveNarratorSource(fadeSec = 0.025): void {
    const sources = this.activeNarratorSources;
    const gain = this.activeNarratorGain;
    this.activeNarratorSources = [];
    this.activeNarratorGain = null;
    this.isNarratorSpeaking = false;
    this.narratorSpeakingUntilMs = 0;

    if (sources.length > 0 && this.ctx) {
      const now = this.ctx.currentTime;
      if (gain) {
        try {
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(Math.max(0.001, gain.gain.value), now);
          gain.gain.linearRampToValueAtTime(0.001, now + fadeSec);
        } catch {
          // ignore
        }
      }
      for (const src of sources) {
        try {
          src.onended = null;
          src.stop(now + fadeSec + 0.01);
        } catch {
          // Fonte já encerrada
        }
      }
    }
    this.restoreCrowdVolume();
  }

  public stopNarration(): void {
    this.narrationSeq++;
    if (this.activeNarrationAbort) {
      this.activeNarrationAbort.abort();
      this.activeNarrationAbort = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    this.stopActiveNarratorSource(0.02);
  }

  private createNoiseBuffer(durationSec: number): AudioBuffer | null {
    if (!this.ctx) return null;
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSec);
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // Ruído rosa suave em loop sem costura para murmúrio natural de 50 mil torcedores no estádio
  private createPinkNoiseLoopBuffer(durationSec: number): AudioBuffer | null {
    if (!this.ctx) return null;
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSec);
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
      b6 = white * 0.115926;
    }
    // Crossfade nas pontas para loop perfeitamente invisível
    const fadeLen = Math.min(2048, Math.floor(length * 0.08));
    for (let i = 0; i < fadeLen; i++) {
      const t = i / fadeLen;
      data[i] = data[i] * t + data[length - fadeLen + i] * (1 - t);
    }
    return buffer;
  }

  // Sintetiza um sopro de metal (trompete / trombone de fanfarra de estádio) quente e brilhante
  private playBrassTone(
    freq: number,
    startTime: number,
    duration: number,
    volume: number,
    addFifth = false
  ): void {
    const out = this.getCrowdOutput();
    if (!this.ctx || !out) return;

    const triggerVoice = (f: number, vol: number, detuneCents: number) => {
      if (!this.ctx || !out) return;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, startTime);
      osc.detune.setValueAtTime(detuneCents, startTime);

      // Envelope de brilho metálico de trompete
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(620, startTime);
      filter.frequency.exponentialRampToValueAtTime(2450, startTime + Math.min(0.06, duration * 0.25));
      filter.frequency.exponentialRampToValueAtTime(1150, startTime + duration);
      filter.Q.value = 1.8;

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(vol, startTime + 0.032);
      gain.gain.setValueAtTime(vol * 0.88, startTime + Math.max(0.04, duration - 0.05));
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(out);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.02);
    };

    // Dupla de trompetes ligeiramente desafinados para corpo real de fanfarra
    triggerVoice(freq, volume, -6);
    triggerVoice(freq, volume * 0.72, 7);
    if (addFifth) {
      triggerVoice(freq * 1.498, volume * 0.44, 3);
    }
  }

  // --- EFEITOS DE UI ---
  public playCursor(): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.setValueAtTime(880, now + 0.03);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  public playConfirm(): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 1046.5];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      const t = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.12);
    });
  }

  public playCancel(): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.12);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  // --- EFEITOS DE PARTIDA ---
  public playPass(): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.075);
    gain.gain.setValueAtTime(0.34, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  public playFirstTouch(): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.045);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public playHeader(): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(195, now);
    osc.frequency.exponentialRampToValueAtTime(56, now + 0.12);
    gain.gain.setValueAtTime(0.46, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.135);
  }

  // Som estiloso da pedalada / elástico / drible desconcertante + "OLÉ!" da arquibancada
  public playSkillMove(): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // 2 toques rápidos e ágeis na bola + swoosh de pedalada
    [0, 0.085].forEach((off, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(idx === 0 ? 280 : 370, now + off);
      osc.frequency.exponentialRampToValueAtTime(110, now + off + 0.065);
      gain.gain.setValueAtTime(0.24, now + off);
      gain.gain.exponentialRampToValueAtTime(0.001, now + off + 0.07);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + off);
      osc.stop(now + off + 0.075);
    });

    // Vibração rápida "OOOOOH!" da torcida impressionada com o drible
    const out = this.getCrowdOutput();
    const buf = this.createNoiseBuffer(0.65);
    if (buf && out) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const flt = this.ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.setValueAtTime(620, now + 0.04);
      flt.frequency.linearRampToValueAtTime(1250, now + 0.25);
      flt.frequency.linearRampToValueAtTime(740, now + 0.62);
      flt.Q.value = 1.6;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.01, now + 0.04);
      ng.gain.linearRampToValueAtTime(0.2, now + 0.18);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.64);
      src.connect(flt);
      flt.connect(ng);
      ng.connect(out);
      src.start(now + 0.04);
    }
  }

  public playKick(power = 0.7): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    const startFreq = 180 + power * 90;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.13);
    gain.gain.setValueAtTime(0.42 + power * 0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);

    const buf = this.createNoiseBuffer(0.05);
    if (buf) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1100;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.24 * (0.6 + power * 0.5), now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      noise.connect(filter);
      filter.connect(ng);
      ng.connect(this.masterGain);
      noise.start(now);
    }
  }

  public playTackle(): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const buf = this.createNoiseBuffer(0.16);
    if (!buf) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(280, now + 0.16);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
  }

  public playPostHit(): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const freqs = [410, 622, 1180];
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx === 0 ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.96, now + 0.35);
      gain.gain.setValueAtTime(0.22 / (idx + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.38);
    });
  }

  public playSave(): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.1);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playWhistle(kind: 'short' | 'double' | 'fulltime' = 'short'): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx || !this.masterGain) return;

    const triggerBlast = (offset: number, dur: number, baseFreq = 2650) => {
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime + offset;
      const osc = this.ctx.createOscillator();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);

      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(34, now);
      lfoGain.gain.setValueAtTime(140, now);

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.02);
      gain.gain.setValueAtTime(0.2, now + Math.max(0.03, dur - 0.04));
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      lfo.start(now);
      osc.stop(now + dur + 0.02);
      lfo.stop(now + dur + 0.02);
    };

    if (kind === 'short') {
      triggerBlast(0, 0.24, 2700);
    } else if (kind === 'double') {
      triggerBlast(0, 0.16, 2650);
      triggerBlast(0.22, 0.26, 2750);
    } else {
      triggerBlast(0, 0.18, 2650);
      triggerBlast(0.24, 0.18, 2650);
      triggerBlast(0.5, 0.62, 2760);
    }
  }

  // --- TORCIDA REALISTA (AMBIÊNCIA CONTÍNUA DE ARENA + BATERIA DE ARQUIBANCADA) ---
  private ensureCrowdAmbienceStarted(): void {
    if (!this.isStadiumActive || this.crowdAmbienceSource || !this.ctx) return;
    const out = this.getCrowdOutput();
    if (!out) return;

    const pinkBuf = this.createPinkNoiseLoopBuffer(4.2);
    if (!pinkBuf) return;

    const src = this.ctx.createBufferSource();
    src.buffer = pinkBuf;
    src.loop = true;

    // Camada 1: ressonância quente de estádio lotado (vozes graves 440Hz)
    const lowFlt = this.ctx.createBiquadFilter();
    lowFlt.type = 'bandpass';
    lowFlt.frequency.value = 460;
    lowFlt.Q.value = 0.75;

    // Camada 2: brilho vocal e palmas distantes (1120Hz)
    const highFlt = this.ctx.createBiquadFilter();
    highFlt.type = 'bandpass';
    highFlt.frequency.value = 1120;
    highFlt.Q.value = 1.05;

    const lowGain = this.ctx.createGain();
    lowGain.gain.value = 0.85;
    const highGain = this.ctx.createGain();
    highGain.gain.value = 0.55;

    const masterAmb = this.ctx.createGain();
    masterAmb.gain.value = 0.14;

    src.connect(lowFlt);
    lowFlt.connect(lowGain);
    lowGain.connect(masterAmb);

    src.connect(highFlt);
    highFlt.connect(highGain);
    highGain.connect(masterAmb);

    masterAmb.connect(out);
    src.start();

    this.crowdAmbienceSource = src;
    this.crowdAmbienceGain = masterAmb;
    this.crowdAmbienceLowFilter = lowFlt;
    this.crowdAmbienceHighFilter = highFlt;
  }

  public setCrowdExcitement(level: number): void {
    const clamped = Math.max(0, Math.min(1, level));
    this.currentExcitement = clamped;
    if (!this.isStadiumActive) return;
    if (!this.crowdAmbienceSource && this.ctx && this.ctx.state === 'running') {
      this.ensureCrowdAmbienceStarted();
    }
    if (this.ctx && this.crowdAmbienceGain && this.crowdAmbienceLowFilter && this.crowdAmbienceHighFilter) {
      const now = this.ctx.currentTime;
      const targetVol = 0.11 + clamped * 0.28;
      this.crowdAmbienceGain.gain.setTargetAtTime(targetVol, now, 0.16);
      this.crowdAmbienceLowFilter.frequency.setTargetAtTime(420 + clamped * 320, now, 0.18);
      this.crowdAmbienceHighFilter.frequency.setTargetAtTime(1020 + clamped * 680, now, 0.18);
    }
  }

  public startStadiumAtmosphere(): void {
    if (this.isStadiumActive) return;
    this.isStadiumActive = true;
    this.drumStep = 0;
    this.ensureCrowdAmbienceStarted();

    // Batida vibrante de bateria de torcida brasileira (surdo + repique + caixa/palmas em coro)
    const pattern = [1, 0, 1, 2, 0, 1, 2, 3, 1, 0, 2, 1, 0, 2, 3, 4];
    const playDrumStep = () => {
      if (!this.isStadiumActive) return;
      const out = this.getCrowdOutput();
      if (this.muted || !this.ctx || !out || this.ctx.state !== 'running') {
        this.drumStep = (this.drumStep + 1) % pattern.length;
        return;
      }

      if (!this.crowdAmbienceSource) {
        this.ensureCrowdAmbienceStarted();
      }

      const now = this.ctx.currentTime;
      const beat = pattern[this.drumStep];
      const exBoost = 0.85 + this.currentExcitement * 0.55;

      if (beat === 1) {
        // Surdo de arquibancada (grave pulsante)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(94, now);
        osc.frequency.exponentialRampToValueAtTime(44, now + 0.13);
        gain.gain.setValueAtTime(0.135 * exBoost, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(out);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (beat === 2 || beat === 3) {
        // Caixa / palmas ritmadas em coro da arquibancada
        const buf = this.createNoiseBuffer(0.075);
        if (buf) {
          const src = this.ctx.createBufferSource();
          src.buffer = buf;
          const flt = this.ctx.createBiquadFilter();
          flt.type = 'bandpass';
          flt.frequency.value = beat === 3 ? 1950 : 1380;
          flt.Q.value = 1.1;
          const ng = this.ctx.createGain();
          ng.gain.setValueAtTime((beat === 3 ? 0.055 : 0.078) * exBoost, now);
          ng.gain.exponentialRampToValueAtTime(0.001, now + 0.072);
          src.connect(flt);
          flt.connect(ng);
          ng.connect(out);
          src.start(now);
        }
      } else if (beat === 4 && this.currentExcitement > 0.45) {
        // Repique agudo de charanga quando o estádio incendeia!
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(115, now + 0.06);
        gain.gain.setValueAtTime(0.085 * exBoost, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        osc.connect(gain);
        gain.connect(out);
        osc.start(now);
        osc.stop(now + 0.08);
      }

      this.drumStep = (this.drumStep + 1) % pattern.length;
    };

    this.stadiumInterval = window.setInterval(playDrumStep, 180);
  }

  public stopStadiumAtmosphere(): void {
    this.isStadiumActive = false;
    if (this.stadiumInterval !== null) {
      window.clearInterval(this.stadiumInterval);
      this.stadiumInterval = null;
    }
    if (this.crowdAmbienceSource) {
      try {
        this.crowdAmbienceSource.stop();
      } catch {
        // já parada
      }
      this.crowdAmbienceSource = null;
      this.crowdAmbienceGain = null;
      this.crowdAmbienceLowFilter = null;
      this.crowdAmbienceHighFilter = null;
    }
  }

  public playCrowdOoh(): void {
    if (this.muted) return;
    this.unlock();
    const out = this.getCrowdOutput();
    if (!this.ctx || !out) return;
    const now = this.ctx.currentTime;
    const buf = this.createNoiseBuffer(0.95);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(520, now);
    filter.frequency.linearRampToValueAtTime(1020, now + 0.22);
    filter.frequency.linearRampToValueAtTime(420, now + 0.88);
    filter.Q.value = 1.4;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.02, now);
    ng.gain.linearRampToValueAtTime(0.26, now + 0.14);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.92);
    src.connect(filter);
    filter.connect(ng);
    ng.connect(out);
    src.start(now);
  }

  // Grito da torcida com bateria + trompete curto de chamada (100% Web Audio: nunca briga com a narração!)
  public playCrowdChant(_chantPhrase: string, loud = false): void {
    if (this.muted) return;
    this.unlock();
    const out = this.getCrowdOutput();
    if (!this.ctx || !out) return;
    const now = this.ctx.currentTime;

    // Rugido ritmado de coro de arquibancada
    const buf = this.createNoiseBuffer(1.55);
    if (buf) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(680, now);
      filter.frequency.linearRampToValueAtTime(1180, now + 0.45);
      filter.frequency.linearRampToValueAtTime(720, now + 1.48);
      filter.Q.value = 1.15;

      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.01, now);
      ng.gain.linearRampToValueAtTime(loud ? 0.3 : 0.18, now + 0.18);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

      noise.connect(filter);
      filter.connect(ng);
      ng.connect(out);
      noise.start(now);
    }

    // Chamada clássica de trompete da charanga ("TÁ-TÁ-TÁÁÁ!")
    const callNotes = [
      { f: 392.0, t: 0.0, d: 0.13 },
      { f: 392.0, t: 0.16, d: 0.13 },
      { f: 523.25, t: 0.34, d: 0.38 },
    ];
    callNotes.forEach((n) => {
      this.playBrassTone(n.f, now + n.t, n.d, loud ? 0.095 : 0.068, false);
    });

    // 3 batidas de surdo ("TUM-TUM-TÁ!")
    [0, 0.24, 0.48].forEach((offset, idx) => {
      if (!this.ctx || !out) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(idx === 2 ? 148 : 96, now + offset);
      osc.frequency.exponentialRampToValueAtTime(45, now + offset + 0.11);
      gain.gain.setValueAtTime(loud ? 0.26 : 0.17, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now + offset);
      osc.stop(now + offset + 0.13);
    });
  }

  // HINO DO CLUBE EM FANFARRA COMPLETA (Trompetes harmonizados + bateria de charanga + coro de estádio!)
  public playCrowdAnthem(_anthemPhrase: string, melodySeed = 0): void {
    if (this.muted) return;
    this.unlock();
    const out = this.getCrowdOutput();
    if (!this.ctx || !out) return;

    const now = this.ctx.currentTime;
    // Janela curta apenas para narração calma não sobrepor o início do hino (nunca bloqueia lances!)
    this.anthemBusyUntil = Date.now() + 1450;

    // 1. Coro quente e vibrante da torcida cantando em uníssono
    const buf = this.createNoiseBuffer(2.75);
    if (buf) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(620, now);
      filter.frequency.linearRampToValueAtTime(1060, now + 1.1);
      filter.frequency.linearRampToValueAtTime(760, now + 2.65);
      filter.Q.value = 1.0;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.01, now);
      ng.gain.linearRampToValueAtTime(0.26, now + 0.28);
      ng.gain.setValueAtTime(0.22, now + 1.9);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 2.7);
      noise.connect(filter);
      filter.connect(ng);
      ng.connect(out);
      noise.start(now);
    }

    // 2. Melodias festivas de Fanfarra / Charanga de Hino Brasileiro (6 variações ricas)
    const fanfareMelodies: Array<Array<{ f: number; t: number; d: number; harm?: boolean }>> = [
      // Fanfarra Marchinha Clássica 1
      [
        { f: 392.0, t: 0.0, d: 0.18 },
        { f: 523.25, t: 0.2, d: 0.22, harm: true },
        { f: 587.33, t: 0.44, d: 0.18 },
        { f: 659.25, t: 0.64, d: 0.34, harm: true },
        { f: 587.33, t: 1.02, d: 0.18 },
        { f: 659.25, t: 1.22, d: 0.2 },
        { f: 783.99, t: 1.44, d: 0.42, harm: true },
        { f: 659.25, t: 1.9, d: 0.22 },
        { f: 523.25, t: 2.14, d: 0.45, harm: true },
      ],
      // Fanfarra Hinos Tricolores / Heroicos
      [
        { f: 329.63, t: 0.0, d: 0.2 },
        { f: 440.0, t: 0.22, d: 0.24, harm: true },
        { f: 493.88, t: 0.48, d: 0.2 },
        { f: 523.25, t: 0.7, d: 0.34, harm: true },
        { f: 587.33, t: 1.08, d: 0.22 },
        { f: 659.25, t: 1.32, d: 0.34, harm: true },
        { f: 587.33, t: 1.7, d: 0.2 },
        { f: 523.25, t: 1.94, d: 0.52, harm: true },
      ],
      // Fanfarra Ritmo Carioca / Charanga
      [
        { f: 523.25, t: 0.0, d: 0.15 },
        { f: 523.25, t: 0.17, d: 0.15 },
        { f: 659.25, t: 0.34, d: 0.26, harm: true },
        { f: 587.33, t: 0.62, d: 0.18 },
        { f: 523.25, t: 0.82, d: 0.24 },
        { f: 392.0, t: 1.08, d: 0.22 },
        { f: 523.25, t: 1.34, d: 0.22 },
        { f: 659.25, t: 1.58, d: 0.24, harm: true },
        { f: 783.99, t: 1.86, d: 0.58, harm: true },
      ],
      // Fanfarra Alviverde / Marcial
      [
        { f: 293.66, t: 0.0, d: 0.18 },
        { f: 392.0, t: 0.2, d: 0.24, harm: true },
        { f: 493.88, t: 0.46, d: 0.24 },
        { f: 587.33, t: 0.72, d: 0.38, harm: true },
        { f: 493.88, t: 1.14, d: 0.18 },
        { f: 587.33, t: 1.34, d: 0.22 },
        { f: 659.25, t: 1.58, d: 0.32, harm: true },
        { f: 587.33, t: 1.94, d: 0.52, harm: true },
      ],
      // Fanfarra Sul / Imortal
      [
        { f: 349.23, t: 0.0, d: 0.2 },
        { f: 440.0, t: 0.22, d: 0.22, harm: true },
        { f: 523.25, t: 0.46, d: 0.26 },
        { f: 698.46, t: 0.74, d: 0.38, harm: true },
        { f: 659.25, t: 1.16, d: 0.22 },
        { f: 587.33, t: 1.4, d: 0.22 },
        { f: 523.25, t: 1.66, d: 0.26 },
        { f: 698.46, t: 1.96, d: 0.54, harm: true },
      ],
      // Fanfarra Nordeste / Festa
      [
        { f: 392.0, t: 0.0, d: 0.16 },
        { f: 440.0, t: 0.18, d: 0.16 },
        { f: 493.88, t: 0.36, d: 0.2, harm: true },
        { f: 587.33, t: 0.58, d: 0.28 },
        { f: 523.25, t: 0.9, d: 0.22 },
        { f: 493.88, t: 1.14, d: 0.2 },
        { f: 587.33, t: 1.38, d: 0.28, harm: true },
        { f: 783.99, t: 1.72, d: 0.65, harm: true },
      ],
    ];

    const seq = fanfareMelodies[Math.abs(melodySeed) % fanfareMelodies.length];
    seq.forEach((n) => {
      this.playBrassTone(n.f, now + n.t, n.d, 0.088, Boolean(n.harm));
    });

    // 3. Cadência de bumbo/surdo acompanhando a fanfarra
    for (let beat = 0; beat < 6; beat++) {
      const bt = now + beat * 0.42;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(98, bt);
      osc.frequency.exponentialRampToValueAtTime(44, bt + 0.13);
      gain.gain.setValueAtTime(0.18, bt);
      gain.gain.exponentialRampToValueAtTime(0.001, bt + 0.14);
      osc.connect(gain);
      gain.connect(out);
      osc.start(bt);
      osc.stop(bt + 0.15);
    }
  }

  // Provocação de uma torcida para a rival (corneta provocativa + bateria acelerada + vaia/coro, sem brigar com a narração!)
  public playCrowdProvocation(_tauntPhrase: string): void {
    if (this.muted) return;
    this.unlock();
    const out = this.getCrowdOutput();
    if (!this.ctx || !out) return;
    const now = this.ctx.currentTime;

    // Coro de zoeira / provocação oscilante da arquibancada
    const buf = this.createNoiseBuffer(1.35);
    if (buf) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(880, now);
      filter.frequency.linearRampToValueAtTime(510, now + 0.55);
      filter.frequency.linearRampToValueAtTime(960, now + 1.15);
      filter.Q.value = 1.6;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.01, now);
      ng.gain.linearRampToValueAtTime(0.22, now + 0.16);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
      noise.connect(filter);
      filter.connect(ng);
      ng.connect(out);
      noise.start(now);
    }

    // Corneta / trompete de provocação ("TÁ-TÁ-TÁ-TÁ-TÁÁÁ!")
    const tauntHorn = [
      { f: 440.0, t: 0.0, d: 0.12 },
      { f: 493.88, t: 0.14, d: 0.12 },
      { f: 440.0, t: 0.28, d: 0.12 },
      { f: 392.0, t: 0.44, d: 0.34 },
    ];
    tauntHorn.forEach((n) => this.playBrassTone(n.f, now + n.t, n.d, 0.068, false));

    // Batida dupla rápida de zoeira
    [0, 0.18, 0.42].forEach((off, i) => {
      if (!this.ctx || !out) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(i === 1 ? 132 : 88, now + off);
      osc.frequency.exponentialRampToValueAtTime(42, now + off + 0.1);
      gain.gain.setValueAtTime(0.19, now + off);
      gain.gain.exponentialRampToValueAtTime(0.001, now + off + 0.11);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now + off);
      osc.stop(now + off + 0.12);
    });
  }

  public playGoalCheer(): void {
    if (this.muted) return;
    this.unlock();
    const out = this.getCrowdOutput();
    if (!this.ctx || !out) return;
    const now = this.ctx.currentTime;

    // 1. Explosão da arquibancada (crowd roar massivo)
    const buf = this.createNoiseBuffer(3.2);
    if (buf) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(680, now);
      filter.frequency.linearRampToValueAtTime(1520, now + 0.42);
      filter.frequency.linearRampToValueAtTime(840, now + 3.1);
      filter.Q.value = 0.72;

      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.02, now);
      ng.gain.linearRampToValueAtTime(0.48, now + 0.18);
      ng.gain.setValueAtTime(0.38, now + 2.1);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 3.15);

      noise.connect(filter);
      filter.connect(ng);
      ng.connect(out);
      noise.start(now);
    }

    // 2. Grande Fanfarra de Gol estilo transmissão clássica brasileira (Trompetes + Harmonias!)
    const goalFanfare = [
      { f: 523.25, t: 0.0, d: 0.12, h: false },
      { f: 659.25, t: 0.12, d: 0.12, h: false },
      { f: 783.99, t: 0.24, d: 0.14, h: true },
      { f: 1046.5, t: 0.4, d: 0.4, h: true },
      { f: 783.99, t: 0.84, d: 0.13, h: false },
      { f: 880.0, t: 0.99, d: 0.13, h: false },
      { f: 1046.5, t: 1.14, d: 0.72, h: true },
    ];
    goalFanfare.forEach(({ f, t, d, h }) => {
      this.playBrassTone(f, now + t, d, 0.115, h);
    });
  }

  // --- NARRAÇÃO MASCULINA REALISTA EM STREAMING PCM (GEMINI 3.8 FLASH LITE TTS · ZERO ATRASO) ---
  private setNarrationCache(key: string, buffer: AudioBuffer): void {
    if (this.narrationCache.has(key)) {
      this.narrationCache.delete(key);
    } else if (this.narrationCache.size >= MAX_CLIENT_NARRATION_CACHE) {
      const oldest = this.narrationCache.keys().next().value;
      if (oldest !== undefined) {
        this.narrationCache.delete(oldest);
      }
    }
    this.narrationCache.set(key, buffer);
  }

  private pcm16ToAudioBuffer(pcmBytes: Uint8Array, sampleRate = STREAM_PCM_SAMPLE_RATE): AudioBuffer | null {
    if (!this.ctx) return null;
    const sampleCount = Math.floor(pcmBytes.byteLength / 2);
    if (sampleCount <= 0) return null;
    const audioBuffer = this.ctx.createBuffer(1, sampleCount, sampleRate);
    const channel = audioBuffer.getChannelData(0);
    const view = new DataView(pcmBytes.buffer, pcmBytes.byteOffset, sampleCount * 2);
    for (let i = 0; i < sampleCount; i++) {
      channel[i] = view.getInt16(i * 2, true) / 32768;
    }
    return audioBuffer;
  }

  private getSpeakerVoiceShaping(speaker: BroadcastSpeaker | 'duo'): {
    playbackRate: number;
    eqType: BiquadFilterType;
    eqFreq: number;
    eqGain: number;
    eqQ: number;
    warmBassGain: number;
  } {
    if (speaker === 'duo') {
      // Diálogo em dupla (Fenrir + Charon/Puck): leve aprofundamento + corpo grave para manter ambos 100% masculinos
      return { playbackRate: 0.96, eqType: 'peaking', eqFreq: 1350, eqGain: 1.4, eqQ: 0.85, warmBassGain: 2.4 };
    }
    if (speaker === 'neto') {
      // Puck aprofundado: timbre masculino encorpado e rasgado com punch médio (jamais acelerado ou agudo!)
      return { playbackRate: 0.94, eqType: 'peaking', eqFreq: 1650, eqGain: 3.0, eqQ: 1.0, warmBassGain: 3.4 };
    }
    if (speaker === 'casagrande') {
      // Charon grave, quente e encorpado estilo Walter Casagrande
      return { playbackRate: 0.93, eqType: 'lowshelf', eqFreq: 190, eqGain: 3.6, eqQ: 0.85, warmBassGain: 0 };
    }
    if (speaker === 'ronaldo') {
      // Puck aprofundado com corpo grave caloroso de barítono masculino estilo Ronaldo Fenômeno
      return { playbackRate: 0.91, eqType: 'lowshelf', eqFreq: 210, eqGain: 3.6, eqQ: 0.85, warmBassGain: 1.6 };
    }
    // Galvão Bueno (Fenrir): microfone clássico de transmissão de TV com corpo barítono-grave e presença dramática
    return { playbackRate: 0.97, eqType: 'peaking', eqFreq: 1300, eqGain: 1.8, eqQ: 0.9, warmBassGain: 1.4 };
  }

  private playNarrationBuffer(
    buffer: AudioBuffer,
    mood: NarrationMood,
    speaker: BroadcastSpeaker | 'duo' = 'galvao',
    onEnd?: () => void
  ): void {
    if (this.muted || !this.ctx || !this.narratorBusGain) {
      onEnd?.();
      return;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    this.stopActiveNarratorSource(0.025);

    const shaping = this.getSpeakerVoiceShaping(speaker);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.setValueAtTime(shaping.playbackRate, this.ctx.currentTime);

    const eq = this.ctx.createBiquadFilter();
    eq.type = shaping.eqType;
    eq.frequency.setValueAtTime(shaping.eqFreq, this.ctx.currentTime);
    eq.gain.setValueAtTime(shaping.eqGain, this.ctx.currentTime);
    eq.Q.setValueAtTime(shaping.eqQ, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    const vol = mood === 'goal' ? 1.12 : mood === 'excited' ? 1.04 : 0.96;
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);

    if (shaping.warmBassGain > 0) {
      const bassBody = this.ctx.createBiquadFilter();
      bassBody.type = 'lowshelf';
      bassBody.frequency.setValueAtTime(195, this.ctx.currentTime);
      bassBody.gain.setValueAtTime(shaping.warmBassGain, this.ctx.currentTime);
      src.connect(bassBody);
      bassBody.connect(eq);
    } else {
      src.connect(eq);
    }
    eq.connect(gain);
    gain.connect(this.narratorBusGain);

    this.activeNarratorSources = [src];
    this.activeNarratorGain = gain;
    this.isNarratorSpeaking = true;
    const effectiveDurSec = buffer.duration / shaping.playbackRate;
    this.narratorSpeakingUntilMs = Date.now() + Math.ceil(effectiveDurSec * 1000) + 360;

    this.duckBackgroundForVoice();

    src.onended = () => {
      if (this.activeNarratorGain === gain) {
        this.activeNarratorSources = [];
        this.activeNarratorGain = null;
        this.isNarratorSpeaking = false;
        this.narratorSpeakingUntilMs = 0;
        this.restoreCrowdVolume();
      }
      onEnd?.();
    };

    src.start();
  }

  // Sintetizador vocal 100% MASCULINO (Barítono/Grave Web Audio) para garantir que a cabine NUNCA fique muda nem use voz feminina quando offline/sem cota!
  private speakProceduralMaleVoice(
    cleanText: string,
    mood: NarrationMood,
    speaker: BroadcastSpeaker,
    seq: number,
    onEnd?: () => void
  ): void {
    if (this.muted || seq !== this.narrationSeq || !this.ctx || !this.narratorBusGain) {
      onEnd?.();
      return;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    this.stopActiveNarratorSource(0.02);

    // Frequências fundamentais estritamente masculinas (95Hz a 132Hz = registro grave/barítono adulto)
    const basePitchHz =
      speaker === 'casagrande'
        ? 96
        : speaker === 'ronaldo'
          ? 112
          : speaker === 'neto'
            ? 126
            : mood === 'goal'
              ? 134
              : 118;

    const words = cleanText
      .replace(/[^\p{L}\p{N}\s!?.]/gu, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 26);

    if (words.length === 0) {
      onEnd?.();
      return;
    }

    const now = this.ctx.currentTime + 0.01;
    const uttGain = this.ctx.createGain();
    uttGain.gain.setValueAtTime(mood === 'goal' ? 0.85 : 0.72, now);
    uttGain.connect(this.narratorBusGain);

    this.activeNarratorGain = uttGain;
    this.activeNarratorSources = [];
    this.isNarratorSpeaking = true;
    this.duckBackgroundForVoice();

    // Formantes vocais masculinos de cabine de rádio/TV (peito grave + faringe + articulação)
    const vowelPresets = [
      { f1: 710, f2: 1150 }, // A
      { f1: 520, f2: 1720 }, // E
      { f1: 310, f2: 2080 }, // I
      { f1: 470, f2: 880 },  // O
      { f1: 340, f2: 720 },  // U
    ];

    let cursor = now;
    const syllableDur = mood === 'goal' ? 0.095 : mood === 'excited' ? 0.075 : 0.082;
    let lastOsc: OscillatorNode | null = null;

    words.forEach((word, wIdx) => {
      const syllables = Math.max(1, Math.min(4, Math.ceil(word.length / 2.6)));
      const isExclaim = /!|GOL|TRAVE|BOMBA|PÃO|BRINCADEIRA/i.test(word);

      for (let s = 0; s < syllables; s++) {
        if (!this.ctx) break;
        const charCode = word.charCodeAt(Math.min(word.length - 1, s * 2)) || 65;
        const preset = vowelPresets[(charCode + wIdx + s) % vowelPresets.length];
        const dur = isExclaim && s === syllables - 1 ? syllableDur * 1.65 : syllableDur;

        const osc = this.ctx.createOscillator();
        const subOsc = this.ctx.createOscillator();
        const f1Filter = this.ctx.createBiquadFilter();
        const f2Filter = this.ctx.createBiquadFilter();
        const sylGain = this.ctx.createGain();

        // Cordas vocais barítono (sawtooth rico em harmônicos + sub-oitava grave de peito)
        osc.type = 'sawtooth';
        subOsc.type = 'triangle';

        const accentMult = isExclaim ? 1.16 : s === 0 ? 1.06 : 0.97;
        const contour = 1 + Math.sin((wIdx * 3 + s) * 0.9) * 0.06;
        const f0 = basePitchHz * accentMult * contour;

        osc.frequency.setValueAtTime(f0, cursor);
        osc.frequency.linearRampToValueAtTime(f0 * (isExclaim ? 1.08 : 0.94), cursor + dur);
        subOsc.frequency.setValueAtTime(f0 * 0.5, cursor);

        f1Filter.type = 'bandpass';
        f1Filter.frequency.setValueAtTime(preset.f1, cursor);
        f1Filter.Q.setValueAtTime(3.2, cursor);

        f2Filter.type = 'peaking';
        f2Filter.frequency.setValueAtTime(preset.f2, cursor);
        f2Filter.gain.setValueAtTime(7.5, cursor);
        f2Filter.Q.setValueAtTime(2.4, cursor);

        sylGain.gain.setValueAtTime(0.001, cursor);
        sylGain.gain.linearRampToValueAtTime(0.42, cursor + 0.014);
        sylGain.gain.setValueAtTime(0.36, cursor + Math.max(0.018, dur - 0.018));
        sylGain.gain.exponentialRampToValueAtTime(0.001, cursor + dur);

        osc.connect(f1Filter);
        subOsc.connect(f1Filter);
        f1Filter.connect(f2Filter);
        f2Filter.connect(sylGain);
        sylGain.connect(uttGain);

        osc.start(cursor);
        subOsc.start(cursor);
        osc.stop(cursor + dur + 0.01);
        subOsc.stop(cursor + dur + 0.01);

        lastOsc = osc;
        cursor += dur + 0.012;
      }
      cursor += 0.032; // pausa natural entre palavras
    });

    const totalMs = Math.ceil((cursor - now) * 1000) + 220;
    this.narratorSpeakingUntilMs = Date.now() + totalMs;

    if (lastOsc) {
      (lastOsc as OscillatorNode).onended = () => {
        if (this.activeNarratorGain === uttGain) {
          this.activeNarratorSources = [];
          this.activeNarratorGain = null;
          this.isNarratorSpeaking = false;
          this.narratorSpeakingUntilMs = 0;
          this.restoreCrowdVolume();
        }
        onEnd?.();
      };
    } else {
      this.isNarratorSpeaking = false;
      this.narratorSpeakingUntilMs = 0;
      this.restoreCrowdVolume();
      onEnd?.();
    }
  }

  // Reserva offline estritamente masculina: usa voz masculina PT do sistema (se confirmada) ou o sintetizador vocal masculino de cabine (NUNCA fica mudo e NUNCA usa voz feminina!)
  private speakBrowserFallback(
    cleanText: string,
    mood: NarrationMood,
    speaker: BroadcastSpeaker,
    seq: number,
    onEnd?: () => void
  ): void {
    if (this.muted || seq !== this.narrationSeq) {
      onEnd?.();
      return;
    }
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.speakProceduralMaleVoice(cleanText, mood, speaker, seq, onEnd);
      return;
    }
    try {
      const synth = window.speechSynthesis;
      const voices = synth.getVoices();
      const ptVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('pt'));

      // Filtro duplo: remove qualquer voz feminina/genérica e exige confirmação positiva de voz masculina
      const confirmedMaleVoice = ptVoices.find(
        (v) => !FEMALE_OR_AMBIGUOUS_VOICE_RE.test(v.name) && CONFIRMED_MALE_PT_VOICE_RE.test(v.name)
      );

      // Se o dispositivo não possui voz masculina confirmada no navegador, aciona o sintetizador vocal masculino de cabine (100% masculino e nunca deixa o jogo sem voz!)
      if (!confirmedMaleVoice) {
        this.speakProceduralMaleVoice(cleanText, mood, speaker, seq, onEnd);
        return;
      }

      synth.cancel();
      const utt = new SpeechSynthesisUtterance(cleanText);
      utt.lang = confirmedMaleVoice.lang || 'pt-BR';
      utt.voice = confirmedMaleVoice;
      if (speaker === 'casagrande') {
        utt.pitch = 0.72;
        utt.rate = 1.0;
      } else if (speaker === 'ronaldo') {
        utt.pitch = 0.84;
        utt.rate = 1.05;
      } else if (speaker === 'neto') {
        utt.pitch = 0.88;
        utt.rate = 1.12;
      } else {
        utt.pitch = mood === 'goal' ? 0.88 : 0.8;
        utt.rate = mood === 'goal' ? 1.14 : mood === 'excited' ? 1.1 : 1.05;
      }
      utt.volume = 0.95;

      this.isNarratorSpeaking = true;
      const estMs = Math.max(1100, Math.min(4800, cleanText.length * 62));
      this.narratorSpeakingUntilMs = Date.now() + estMs;
      this.duckBackgroundForVoice();

      const finish = () => {
        if (seq === this.narrationSeq) {
          this.isNarratorSpeaking = false;
          this.narratorSpeakingUntilMs = 0;
          this.restoreCrowdVolume();
        }
        onEnd?.();
      };
      utt.onend = finish;
      utt.onerror = finish;
      synth.speak(utt);
    } catch {
      this.speakProceduralMaleVoice(cleanText, mood, speaker, seq, onEnd);
    }
  }

  // Streaming progressivo de PCM 24kHz (gemini-3.8-flash-tts Voice Design) com retry rápido antes de fallback offline
  private async streamAndPlayNarration(
    cleanText: string,
    mood: NarrationMood,
    speaker: BroadcastSpeaker,
    priority: 'high' | 'normal',
    seq: number,
    reqStartMs: number,
    signal: AbortSignal,
    onStateChange?: (state: 'loading' | 'playing' | 'idle') => void
  ): Promise<void> {
    if (!this.ctx || !this.narratorBusGain) {
      onStateChange?.('idle');
      return;
    }
    const cacheKey = `${speaker}::${mood}::${cleanText.toLowerCase()}`;

    const shaping = this.getSpeakerVoiceShaping(speaker);
    let utteranceGain: GainNode | null = null;
    let utteranceInputNode: AudioNode | null = null;
    let startedPlayback = false;
    let lastScheduledSource: AudioBufferSourceNode | null = null;
    let nextStartTime = 0;

    try {
      onStateChange?.('loading');
      const res = await fetch('/api/narrate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, mood, speaker }),
        signal,
      });

      const quotaExhausted =
        res.status === 204 ||
        res.status === 429 ||
        res.headers.get('X-Narration-Quota') === 'EXHAUSTED';

      if (!res.ok || quotaExhausted || !res.body) {
        this.narrationErrorCount++;
        if (quotaExhausted) {
          this.narrationCooldownUntil = Date.now() + 4_500;
        } else if (res.status >= 500 || res.status === 503) {
          this.narrationCooldownUntil = Date.now() + Math.min(4000, 1000 * this.narrationErrorCount);
        }
        onStateChange?.('playing');
        this.speakBrowserFallback(cleanText, mood, speaker, seq, () => onStateChange?.('idle'));
        return;
      }
      const sampleRate = Number(res.headers.get('X-Sample-Rate') || STREAM_PCM_SAMPLE_RATE);
      const reader = res.body.getReader();

      let leftoverByte: number | null = null;
      const allChunks: Uint8Array[] = [];
      let totalBytes = 0;

      const ensureUtteranceStarted = (): boolean => {
        if (startedPlayback) return true;
        if (this.muted || seq !== this.narrationSeq || !this.ctx || !this.narratorBusGain) {
          return false;
        }
        // Tolerância de 5.5s para acomodar Voice Design mais rico sem descartar frases boas
        if (priority === 'normal' && Date.now() - reqStartMs > 5500) {
          return false;
        }
        if (priority === 'normal' && mood === 'calm' && Date.now() < this.anthemBusyUntil) {
          return false;
        }
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        this.stopActiveNarratorSource(0.02);
        const utteranceEq = this.ctx.createBiquadFilter();
        utteranceEq.type = shaping.eqType;
        utteranceEq.frequency.setValueAtTime(shaping.eqFreq, this.ctx.currentTime);
        utteranceEq.gain.setValueAtTime(shaping.eqGain, this.ctx.currentTime);
        utteranceEq.Q.setValueAtTime(shaping.eqQ, this.ctx.currentTime);

        if (shaping.warmBassGain > 0) {
          const bassBody = this.ctx.createBiquadFilter();
          bassBody.type = 'lowshelf';
          bassBody.frequency.setValueAtTime(195, this.ctx.currentTime);
          bassBody.gain.setValueAtTime(shaping.warmBassGain, this.ctx.currentTime);
          bassBody.connect(utteranceEq);
          utteranceInputNode = bassBody;
        } else {
          utteranceInputNode = utteranceEq;
        }

        utteranceGain = this.ctx.createGain();
        const vol = mood === 'goal' ? 1.12 : mood === 'excited' ? 1.04 : 0.96;
        utteranceGain.gain.setValueAtTime(vol, this.ctx.currentTime);
        utteranceEq.connect(utteranceGain);
        utteranceGain.connect(this.narratorBusGain);

        this.activeNarratorGain = utteranceGain;
        this.activeNarratorSources = [];
        this.isNarratorSpeaking = true;
        this.narratorSpeakingUntilMs = Date.now() + 3000;
        nextStartTime = this.ctx.currentTime + 0.015;
        startedPlayback = true;
        onStateChange?.('playing');

        this.duckBackgroundForVoice();
        return true;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || value.byteLength === 0) continue;
        if (this.muted || seq !== this.narrationSeq || !this.ctx) {
          try {
            await reader.cancel();
          } catch {
            // ignore
          }
          onStateChange?.('idle');
          return;
        }

        let bytes = value;
        if (leftoverByte !== null) {
          const merged = new Uint8Array(value.byteLength + 1);
          merged[0] = leftoverByte;
          merged.set(value, 1);
          bytes = merged;
          leftoverByte = null;
        }
        if (bytes.byteLength % 2 === 1) {
          leftoverByte = bytes[bytes.byteLength - 1];
          bytes = bytes.subarray(0, bytes.byteLength - 1);
        }
        if (bytes.byteLength < 2) continue;

        allChunks.push(bytes);
        totalBytes += bytes.byteLength;

        if (!ensureUtteranceStarted() || !utteranceGain || !utteranceInputNode || !this.ctx) {
          try {
            await reader.cancel();
          } catch {
            // ignore
          }
          onStateChange?.('idle');
          return;
        }

        const chunkBuf = this.pcm16ToAudioBuffer(bytes, sampleRate);
        if (!chunkBuf) continue;

        const src = this.ctx.createBufferSource();
        src.buffer = chunkBuf;
        src.playbackRate.setValueAtTime(shaping.playbackRate, this.ctx.currentTime);
        src.connect(utteranceInputNode);

        const playAt = Math.max(this.ctx.currentTime + 0.008, nextStartTime);
        src.start(playAt);
        nextStartTime = playAt + chunkBuf.duration / shaping.playbackRate;

        const remainingMs = Math.max(300, (nextStartTime - this.ctx.currentTime) * 1000);
        this.narratorSpeakingUntilMs = Date.now() + remainingMs + 360;

        this.activeNarratorSources.push(src);
        lastScheduledSource = src;
      }

      if (totalBytes < 64 && !signal.aborted && seq === this.narrationSeq) {
        onStateChange?.('playing');
        this.speakBrowserFallback(cleanText, mood, speaker, seq, () => onStateChange?.('idle'));
        return;
      }

      this.narrationErrorCount = 0;
      this.narrationCooldownUntil = 0;

      if (lastScheduledSource && utteranceGain) {
        const capturedGain = utteranceGain;
        lastScheduledSource.onended = () => {
          if (this.activeNarratorGain === capturedGain) {
            this.activeNarratorSources = [];
            this.activeNarratorGain = null;
            this.isNarratorSpeaking = false;
            this.narratorSpeakingUntilMs = 0;
            this.restoreCrowdVolume();
          }
          onStateChange?.('idle');
        };
      } else {
        onStateChange?.('idle');
      }

      if (totalBytes >= 64) {
        const combined = new Uint8Array(totalBytes);
        let offset = 0;
        for (const c of allChunks) {
          combined.set(c, offset);
          offset += c.byteLength;
        }
        const fullBuf = this.pcm16ToAudioBuffer(combined, sampleRate);
        if (fullBuf) {
          this.setNarrationCache(cacheKey, fullBuf);
        }
      }
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        this.narrationErrorCount++;
        if (seq === this.narrationSeq) {
          onStateChange?.('playing');
          this.speakBrowserFallback(cleanText, mood, speaker, seq, () => onStateChange?.('idle'));
          return;
        }
      }
      onStateChange?.('idle');
    } finally {
      if (startedPlayback && !lastScheduledSource && this.activeNarratorGain === utteranceGain) {
        this.activeNarratorSources = [];
        this.activeNarratorGain = null;
        this.isNarratorSpeaking = false;
        this.narratorSpeakingUntilMs = 0;
        this.restoreCrowdVolume();
        onStateChange?.('idle');
      }
    }
  }

  private async fetchNarrationForPrefetch(
    phrase: string,
    mood: NarrationMood,
    speaker: BroadcastSpeaker = 'galvao'
  ): Promise<AudioBuffer | null> {
    const cleanText = phrase.trim().slice(0, 220);
    if (!cleanText || !this.ctx) return null;
    const cacheKey = `${speaker}::${mood}::${cleanText.toLowerCase()}`;
    if (this.narrationCache.has(cacheKey)) return this.narrationCache.get(cacheKey) ?? null;

    const existing = this.narrationInFlight.get(cacheKey);
    if (existing) return existing;

    const promise = (async (): Promise<AudioBuffer | null> => {
      try {
        const res = await fetch('/api/narrate/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanText, mood, speaker }),
        });
        if (!res.ok) return null;
        const sampleRate = Number(res.headers.get('X-Sample-Rate') || STREAM_PCM_SAMPLE_RATE);
        const ab = await res.arrayBuffer();
        if (ab.byteLength < 64) return null;
        const buf = this.pcm16ToAudioBuffer(new Uint8Array(ab), sampleRate);
        if (buf) this.setNarrationCache(cacheKey, buf);
        return buf;
      } catch {
        return null;
      } finally {
        this.narrationInFlight.delete(cacheKey);
      }
    })();

    this.narrationInFlight.set(cacheKey, promise);
    return promise;
  }

  // Pré-aquece frases recorrentes da partida em segundo plano para resposta instantânea (0ms)
  public prefetchNarration(
    items: Array<{ phrase: string; mood: NarrationMood; speaker?: BroadcastSpeaker }>
  ): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;

    void (async () => {
      for (const item of items) {
        if (this.muted || Date.now() < this.narrationCooldownUntil) break;
        await this.fetchNarrationForPrefetch(item.phrase, item.mood, item.speaker ?? 'galvao');
        await new Promise((r) => setTimeout(r, 150));
      }
    })();
  }

  public narrate(
    phrase: string,
    priority: 'high' | 'normal' = 'normal',
    mood: NarrationMood = 'calm',
    speaker: BroadcastSpeaker = 'galvao'
  ): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;

    const cleanText = phrase.trim().slice(0, 220);
    if (!cleanText) return;

    const nowMs = Date.now();
    // Watchdog: se a flag de fala passou do tempo previsto (ex: stream interrompido), destrava na hora!
    if (this.isNarratorSpeaking && this.narratorSpeakingUntilMs > 0 && nowMs > this.narratorSpeakingUntilMs) {
      this.isNarratorSpeaking = false;
      this.narratorSpeakingUntilMs = 0;
      this.restoreCrowdVolume();
    }

    // Acerto instantâneo em cache (0ms de atraso — funciona mesmo durante cooldown de cota!)
    const cacheKey = `${speaker}::${mood}::${cleanText.toLowerCase()}`;
    const cached = this.narrationCache.get(cacheKey);
    if (cached) {
      if (priority === 'high') {
        if (this.activeNarrationAbort) {
          this.activeNarrationAbort.abort();
        }
        this.stopActiveNarratorSource(0.02);
      } else if (this.isNarratorSpeaking) {
        return;
      }
      this.lastSpeechTime = nowMs;
      if (priority === 'high') this.lastHighSpeechTime = nowMs;
      this.narrationCache.delete(cacheKey);
      this.narrationCache.set(cacheKey, cached);
      this.playNarrationBuffer(cached, mood, speaker);
      return;
    }

    if (nowMs < this.narrationCooldownUntil && mood !== 'goal') {
      // Durante breve cooldown, aciona imediatamente a voz masculina de reserva para a cabine continuar narrando sem parar!
      if (priority === 'high' || !this.isNarratorSpeaking) {
        const seqFallback = ++this.narrationSeq;
        this.lastSpeechTime = nowMs;
        this.speakBrowserFallback(cleanText, mood, speaker, seqFallback);
      }
      return;
    }

    if (priority === 'normal') {
      if (mood === 'calm' && nowMs < this.anthemBusyUntil) return;
      if (nowMs - this.lastSpeechTime < 900) return;
      if (this.isNarratorSpeaking) return;
    } else {
      if (mood !== 'goal' && nowMs - this.lastHighSpeechTime < 650) return;
      this.lastHighSpeechTime = nowMs;
    }
    this.lastSpeechTime = nowMs;

    const seq = ++this.narrationSeq;

    if (priority === 'high') {
      if (this.activeNarrationAbort) {
        this.activeNarrationAbort.abort();
      }
      this.stopActiveNarratorSource(0.02);
    }

    const controller = new AbortController();
    this.activeNarrationAbort = controller;

    void this.streamAndPlayNarration(cleanText, mood, speaker, priority, seq, nowMs, controller.signal);
  }

  // Diálogo real de 2 vozes na cabine (Galvão + Casagrande / Ronaldo / Craque Neto via multiSpeakerVoiceConfig)
  public narrateDialogue(
    turns: DialogueTurn[],
    priority: 'high' | 'normal' = 'high',
    mood: NarrationMood = 'excited',
    onStateChange?: (state: 'loading' | 'playing' | 'idle') => void
  ): void {
    if (this.muted) {
      onStateChange?.('idle');
      return;
    }
    this.unlock();
    if (!this.ctx) {
      onStateChange?.('idle');
      return;
    }

    const cleanTurns = turns
      .map((t) => ({ speaker: t.speaker, text: t.text.trim().slice(0, 200) }))
      .filter((t) => t.text.length > 0);
    if (cleanTurns.length === 0) {
      onStateChange?.('idle');
      return;
    }

    const nowMs = Date.now();
    if (this.isNarratorSpeaking && this.narratorSpeakingUntilMs > 0 && nowMs > this.narratorSpeakingUntilMs) {
      this.isNarratorSpeaking = false;
      this.narratorSpeakingUntilMs = 0;
      this.restoreCrowdVolume();
    }

    const fallbackSequential = (seq: number) => {
      onStateChange?.('playing');
      const speakIdx = (i: number) => {
        if (i >= cleanTurns.length || seq !== this.narrationSeq || this.muted) {
          onStateChange?.('idle');
          return;
        }
        const turn = cleanTurns[i];
        this.speakBrowserFallback(turn.text, mood, turn.speaker, seq, () => speakIdx(i + 1));
      };
      speakIdx(0);
    };

    const cacheKey = `duo::${mood}::${cleanTurns
      .map((t) => `${t.speaker}:${t.text.toLowerCase()}`)
      .join('|')}`;
    const cached = this.narrationCache.get(cacheKey);
    if (cached) {
      if (this.activeNarrationAbort) {
        this.activeNarrationAbort.abort();
      }
      this.stopActiveNarratorSource(0.02);
      this.lastSpeechTime = nowMs;
      if (priority === 'high') this.lastHighSpeechTime = nowMs;
      this.narrationCache.delete(cacheKey);
      this.narrationCache.set(cacheKey, cached);
      onStateChange?.('playing');
      this.playNarrationBuffer(cached, mood, 'duo', () => onStateChange?.('idle'));
      return;
    }

    if (nowMs < this.narrationCooldownUntil) {
      const seqFb = ++this.narrationSeq;
      this.lastSpeechTime = nowMs;
      fallbackSequential(seqFb);
      return;
    }

    if (priority === 'normal' && this.isNarratorSpeaking) {
      onStateChange?.('idle');
      return;
    }

    this.lastSpeechTime = nowMs;
    if (priority === 'high') this.lastHighSpeechTime = nowMs;

    const seq = ++this.narrationSeq;
    if (this.activeNarrationAbort) {
      this.activeNarrationAbort.abort();
    }
    this.stopActiveNarratorSource(0.02);

    const controller = new AbortController();
    this.activeNarrationAbort = controller;
    onStateChange?.('loading');

    void (async () => {
      try {
        const res = await fetch('/api/narrate/dialogue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ turns: cleanTurns, mood }),
          signal: controller.signal,
        });

        const quotaExhausted =
          res.status === 204 ||
          res.status === 429 ||
          res.headers.get('X-Narration-Quota') === 'EXHAUSTED';

        if (!res.ok || quotaExhausted || !this.ctx || seq !== this.narrationSeq || this.muted) {
          if (quotaExhausted) {
            this.narrationCooldownUntil = Date.now() + 4_500;
          }
          if (seq === this.narrationSeq && !this.muted && !controller.signal.aborted) {
            this.narrationErrorCount++;
            fallbackSequential(seq);
          } else {
            onStateChange?.('idle');
          }
          return;
        }

        const wavAb = await res.arrayBuffer();
        if (wavAb.byteLength < 64 || !this.ctx || seq !== this.narrationSeq || this.muted) {
          if (seq === this.narrationSeq && !this.muted && !controller.signal.aborted) {
            fallbackSequential(seq);
          } else {
            onStateChange?.('idle');
          }
          return;
        }

        const audioBuffer = await this.ctx.decodeAudioData(wavAb.slice(0));
        this.narrationErrorCount = 0;
        this.narrationCooldownUntil = 0;
        this.setNarrationCache(cacheKey, audioBuffer);

        if (seq !== this.narrationSeq || this.muted) {
          onStateChange?.('idle');
          return;
        }
        onStateChange?.('playing');
        this.playNarrationBuffer(audioBuffer, mood, 'duo', () => onStateChange?.('idle'));
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError' && seq === this.narrationSeq && !this.muted) {
          this.narrationErrorCount++;
          fallbackSequential(seq);
          return;
        }
        onStateChange?.('idle');
      }
    })();
  }

  // Prévia interativa na Tela Inicial para testar cada integrante da cabine e o bate-bola ao vivo!
  public previewBoothVoice(
    target: BroadcastSpeaker | 'duo',
    onStateChange?: (state: 'loading' | 'playing' | 'idle') => void
  ): void {
    if (this.muted) {
      onStateChange?.('idle');
      return;
    }
    this.unlock();
    if (!this.ctx) {
      onStateChange?.('idle');
      return;
    }

    if (target === 'duo') {
      this.narrateDialogue(
        [
          {
            speaker: 'galvao',
            text: 'Bem, amigos da Rede Efatá! Haja coração! Olha o golaço que saiu agora no Efatá Soccer 26!',
          },
          {
            speaker: 'neto',
            text: 'Pão! Você tá de brincadeira, Galvão?! Diga-se de passagem, que pintura absurda na gaveta!',
          },
        ],
        'high',
        'excited',
        onStateChange
      );
      return;
    }

    const sampleBySpeaker: Record<BroadcastSpeaker, { phrase: string; mood: NarrationMood }> = {
      galvao: {
        phrase:
          'Bem, amigos da Rede Efatá! Olha o gol, olha o gol, GOOOOOOL! Haja coração no Efatá Soccer 26!',
        mood: 'goal',
      },
      casagrande: {
        phrase:
          'Fala, Galvão! Que bela jogada de ataque! O camisa nove atacou o espaço com personalidade e guardou pro fundo da rede!',
        mood: 'excited',
      },
      ronaldo: {
        phrase:
          'Fenomenal, Galvão! Que categoria pra tirar do goleiro! Como centroavante eu bato palmas, bola onde a coruja dorme!',
        mood: 'excited',
      },
      neto: {
        phrase:
          'Ô Galvão, você tá de brincadeira?! Baita golaço espetacular! Diga-se de passagem, nem dois goleiros pegavam essa bola!',
        mood: 'excited',
      },
    };

    const sample = sampleBySpeaker[target];
    const seq = ++this.narrationSeq;
    if (this.activeNarrationAbort) {
      this.activeNarrationAbort.abort();
    }
    this.stopActiveNarratorSource(0.02);

    const cacheKey = `${target}::${sample.mood}::${sample.phrase.toLowerCase()}`;
    const cached = this.narrationCache.get(cacheKey);
    if (cached) {
      onStateChange?.('playing');
      this.playNarrationBuffer(cached, sample.mood, target, () => onStateChange?.('idle'));
      return;
    }

    const controller = new AbortController();
    this.activeNarrationAbort = controller;
    void this.streamAndPlayNarration(
      sample.phrase,
      sample.mood,
      target,
      'high',
      seq,
      Date.now(),
      controller.signal,
      onStateChange
    );
  }

  // --- TRILHA SONORA BRASILEIRA DE ABERTURA: "PAÍS DO FUTEBOL" & "MÚSICA DA COPA" ---
  public getMenuMusicTrack(): MusicTrack {
    return this.currentMusicTrack;
  }

  public setMenuMusicTrack(track: MusicTrack): void {
    const changed = this.currentMusicTrack !== track;
    this.currentMusicTrack = track;
    if (this.isMenuMusicPlaying && changed) {
      this.stopMenuMusic(0.05);
      this.startMenuMusic(track);
    }
  }

  public toggleMenuMusicTrack(): MusicTrack {
    const next: MusicTrack =
      this.currentMusicTrack === 'pais_do_futebol' ? 'musica_da_copa' : 'pais_do_futebol';
    this.setMenuMusicTrack(next);
    return next;
  }

  private playMusicBrass(
    freq: number,
    startTime: number,
    duration: number,
    volume: number,
    harmony = false
  ): void {
    const out = this.musicBusGain ?? this.masterGain;
    if (!this.ctx || !out) return;
    const voice = (f: number, vol: number, detune: number) => {
      if (!this.ctx || !out) return;
      const osc = this.ctx.createOscillator();
      const flt = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, startTime);
      osc.detune.setValueAtTime(detune, startTime);
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(750, startTime);
      flt.frequency.exponentialRampToValueAtTime(2800, startTime + Math.min(0.045, duration * 0.3));
      flt.frequency.exponentialRampToValueAtTime(1250, startTime + duration);
      flt.Q.value = 1.6;
      g.gain.setValueAtTime(0.001, startTime);
      g.gain.linearRampToValueAtTime(vol, startTime + 0.018);
      g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.connect(flt);
      flt.connect(g);
      g.connect(out);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.02);
    };
    voice(freq, volume, -5);
    voice(freq, volume * 0.65, 6);
    if (harmony) {
      voice(freq * 1.2599, volume * 0.42, 2); // terça maior festiva
    }
  }

  private playMusicKick(startTime: number, volume = 0.24, subEndFreq = 42): void {
    const out = this.musicBusGain ?? this.masterGain;
    if (!this.ctx || !out) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(128, startTime);
    osc.frequency.exponentialRampToValueAtTime(subEndFreq, startTime + 0.13);
    g.gain.setValueAtTime(volume, startTime);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + 0.16);
    osc.connect(g);
    g.connect(out);
    osc.start(startTime);
    osc.stop(startTime + 0.17);
  }

  private playMusicPerc(startTime: number, freq: number, dur: number, volume: number, q = 1.4): void {
    const out = this.musicBusGain ?? this.masterGain;
    if (!this.ctx || !out) return;
    const buf = this.createNoiseBuffer(dur);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.value = freq;
    flt.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(volume, startTime);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(out);
    src.start(startTime);
  }

  private ensureMp3Audio(): HTMLAudioElement | null {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
    if (!this.mp3Audio) {
      const audio = new Audio(PAIS_DO_FUTEBOL_MP3_URL);
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = 0;
      audio.muted = this.muted;
      this.mp3Audio = audio;
    }
    return this.mp3Audio;
  }

  private clearMp3Fade(): void {
    if (this.mp3FadeInterval !== null) {
      window.clearInterval(this.mp3FadeInterval);
      this.mp3FadeInterval = null;
    }
  }

  private rampMp3Volume(targetVol: number, durationSec: number, pauseAtEnd: boolean): void {
    const audio = this.mp3Audio;
    if (!audio) return;
    this.clearMp3Fade();

    const clampedTarget = Math.max(0, Math.min(1, this.muted ? 0 : targetVol));
    if (durationSec <= 0.02) {
      audio.volume = clampedTarget;
      if (pauseAtEnd) {
        audio.pause();
      }
      return;
    }

    const startVol = audio.volume;
    const steps = Math.max(4, Math.round(durationSec * 40));
    let currentStep = 0;
    const stepMs = Math.max(12, Math.round((durationSec * 1000) / steps));

    this.mp3FadeInterval = window.setInterval(() => {
      currentStep++;
      const t = Math.min(1, currentStep / steps);
      audio.volume = Math.max(0, Math.min(1, startVol + (clampedTarget - startVol) * t));
      if (t >= 1) {
        this.clearMp3Fade();
        if (pauseAtEnd) {
          audio.pause();
        }
      }
    }, stepMs);
  }

  private tryResumeMp3IfWanted(): void {
    if (!this.isMenuMusicPlaying || this.currentMusicTrack !== 'pais_do_futebol' || this.muted) return;
    const audio = this.ensureMp3Audio();
    if (!audio) return;
    if (!this.mp3PendingPlay && !audio.paused) return;

    audio.muted = this.muted;
    const target = this.mp3Ducked ? 0.14 : this.mp3BaseVolume;
    audio
      .play()
      .then(() => {
        this.mp3PendingPlay = false;
        this.rampMp3Volume(target, 0.25, false);
      })
      .catch(() => {
        this.mp3PendingPlay = true;
      });
  }

  public startMenuMusic(track?: MusicTrack): void {
    if (track) {
      if (this.isMenuMusicPlaying && this.currentMusicTrack !== track) {
        this.stopMenuMusic(0.05);
      }
      this.currentMusicTrack = track;
    }

    // Faixa principal: MP3 oficial "País do Futebol" (MC Guimê part. Emicida) tocando de forma 100% contínua
    if (this.currentMusicTrack === 'pais_do_futebol') {
      if (this.menuMusicInterval !== null) {
        window.clearInterval(this.menuMusicInterval);
        this.menuMusicInterval = null;
      }

      const audio = this.ensureMp3Audio();
      const targetVol = this.mp3Ducked ? 0.14 : this.mp3BaseVolume;

      // Se já estiver tocando, mantém o ponto exato (currentTime) sem reiniciar!
      if (this.isMenuMusicPlaying && audio && !audio.paused) {
        this.clearMp3Fade();
        if (!this.muted) {
          this.rampMp3Volume(targetVol, 0.2, false);
        }
        return;
      }

      this.isMenuMusicPlaying = true;
      if (!audio) return;
      audio.muted = this.muted;
      if (this.muted) {
        audio.volume = 0;
        return;
      }

      // Garante fade-in suave sem reiniciar do zero caso apenas tenha pausado
      this.clearMp3Fade();
      audio.volume = Math.min(audio.volume, 0.05);
      audio
        .play()
        .then(() => {
          this.mp3PendingPlay = false;
          if (this.isMenuMusicPlaying && this.currentMusicTrack === 'pais_do_futebol' && !this.muted) {
            this.rampMp3Volume(this.mp3Ducked ? 0.14 : this.mp3BaseVolume, 0.35, false);
          }
        })
        .catch(() => {
          // Navegador aguardando primeiro gesto de clique/toque/tecla -> unlock() dispara imediatamente
          this.mp3PendingPlay = true;
        });
      return;
    }

    // Faixa alternativa opcional: "Música da Copa" (Web Audio Batucada + Fanfarra)
    if (this.mp3Audio && !this.mp3Audio.paused) {
      this.rampMp3Volume(0, 0.08, true);
    }
    this.mp3PendingPlay = false;

    if (this.isMenuMusicPlaying) return;
    this.isMenuMusicPlaying = true;
    this.musicStep = 0;

    if (this.musicBusGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.musicBusGain.gain.cancelScheduledValues(now);
      this.musicBusGain.gain.setValueAtTime(0.92, now);
    }

    // TEMA "MÚSICA DA COPA" (Batucada de Estádio 132 BPM · Surdos + Agogô + Fanfarra Triunfal de Metais!)
    const copaBrass: (number | null)[] = [
      523.25, null, 523.25, 659.25, 783.99, null, 783.99, null,
      880.0, null, 783.99, 659.25, 783.99, null, null, null,
      659.25, null, 783.99, 880.0, 1046.5, null, 880.0, 783.99,
      659.25, null, 587.33, 659.25, 523.25, null, null, null,
      783.99, 783.99, null, 880.0, 1046.5, null, 1046.5, null,
      987.77, null, 880.0, 783.99, 880.0, null, 783.99, null,
      659.25, null, 783.99, 880.0, 1046.5, null, 1174.66, null,
      1046.5, null, 783.99, 659.25, 523.25, null, null, null,
    ];
    const copaBass: (number | null)[] = [
      130.81, null, 196.0, null, 130.81, null, 196.0, null,
      174.61, null, 220.0, null, 196.0, null, 146.83, null,
      164.81, null, 196.0, null, 130.81, null, 196.0, null,
      146.83, null, 196.0, null, 130.81, null, 196.0, null,
    ];
    const copaAgogo: (number | null)[] = [
      1046.5, null, 1318.5, 1046.5, null, 1318.5, null, 1046.5,
      1046.5, null, 1318.5, null, 1318.5, 1046.5, null, 1318.5,
    ];

    const stepMs = 114;

    const playStep = () => {
      if (!this.isMenuMusicPlaying) return;
      const out = this.musicBusGain ?? this.masterGain;
      if (this.muted || !this.ctx || !out || this.ctx.state !== 'running') {
        this.musicStep = (this.musicStep + 1) % 64;
        return;
      }

      const now = this.ctx.currentTime;
      const step = this.musicStep;

      // --- BATIDA MÚSICA DA COPA (SAMBA-BATUCADA + FANFARRA MUNDIAL) ---
      if (step % 4 === 0) {
        this.playMusicKick(now, step % 8 === 0 ? 0.26 : 0.2, step % 8 === 0 ? 44 : 58);
      }
      if (step % 4 === 2 || step % 8 === 7) {
        this.playMusicPerc(now, 1850, 0.07, 0.11, 1.2);
      }
      this.playMusicPerc(now, 5400, 0.032, step % 2 === 0 ? 0.042 : 0.024, 1.9);

      const ag = copaAgogo[step % copaAgogo.length];
      if (ag) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(ag, now);
        g.gain.setValueAtTime(0.048, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
        osc.connect(g);
        g.connect(out);
        osc.start(now);
        osc.stop(now + 0.08);
      }

      const bassNote = copaBass[step % copaBass.length];
      if (bassNote) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(bassNote, now);
        g.gain.setValueAtTime(0.17, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
        osc.connect(g);
        g.connect(out);
        osc.start(now);
        osc.stop(now + 0.2);
      }

      const brassNote = copaBrass[step];
      if (brassNote) {
        const isAccent = step % 8 === 4 || step % 16 === 0;
        this.playMusicBrass(brassNote, now, isAccent ? 0.26 : 0.16, 0.058, isAccent);
      }

      this.musicStep = (this.musicStep + 1) % 64;
    };

    this.menuMusicInterval = window.setInterval(playStep, stepMs);
  }

  public stopMenuMusic(fadeSec = 0.25): void {
    this.isMenuMusicPlaying = false;
    this.mp3PendingPlay = false;
    if (this.menuMusicInterval !== null) {
      window.clearInterval(this.menuMusicInterval);
      this.menuMusicInterval = null;
    }
    if (this.mp3Audio) {
      if (!this.mp3Audio.paused) {
        this.rampMp3Volume(0, fadeSec, true);
      } else {
        this.clearMp3Fade();
        this.mp3Audio.volume = 0;
      }
    }
    if (this.musicBusGain && this.ctx && fadeSec > 0) {
      const now = this.ctx.currentTime;
      try {
        this.musicBusGain.gain.cancelScheduledValues(now);
        this.musicBusGain.gain.setValueAtTime(Math.max(0.001, this.musicBusGain.gain.value), now);
        this.musicBusGain.gain.linearRampToValueAtTime(0.001, now + fadeSec);
      } catch {
        // ignore
      }
    }
  }

  public playFireworkLaunch(): void {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520 + Math.random() * 180, now);
    osc.frequency.exponentialRampToValueAtTime(1650 + Math.random() * 450, now + 0.28);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.045, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  public playFireworkBurst(): void {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // 1. Estouro grave encorpado no céu do estádio
    const boom = this.ctx.createOscillator();
    const boomGain = this.ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(135 + Math.random() * 35, now);
    boom.frequency.exponentialRampToValueAtTime(34, now + 0.26);
    boomGain.gain.setValueAtTime(0.22, now);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    boom.connect(boomGain);
    boomGain.connect(this.masterGain);
    boom.start(now);
    boom.stop(now + 0.30);

    // 2. Explosão inicial de ruído filtrado
    const blastBuf = this.createNoiseBuffer(0.32);
    if (blastBuf) {
      const src = this.ctx.createBufferSource();
      src.buffer = blastBuf;
      const flt = this.ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.setValueAtTime(1400, now);
      flt.frequency.exponentialRampToValueAtTime(420, now + 0.30);
      flt.Q.value = 0.8;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.18, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.31);
      src.connect(flt);
      flt.connect(g);
      g.connect(this.masterGain);
      src.start(now);
    }

    // 3. Estalinhos cintilantes (crackle) após a abertura dos fogos
    const crackleCount = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < crackleCount; i++) {
      const delay = 0.08 + i * 0.055 + Math.random() * 0.04;
      const crackBuf = this.createNoiseBuffer(0.045);
      if (!crackBuf) continue;
      const cSrc = this.ctx.createBufferSource();
      cSrc.buffer = crackBuf;
      const cFlt = this.ctx.createBiquadFilter();
      cFlt.type = 'highpass';
      cFlt.frequency.value = 2800 + Math.random() * 1800;
      const cGain = this.ctx.createGain();
      cGain.gain.setValueAtTime(0.075, now + delay);
      cGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.042);
      cSrc.connect(cFlt);
      cFlt.connect(cGain);
      cGain.connect(this.masterGain);
      cSrc.start(now + delay);
    }
  }

  public playBicycleKick(): void {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // 1. Giro acrobático no ar (whoosh ascendente)
    const whooshBuf = this.createNoiseBuffer(0.18);
    if (whooshBuf) {
      const wSrc = this.ctx.createBufferSource();
      wSrc.buffer = whooshBuf;
      const wFlt = this.ctx.createBiquadFilter();
      wFlt.type = 'bandpass';
      wFlt.frequency.setValueAtTime(420, now);
      wFlt.frequency.exponentialRampToValueAtTime(1950, now + 0.14);
      wFlt.Q.value = 1.4;
      const wGain = this.ctx.createGain();
      wGain.gain.setValueAtTime(0.18, now);
      wGain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      wSrc.connect(wFlt);
      wFlt.connect(wGain);
      wGain.connect(this.masterGain);
      wSrc.start(now);
    }

    // 2. Impacto explosivo da chuteira na bola no alto (voleio / bicicleta)
    const impact = this.ctx.createOscillator();
    const impGain = this.ctx.createGain();
    impact.type = 'triangle';
    impact.frequency.setValueAtTime(210, now + 0.03);
    impact.frequency.exponentialRampToValueAtTime(38, now + 0.22);
    impGain.gain.setValueAtTime(0.36, now + 0.03);
    impGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    impact.connect(impGain);
    impGain.connect(this.masterGain);
    impact.start(now + 0.03);
    impact.stop(now + 0.25);

    // 3. Estalo seco de couro na veia
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snapOsc.type = 'sawtooth';
    snapOsc.frequency.setValueAtTime(640, now + 0.03);
    snapOsc.frequency.exponentialRampToValueAtTime(125, now + 0.11);
    snapGain.gain.setValueAtTime(0.16, now + 0.03);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    snapOsc.connect(snapGain);
    snapGain.connect(this.masterGain);
    snapOsc.start(now + 0.03);
    snapOsc.stop(now + 0.13);
  }
}

export const retroAudio = new RetroAudioEngine();
