import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyHannWindow,
  computeRadix2FftMagnitudes,
  smoothSpectrum,
  resampleSpectrumBars,
  extractFrequencyBands,
  synthesizeTrackHarmonicFrame,
  estimateExportSizeMb,
  getExportCanvasDimensions,
  computeExportProgress,
} from './fftAnalysis';

test('applyHannWindow tapers boundaries to zero and preserves peak center', () => {
  const input = new Float32Array(64).fill(1.0);
  const windowed = applyHannWindow(input);
  assert.equal(windowed.length, 64);
  assert.ok(Math.abs(windowed[0]) < 1e-6);
  assert.ok(Math.abs(windowed[63]) < 1e-6);
  assert.ok(windowed[32] > 0.95);
});

test('computeRadix2FftMagnitudes detects pure sine wave frequency peak', () => {
  const N = 256;
  const sampleRate = 44100;
  const targetBin = 16; // Frequency = 16 * 44100 / 256 = 2756.25 Hz
  const freq = (targetBin * sampleRate) / N;
  const pcm = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pcm[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }

  const mags = computeRadix2FftMagnitudes(pcm);
  assert.equal(mags.length, N / 2);

  let peakBin = 0;
  let peakVal = -1;
  for (let i = 0; i < mags.length; i++) {
    if (mags[i] > peakVal) {
      peakVal = mags[i];
      peakBin = i;
    }
  }
  assert.equal(peakBin, targetBin);
  assert.ok(peakVal > 0.4);
});

test('smoothSpectrum dampens sudden jitter and scales with sensitivity', () => {
  const prev = [0.2, 0.2, 0.2];
  const curr = [0.8, 0.8, 0.8];
  const smoothed = smoothSpectrum(prev, curr, 0.8, 70);
  assert.equal(smoothed.length, 3);
  assert.ok(smoothed[0] > 0.2 && smoothed[0] < 0.8);
});

test('resampleSpectrumBars produces exact requested bar count in [0, 1]', () => {
  const bins = new Float32Array(128);
  for (let i = 0; i < 128; i++) {
    bins[i] = (i % 10) / 10;
  }
  const bars = resampleSpectrumBars(bins, 48);
  assert.equal(bars.length, 48);
  assert.ok(bars.every((v) => v >= 0 && v <= 1));
});

test('extractFrequencyBands separates bass, mid, and treble ranges accurately', () => {
  const bins = new Float32Array(256).fill(0);
  // Low frequency bins (e.g. bin 1-2 ~ 86-172 Hz at 44.1kHz)
  bins[1] = 0.95;
  bins[2] = 0.9;
  const wave = new Float32Array(128).fill(0.25);

  const bands = extractFrequencyBands(bins, wave, 44100, 32, 70);
  assert.ok(bands.bass > bands.treble);
  assert.equal(bands.spectrum.length, 32);
  assert.ok(bands.peakHz > 0 && bands.peakHz <= 250);
});

test('synthesizeTrackHarmonicFrame generates audio-reactive bands synchronized to BPM', () => {
  const frameBeat = synthesizeTrackHarmonicFrame(0.0, 120, 'future-trap', 64, 75);
  const frameOff = synthesizeTrackHarmonicFrame(0.23, 120, 'future-trap', 64, 75);
  assert.equal(frameBeat.spectrum.length, 64);
  assert.ok(frameBeat.bass > frameOff.bass, 'Kick beat at t=0 should have stronger bass than off-beat');
});

test('estimateExportSizeMb computes realistic video size (~24MB for 1080p 60fps 3m45s)', () => {
  const size = estimateExportSizeMb({
    resolution: '1080p',
    fps: 60,
    aspectRatio: '16:9',
    includeAudio: true,
    durationSec: 180,
  });
  assert.ok(size >= 20 && size <= 30, `Expected ~24MB, got ${size}`);
});

test('getExportCanvasDimensions returns exact pixel geometry for 16:9, 9:16, and 1:1', () => {
  const wide = getExportCanvasDimensions('1080p', '16:9');
  assert.equal(wide.width, 1920);
  assert.equal(wide.height, 1080);

  const vertical = getExportCanvasDimensions('1080p', '9:16');
  assert.equal(vertical.width, 1080);
  assert.equal(vertical.height, 1920);

  const square = getExportCanvasDimensions('720p', '1:1');
  assert.equal(square.width, 720);
  assert.equal(square.height, 720);
});

test('computeExportProgress tracks full song completion accurately', () => {
  const mid = computeExportProgress(112.5, 225);
  assert.equal(mid.percent, 50);
  assert.equal(mid.isComplete, false);
  assert.equal(mid.remainingSec, 113);

  const done = computeExportProgress(225, 225);
  assert.equal(done.percent, 100);
  assert.equal(done.isComplete, true);
  assert.equal(done.remainingSec, 0);
});

