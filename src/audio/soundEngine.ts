import {
  computeRadix2FftMagnitudes,
  extractFrequencyBands,
  smoothSpectrum,
  synthesizeTrackHarmonicFrame,
} from './fftAnalysis';
import { AppSettings, FrequencyBands, Track } from '../types/novabeat';

const SCALE_FREQS: Record<string, number[]> = {
  'shadow-synth': [110.0, 130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 293.66], // A minor
  'future-trap': [65.41, 77.78, 87.31, 98.0, 116.54, 130.81, 155.56, 174.61], // C minor sub
  'dreamscape-chill': [146.83, 174.61, 220.0, 261.63, 293.66, 349.23, 440.0, 523.25], // D minor9
  'neon-outrun': [98.0, 116.54, 130.81, 146.83, 174.61, 196.0, 233.08, 261.63], // G minor
  'eternal-bass': [55.0, 65.41, 73.42, 82.41, 98.0, 110.0, 130.81, 146.83], // Deep A1
  'skyline-electro': [130.81, 155.56, 174.61, 196.0, 233.08, 261.63, 311.13, 392.0], // C minor electro
  'infinity-trance': [164.81, 196.0, 220.0, 246.94, 293.66, 329.63, 392.0, 440.0], // E minor trance
};

export class NovaBeatSoundEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private bassFilter: BiquadFilterNode | null = null;
  private masterGain: GainNode | null = null;
  private streamDest: MediaStreamAudioDestinationNode | null = null;

  private audioEl: HTMLAudioElement | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;

  private freqBuffer: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(512));
  private pcmBuffer: Float32Array<ArrayBuffer> = new Float32Array(new ArrayBuffer(1024 * 4));
  private previousSpectrum: number[] = [];

  private currentTrack: Track | null = null;
  private isPlaying = false;
  private currentTimeSec = 84; // Start at 01:24 matching screenshot on initial load
  private volume = 0.8;
  private isMuted = false;
  private lastTickPerf = 0;
  private lastStepIndex = -1;

  private settings: AppSettings = {
    fftSize: 1024,
    smoothingTimeConstant: 0.74,
    bassBoostDb: 6,
    autoCloudSync: true,
    highFpsCanvas: true,
    showPeakTelemetry: true,
    lockScreenMediaControls: true,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioEl = new Audio();
      this.audioEl.crossOrigin = 'anonymous';
      this.audioEl.preload = 'auto';
    }
  }

  private ensureAudioContext(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.bassFilter = this.ctx.createBiquadFilter();
      this.bassFilter.type = 'lowshelf';
      this.bassFilter.frequency.value = 140;
      this.bassFilter.gain.value = this.settings.bassBoostDb;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.volume;

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = this.settings.fftSize;
      this.analyser.smoothingTimeConstant = this.settings.smoothingTimeConstant;

      this.streamDest = this.ctx.createMediaStreamDestination();

      this.bassFilter.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.masterGain.connect(this.streamDest);

      this.freqBuffer = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
      this.pcmBuffer = new Float32Array(new ArrayBuffer(this.analyser.fftSize * 4));

      if (this.audioEl && !this.mediaSource) {
        try {
          this.mediaSource = this.ctx.createMediaElementSource(this.audioEl);
          this.mediaSource.connect(this.bassFilter);
        } catch {
          // Ignore if already connected
        }
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        // Autoplay restriction until user gesture
      });
    }
  }

  public updateSettings(newSettings: AppSettings): void {
    this.settings = newSettings;
    if (this.analyser) {
      try {
        this.analyser.fftSize = newSettings.fftSize;
        this.analyser.smoothingTimeConstant = newSettings.smoothingTimeConstant;
        this.freqBuffer = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
        this.pcmBuffer = new Float32Array(new ArrayBuffer(this.analyser.fftSize * 4));
      } catch {
        // Ignore invalid fftSize
      }
    }
    if (this.bassFilter && this.ctx) {
      this.bassFilter.gain.setTargetAtTime(
        newSettings.bassBoostDb,
        this.ctx.currentTime,
        0.05
      );
    }
  }

  public loadTrack(track: Track, startTimeSec = 0, autoPlay = false): void {
    const isSameTrack = this.currentTrack?.id === track.id;
    this.currentTrack = track;
    if (!isSameTrack) {
      this.currentTimeSec = startTimeSec;
      this.lastStepIndex = -1;
    }

    if (this.audioEl) {
      if (track.audioSource === 'uploaded-audio' && track.audioDataUrl) {
        if (this.audioEl.src !== track.audioDataUrl) {
          this.audioEl.src = track.audioDataUrl;
          this.audioEl.currentTime = startTimeSec;
        }
      } else {
        this.audioEl.pause();
        this.audioEl.removeAttribute('src');
      }
    }

    this.syncMediaSession();

    if (autoPlay) {
      this.play();
    }
  }

  public play(): void {
    this.ensureAudioContext();
    this.isPlaying = true;
    this.lastTickPerf = performance.now();

    if (
      this.currentTrack?.audioSource === 'uploaded-audio' &&
      this.currentTrack.audioDataUrl &&
      this.audioEl
    ) {
      this.audioEl.currentTime = this.currentTimeSec;
      this.audioEl.play().catch(() => {
        // Handled gracefully
      });
    }
    this.syncMediaSession();
  }

  public pause(): void {
    this.isPlaying = false;
    if (this.audioEl && !this.audioEl.paused) {
      this.audioEl.pause();
    }
    this.syncMediaSession();
  }

  public seek(seconds: number): void {
    const maxDur = this.currentTrack?.durationSec ?? 225;
    this.currentTimeSec = Math.max(0, Math.min(maxDur, seconds));
    this.lastStepIndex = -1;
    if (
      this.currentTrack?.audioSource === 'uploaded-audio' &&
      this.audioEl &&
      this.currentTrack.audioDataUrl
    ) {
      try {
        this.audioEl.currentTime = this.currentTimeSec;
      } catch {
        // Ignore if metadata not yet loaded
      }
    }
  }

  public setVolume(val: number): void {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.isMuted ? 0 : this.volume,
        this.ctx.currentTime,
        0.02
      );
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.setVolume(this.volume);
  }

  public getAudioStream(): MediaStream | null {
    this.ensureAudioContext();
    return this.streamDest?.stream ?? null;
  }

  /**
   * Schedules a procedural synth note & kick/hat pulse on each 16th-note step when playing a studio stem track.
   */
  private triggerProceduralStep(step: number, track: Track): void {
    if (!this.ctx || !this.bassFilter || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const scale =
      SCALE_FREQS[track.synthProfile] || SCALE_FREQS['shadow-synth'];

    // 1. Kick drum on steps 0, 4, 8, 12 (plus trap syncopation on 14)
    const isKickStep =
      step % 4 === 0 ||
      (track.synthProfile === 'future-trap' && step % 16 === 14);
    if (isKickStep) {
      const kickOsc = this.ctx.createOscillator();
      const kickGain = this.ctx.createGain();
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(135, now);
      kickOsc.frequency.exponentialRampToValueAtTime(42, now + 0.14);

      kickGain.gain.setValueAtTime(0.55, now);
      kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      kickOsc.connect(kickGain);
      kickGain.connect(this.bassFilter);
      kickOsc.start(now);
      kickOsc.stop(now + 0.25);
    }

    // 2. Sub-bass & Arpeggio synth voice
    const arpPattern = [0, 2, 4, 7, 5, 3, 4, 1];
    const noteIdx = arpPattern[step % arpPattern.length] % scale.length;
    const freq = scale[noteIdx];

    const synthOsc = this.ctx.createOscillator();
    const synthGain = this.ctx.createGain();
    synthOsc.type = step % 2 === 0 ? 'sawtooth' : 'triangle';
    synthOsc.frequency.setValueAtTime(
      step % 4 === 0 ? freq * 0.5 : freq * 2,
      now
    );

    // Low-pass filter envelope for warm synthwave pluck
    const pluckFilter = this.ctx.createBiquadFilter();
    pluckFilter.type = 'lowpass';
    pluckFilter.frequency.setValueAtTime(1900, now);
    pluckFilter.frequency.exponentialRampToValueAtTime(320, now + 0.16);

    synthGain.gain.setValueAtTime(0.16, now);
    synthGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    synthOsc.connect(pluckFilter);
    pluckFilter.connect(synthGain);
    synthGain.connect(this.bassFilter);
    synthOsc.start(now);
    synthOsc.stop(now + 0.19);
  }

  /**
   * Advances playback clock and returns real-time FFT FrequencyBands for the active frame.
   */
  public sampleFrame(
    barCount: number,
    sensitivityPercent: number,
    smoothingFactor: number,
    onTrackEnded?: () => void
  ): { currentTimeSec: number; bands: FrequencyBands } {
    const nowPerf = performance.now();
    const track = this.currentTrack;

    if (this.isPlaying && track) {
      if (
        track.audioSource === 'uploaded-audio' &&
        this.audioEl &&
        track.audioDataUrl &&
        !this.audioEl.paused
      ) {
        this.currentTimeSec = this.audioEl.currentTime;
        if (this.audioEl.ended || this.currentTimeSec >= track.durationSec) {
          onTrackEnded?.();
        }
      } else {
        const dt =
          this.lastTickPerf > 0
            ? Math.min(0.1, (nowPerf - this.lastTickPerf) / 1000)
            : 0.016;
        this.currentTimeSec += dt;

        // Trigger procedural Web Audio step if context is running
        const stepDuration = 60 / Math.max(60, track.bpm) / 4;
        const currentStep = Math.floor(this.currentTimeSec / stepDuration);
        if (currentStep !== this.lastStepIndex) {
          this.lastStepIndex = currentStep;
          this.triggerProceduralStep(currentStep, track);
        }

        if (this.currentTimeSec >= track.durationSec) {
          this.currentTimeSec = 0;
          onTrackEnded?.();
        }
      }
    }
    this.lastTickPerf = nowPerf;

    if (!track) {
      return {
        currentTimeSec: 0,
        bands: {
          bass: 0,
          mid: 0,
          treble: 0,
          overall: 0,
          peakHz: 0,
          spectrum: new Array(barCount).fill(0.04),
          waveform: new Array(96).fill(0),
        },
      };
    }

    // Attempt real AnalyserNode PCM + Radix-2 FFT extraction first
    let bands: FrequencyBands | null = null;
    if (this.analyser && this.ctx && this.ctx.state === 'running' && this.isPlaying) {
      this.analyser.getByteFrequencyData(this.freqBuffer);
      this.analyser.getFloatTimeDomainData(this.pcmBuffer);

      let nonZeroEnergy = 0;
      const normBins = new Float32Array(this.freqBuffer.length);
      for (let i = 0; i < this.freqBuffer.length; i++) {
        normBins[i] = this.freqBuffer[i] / 255.0;
        nonZeroEnergy += normBins[i];
      }

      if (nonZeroEnergy > 0.5) {
        // Combine hardware AnalyserNode with our Radix-2 PCM FFT for sub-bin precision
        const radixMags = computeRadix2FftMagnitudes(
          this.pcmBuffer.subarray(0, 512)
        );
        for (let i = 0; i < Math.min(normBins.length, radixMags.length); i++) {
          normBins[i] = Math.min(1.0, normBins[i] * 0.75 + radixMags[i] * 0.65);
        }

        bands = extractFrequencyBands(
          normBins,
          this.pcmBuffer,
          this.ctx.sampleRate,
          barCount,
          sensitivityPercent
        );
      }
    }

    // If AudioContext is suspended (e.g., before gesture or paused preview), use deterministic harmonic frame
    if (!bands) {
      const effectiveTime = this.isPlaying
        ? this.currentTimeSec
        : this.currentTimeSec + Math.sin(nowPerf * 0.0015) * 0.18;
      bands = synthesizeTrackHarmonicFrame(
        effectiveTime,
        track.bpm,
        track.synthProfile,
        barCount,
        this.isPlaying ? sensitivityPercent : sensitivityPercent * 0.48
      );
    }

    const smoothedSpectrum = smoothSpectrum(
      this.previousSpectrum,
      bands.spectrum,
      smoothingFactor,
      100 // already scaled by sensitivity
    );
    this.previousSpectrum = smoothedSpectrum;

    return {
      currentTimeSec: this.currentTimeSec,
      bands: {
        ...bands,
        spectrum: smoothedSpectrum,
      },
    };
  }

  private syncMediaSession(): void {
    if (
      typeof navigator === 'undefined' ||
      !('mediaSession' in navigator) ||
      !this.settings.lockScreenMediaControls ||
      !this.currentTrack
    ) {
      return;
    }
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.currentTrack.title,
        artist: this.currentTrack.artist,
        album: this.currentTrack.album,
      });
      navigator.mediaSession.playbackState = this.isPlaying
        ? 'playing'
        : 'paused';
    } catch {
      // Ignore MediaSession errors in restricted contexts
    }
  }
}
