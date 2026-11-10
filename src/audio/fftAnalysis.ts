import { ExportConfig, FrequencyBands, SynthProfile } from '../types/novabeat';

/**
 * Applies a Hann window to raw PCM samples to minimize spectral leakage before FFT.
 */
export function applyHannWindow(samples: Float32Array | number[]): Float32Array {
  const n = samples.length;
  const out = new Float32Array(n);
  if (n <= 1) return out;
  for (let i = 0; i < n; i++) {
    const multiplier = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    out[i] = samples[i] * multiplier;
  }
  return out;
}

/**
 * In-place Radix-2 Cooley-Tukey FFT on real-valued PCM samples.
 * Returns normalized magnitude spectrum [0..1] of length N/2.
 */
export function computeRadix2FftMagnitudes(
  pcmSamples: Float32Array | number[]
): Float32Array {
  // Ensure power-of-2 length
  let n = 1;
  while (n * 2 <= pcmSamples.length) {
    n *= 2;
  }
  if (n < 2) {
    return new Float32Array(0);
  }

  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  const windowed = applyHannWindow(
    pcmSamples.length === n ? pcmSamples : pcmSamples.slice(0, n)
  );
  for (let i = 0; i < n; i++) {
    real[i] = windowed[i];
  }

  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (i < j) {
      const tr = real[i];
      real[i] = real[j];
      real[j] = tr;
      const ti = imag[i];
      imag[i] = imag[j];
      imag[j] = ti;
    }
    let m = n >> 1;
    while (m >= 1 && j >= m) {
      j -= m;
      m >>= 1;
    }
    j += m;
  }

  // Butterfly updates
  for (let s = 1; (1 << s) <= n; s++) {
    const m = 1 << s;
    const halfM = m >> 1;
    const theta = (-2 * Math.PI) / m;
    const wStepR = Math.cos(theta);
    const wStepI = Math.sin(theta);

    for (let k = 0; k < n; k += m) {
      let wR = 1.0;
      let wI = 0.0;
      for (let mIdx = 0; mIdx < halfM; mIdx++) {
        const idx1 = k + mIdx;
        const idx2 = idx1 + halfM;
        const tR = wR * real[idx2] - wI * imag[idx2];
        const tI = wR * imag[idx2] + wI * real[idx2];

        real[idx2] = real[idx1] - tR;
        imag[idx2] = imag[idx1] - tI;
        real[idx1] += tR;
        imag[idx1] += tI;

        const nextWR = wR * wStepR - wI * wStepI;
        wI = wR * wStepI + wI * wStepR;
        wR = nextWR;
      }
    }
  }

  const halfN = n >> 1;
  const magnitudes = new Float32Array(halfN);
  const scale = 2.0 / n;
  for (let i = 0; i < halfN; i++) {
    const mag = Math.hypot(real[i], imag[i]) * scale;
    magnitudes[i] = Math.min(1.0, Math.max(0.0, mag));
  }
  return magnitudes;
}

/**
 * Exponential Moving Average (EMA) smoothing to prevent visual jitter between frames.
 */
export function smoothSpectrum(
  previous: number[],
  current: number[],
  smoothingFactor: number,
  sensitivityPercent: number
): number[] {
  const clampedSmooth = Math.min(0.96, Math.max(0.0, smoothingFactor));
  const gain = Math.max(0.1, sensitivityPercent / 70);
  const len = current.length;
  const result = new Array<number>(len);

  for (let i = 0; i < len; i++) {
    const scaledCurrent = Math.min(1.0, Math.max(0.0, current[i] * gain));
    const prevVal = i < previous.length ? previous[i] : scaledCurrent;
    // Fast attack, smooth release
    const effectiveSmooth =
      scaledCurrent > prevVal ? clampedSmooth * 0.45 : clampedSmooth;
    result[i] =
      prevVal * effectiveSmooth + scaledCurrent * (1 - effectiveSmooth);
  }
  return result;
}

/**
 * Resamples raw FFT bins into a target number of visualizer bars using perceptual log-frequency mapping.
 */
export function resampleSpectrumBars(
  fftBins: ArrayLike<number>,
  targetBarCount: number
): number[] {
  const safeBarCount = Math.max(8, Math.min(256, Math.round(targetBarCount)));
  const binCount = fftBins.length;
  if (binCount === 0) {
    return new Array<number>(safeBarCount).fill(0);
  }

  const bars = new Array<number>(safeBarCount);
  const usableBins = Math.max(4, Math.floor(binCount * 0.72));

  for (let b = 0; b < safeBarCount; b++) {
    const t0 = b / safeBarCount;
    const t1 = (b + 1) / safeBarCount;
    // Perceptual curve emphasizing sub-bass through presence frequencies
    const startIdx = Math.floor(Math.pow(t0, 1.65) * (usableBins - 1));
    const endIdx = Math.max(
      startIdx + 1,
      Math.floor(Math.pow(t1, 1.65) * usableBins)
    );

    let sum = 0;
    let count = 0;
    for (let k = startIdx; k < endIdx && k < binCount; k++) {
      sum += fftBins[k];
      count++;
    }
    const avg = count > 0 ? sum / count : 0;
    bars[b] = Math.min(1.0, Math.max(0.0, avg));
  }
  return bars;
}

/**
 * Separates FFT bins into Low (Bass: 20-250Hz), Mid (Vocals/Instruments: 250-4000Hz),
 * and High (Treble: 4000-16000Hz) normalized bands plus dominant peak frequency.
 */
export function extractFrequencyBands(
  normalizedBins: ArrayLike<number>,
  waveformSamples: ArrayLike<number>,
  sampleRate = 44100,
  barCount = 64,
  sensitivityPercent = 70
): FrequencyBands {
  const binCount = normalizedBins.length;
  if (binCount === 0) {
    return {
      bass: 0,
      mid: 0,
      treble: 0,
      overall: 0,
      peakHz: 0,
      spectrum: new Array(barCount).fill(0),
      waveform: new Array(64).fill(0),
    };
  }

  const nyquist = sampleRate / 2;
  const hzPerBin = nyquist / binCount;
  const gain = Math.max(0.1, sensitivityPercent / 70);

  let bassSum = 0;
  let bassCount = 0;
  let midSum = 0;
  let midCount = 0;
  let trebleSum = 0;
  let trebleCount = 0;

  let maxMag = -1;
  let maxBin = 0;

  for (let i = 1; i < binCount; i++) {
    const hz = i * hzPerBin;
    const val = Math.min(1.0, Math.max(0.0, normalizedBins[i] * gain));

    if (val > maxMag) {
      maxMag = val;
      maxBin = i;
    }

    if (hz <= 250) {
      bassSum += val;
      bassCount++;
    } else if (hz <= 4000) {
      midSum += val;
      midCount++;
    } else if (hz <= 16000) {
      trebleSum += val;
      trebleCount++;
    }
  }

  const bass = bassCount > 0 ? Math.min(1, bassSum / bassCount) : 0;
  const mid = midCount > 0 ? Math.min(1, midSum / midCount) : 0;
  const treble = trebleCount > 0 ? Math.min(1, trebleSum / trebleCount) : 0;
  const overall = Math.min(1, bass * 0.48 + mid * 0.34 + treble * 0.18);
  const peakHz = maxMag > 0.01 ? Math.round(maxBin * hzPerBin) : 0;

  const rawBars = resampleSpectrumBars(normalizedBins, barCount);
  const spectrum = rawBars.map((v) => Math.min(1.0, v * gain));

  const waveLen = 96;
  const waveform = new Array<number>(waveLen);
  const srcLen = waveformSamples.length;
  for (let i = 0; i < waveLen; i++) {
    if (srcLen === 0) {
      waveform[i] = 0;
    } else {
      const idx = Math.min(srcLen - 1, Math.floor((i / waveLen) * srcLen));
      waveform[i] = Math.max(-1, Math.min(1, waveformSamples[idx] * gain));
    }
  }

  return {
    bass,
    mid,
    treble,
    overall,
    peakHz,
    spectrum,
    waveform,
  };
}

/**
 * Generates deterministic harmonic PCM & FFT data synchronized to playback timestamp and track BPM/profile.
 * Used seamlessly alongside Web Audio AnalyserNode or when browser autoplay policy holds AudioContext.
 */
export function synthesizeTrackHarmonicFrame(
  timeSec: number,
  bpm: number,
  profile: SynthProfile,
  barCount: number,
  sensitivityPercent: number
): FrequencyBands {
  const beatPeriod = 60 / Math.max(60, bpm);
  const beatPhase = (timeSec % beatPeriod) / beatPeriod;
  const barPhase = (timeSec % (beatPeriod * 4)) / (beatPeriod * 4);

  // Kick envelope (sharp exponential decay on beat)
  const kickPulse = Math.exp(-beatPhase * 6.5);
  // Off-beat hi-hat / snare pulse
  const snarePhase = ((timeSec + beatPeriod * 0.5) % beatPeriod) / beatPeriod;
  const snarePulse = Math.exp(-snarePhase * 9.0) * 0.75;

  // Profile-specific harmonic weights
  const profileModifiers: Record<
    SynthProfile,
    { subWeight: number; midArp: number; shimmer: number; freqBase: number }
  > = {
    'shadow-synth': { subWeight: 0.92, midArp: 0.78, shimmer: 0.58, freqBase: 110 },
    'future-trap': { subWeight: 1.0, midArp: 0.65, shimmer: 0.85, freqBase: 65 },
    'dreamscape-chill': { subWeight: 0.72, midArp: 0.88, shimmer: 0.74, freqBase: 146 },
    'neon-outrun': { subWeight: 0.86, midArp: 0.92, shimmer: 0.8, freqBase: 98 },
    'eternal-bass': { subWeight: 0.96, midArp: 0.7, shimmer: 0.62, freqBase: 55 },
    'skyline-electro': { subWeight: 0.84, midArp: 0.9, shimmer: 0.88, freqBase: 130 },
    'infinity-trance': { subWeight: 0.89, midArp: 0.95, shimmer: 0.92, freqBase: 164 },
  };

  const mod = profileModifiers[profile] || profileModifiers['shadow-synth'];
  const gain = Math.max(0.15, sensitivityPercent / 70);

  const safeBars = Math.max(16, Math.min(128, barCount));
  const spectrum = new Array<number>(safeBars);

  for (let i = 0; i < safeBars; i++) {
    const normIdx = i / safeBars;
    let energy = 0;

    if (normIdx < 0.22) {
      // Bass region reacts strongly to kick and sub-bass oscillation
      const subShape = Math.cos((normIdx / 0.22) * (Math.PI * 0.5));
      const bassWobble = 0.55 + 0.45 * Math.sin(timeSec * 4.2 + i * 0.35);
      energy = (kickPulse * 0.72 + bassWobble * 0.28) * subShape * mod.subWeight;
    } else if (normIdx < 0.68) {
      // Midrange reacts to vocal/synth arpeggio harmonics
      const midPos = (normIdx - 0.22) / 0.46;
      const harmonic1 = Math.sin(timeSec * 6.5 + midPos * Math.PI * 3) * 0.5 + 0.5;
      const harmonic2 = Math.cos(barPhase * Math.PI * 8 - i * 0.4) * 0.5 + 0.5;
      energy =
        (harmonic1 * 0.55 + harmonic2 * 0.3 + snarePulse * 0.25) *
        mod.midArp *
        (1 - Math.abs(midPos - 0.45) * 0.5);
    } else {
      // High/Treble region reacts to hi-hats, air & shimmer
      const highPos = (normIdx - 0.68) / 0.32;
      const crisp = Math.abs(Math.sin(timeSec * 14.0 + i * 1.1));
      energy = (snarePulse * 0.6 + crisp * 0.4) * mod.shimmer * (1 - highPos * 0.55);
    }

    spectrum[i] = Math.min(1.0, Math.max(0.04, energy * gain));
  }

  const bass = Math.min(
    1.0,
    spectrum.slice(0, Math.floor(safeBars * 0.2)).reduce((a, b) => a + b, 0) /
      Math.max(1, Math.floor(safeBars * 0.2))
  );
  const mid = Math.min(
    1.0,
    spectrum
      .slice(Math.floor(safeBars * 0.2), Math.floor(safeBars * 0.68))
      .reduce((a, b) => a + b, 0) /
      Math.max(1, Math.floor(safeBars * 0.48))
  );
  const treble = Math.min(
    1.0,
    spectrum.slice(Math.floor(safeBars * 0.68)).reduce((a, b) => a + b, 0) /
      Math.max(1, safeBars - Math.floor(safeBars * 0.68))
  );
  const overall = Math.min(1.0, bass * 0.48 + mid * 0.34 + treble * 0.18);

  const waveLen = 96;
  const waveform = new Array<number>(waveLen);
  for (let i = 0; i < waveLen; i++) {
    const t = i / waveLen;
    const carrier =
      Math.sin(t * Math.PI * 4 + timeSec * 10) * (0.4 + bass * 0.45) +
      Math.sin(t * Math.PI * 12 - timeSec * 18) * (mid * 0.32) +
      Math.cos(t * Math.PI * 28 + timeSec * 25) * (treble * 0.2);
    // Window edges smoothly for circular/radial symmetry
    const env = Math.sin(t * Math.PI);
    waveform[i] = Math.max(-1, Math.min(1, carrier * (0.35 + 0.65 * env)));
  }

  const peakHz = Math.round(
    mod.freqBase * (kickPulse > 0.6 ? 1 : 2 + Math.floor((mid + treble) * 4))
  );

  return {
    bass,
    mid,
    treble,
    overall,
    peakHz,
    spectrum,
    waveform,
  };
}

/**
 * Calculates estimated video export file size in MB based on resolution, FPS, audio inclusion, and track duration.
 */
export function estimateExportSizeMb(config: ExportConfig): number {
  const resolutionBitrateMbps: Record<ExportConfig['resolution'], number> = {
    '720p': 0.52,
    '1080p': 0.82,
    '1440p': 1.45,
  };
  const baseMbps = resolutionBitrateMbps[config.resolution] ?? 0.82;
  const fpsMultiplier = config.fps === 60 ? 1.22 : 1.0;
  const audioMbps = config.includeAudio ? 0.08 : 0;
  const totalMbps = baseMbps * fpsMultiplier + audioMbps;
  const duration = Math.max(1, config.durationSec || 225);
  const sizeMb = (totalMbps * duration) / 8;
  return Math.max(0.2, Math.round(sizeMb * 10) / 10);
}

/**
 * Returns exact pixel width and height for the exported video canvas based on resolution and aspect ratio.
 */
export function getExportCanvasDimensions(
  resolution: ExportConfig['resolution'],
  aspectRatio: ExportConfig['aspectRatio']
): { width: number; height: number; videoBitsPerSecond: number } {
  const baseShortEdge =
    resolution === '1440p' ? 1440 : resolution === '1080p' ? 1080 : 720;
  const videoBitsPerSecond =
    resolution === '1440p'
      ? 12_000_000
      : resolution === '1080p'
      ? 8_000_000
      : 4_500_000;

  if (aspectRatio === '9:16') {
    const width = baseShortEdge;
    const height = Math.round((baseShortEdge * 16) / 9);
    return { width, height, videoBitsPerSecond };
  }
  if (aspectRatio === '1:1') {
    return {
      width: baseShortEdge,
      height: baseShortEdge,
      videoBitsPerSecond,
    };
  }
  // Default 16:9 widescreen
  const width = Math.round((baseShortEdge * 16) / 9);
  const height = baseShortEdge;
  return { width, height, videoBitsPerSecond };
}

/**
 * Computes percentage progress (0..100) and remaining seconds for a full-track or custom-range video export.
 */
export function computeExportProgress(
  elapsedSec: number,
  totalDurationSec: number
): { percent: number; remainingSec: number; isComplete: boolean } {
  const safeTotal = Math.max(1, totalDurationSec);
  const clampedElapsed = Math.max(0, Math.min(safeTotal, elapsedSec));
  const percent = Math.min(100, Math.round((clampedElapsed / safeTotal) * 100));
  const remainingSec = Math.max(0, Math.ceil(safeTotal - clampedElapsed));
  return {
    percent,
    remainingSec,
    isComplete: elapsedSec >= safeTotal - 0.05,
  };
}

