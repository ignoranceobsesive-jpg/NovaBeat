import React, { useState } from 'react';
import {
  BookmarkPlus,
  ImagePlus,
  RotateCcw,
  Sliders,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { ARTWORK_COVERS, COLOR_PALETTES } from '../data/seedData';
import {
  FrequencyBands,
  VisualizerConfig,
  VisualizerStyle,
} from '../types/novabeat';

interface VisualizerStudioViewProps {
  config: VisualizerConfig;
  bands: FrequencyBands;
  onUpdateConfig: (updates: Partial<VisualizerConfig>) => void;
  onResetConfig: () => void;
  onSavePreset: (name: string) => { ok: boolean; error?: string };
}

const STYLE_OPTIONS: { id: VisualizerStyle; label: string }[] = [
  { id: 'circular-spectrum', label: 'Spectrum' },
  { id: 'avee-wave-rings', label: 'Avee Wave' },
  { id: 'particle-reactor', label: 'Particles' },
  { id: 'audio-waveform', label: 'Waveform' },
  { id: 'radial-waveform', label: 'Circle' },
  { id: 'vertical-bars', label: 'Bars' },
  { id: 'horizontal-spectrum', label: 'Horizon' },
];

export const VisualizerStudioView: React.FC<VisualizerStudioViewProps> = ({
  config,
  bands,
  onUpdateConfig,
  onResetConfig,
  onSavePreset,
}) => {
  const [presetNameInput, setPresetNameInput] = useState('');
  const [presetFeedback, setPresetFeedback] = useState<{
    type: 'ok' | 'err';
    msg: string;
  } | null>(null);

  const handleImageFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'backgroundUrl' | 'centerImageUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateConfig({ [field]: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSavePresetClick = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onSavePreset(presetNameInput);
    if (!res.ok) {
      setPresetFeedback({
        type: 'err',
        msg: res.error || 'Enter a preset name.',
      });
      return;
    }
    setPresetFeedback({
      type: 'ok',
      msg: `Saved preset "${presetNameInput.trim()}"`,
    });
    setPresetNameInput('');
    setTimeout(() => setPresetFeedback(null), 3000);
  };

  return (
    <section
      aria-label="Visualizer Studio Controls"
      className="flex flex-col justify-between h-full bg-[#090614]/90 border border-violet-500/15 rounded-2xl p-4 sm:p-5 overflow-y-auto space-y-3.5"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-violet-500/15">
        <div>
          <h2 className="text-lg font-bold text-white font-display">
            Visualizer Studio
          </h2>
          <p className="text-xs text-slate-400">
            Real-time FFT spectrum, color gradients & personal image mapping
          </p>
        </div>

        <button
          type="button"
          onClick={onResetConfig}
          aria-label="Reset visualizer parameters"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-[#130D26] hover:bg-violet-950/80 border border-violet-500/20 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>

      {/* Mode Selector Tabs (Spectrum | Avee Wave | Particles | Waveform | Circle | Bars | Horizon) */}
      <div>
        <span className="block text-xs font-semibold text-slate-300 mb-1.5">
          Visualization Engine
        </span>
        <div
          role="tablist"
          aria-label="Visualization modes"
          className="flex items-center flex-wrap gap-1 p-1 bg-[#120C24] border border-violet-500/20 rounded-xl"
        >
          {STYLE_OPTIONS.map((item) => {
            const active = config.style === item.id;
            return (
              <button
                key={item.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => onUpdateConfig({ style: item.id })}
                className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm shadow-violet-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live 3-Band Audio Frequency Response Meter */}
      <div className="grid grid-cols-3 gap-2.5 p-3 bg-[#110B22] border border-violet-500/15 rounded-xl">
        <div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span>Bass (20-250Hz)</span>
            <span className="font-mono tabular-nums text-violet-300">
              {Math.round(bands.bass * 100)}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-violet-950 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-75"
              style={{ width: `${Math.min(100, Math.round(bands.bass * 100))}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span>Mid (Vocals)</span>
            <span className="font-mono tabular-nums text-cyan-300">
              {Math.round(bands.mid * 100)}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-cyan-950 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-75"
              style={{ width: `${Math.min(100, Math.round(bands.mid * 100))}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span>Treble (Highs)</span>
            <span className="font-mono tabular-nums text-pink-300">
              {Math.round(bands.treble * 100)}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-pink-950 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-pink-500 to-amber-400 transition-all duration-75"
              style={{
                width: `${Math.min(100, Math.round(bands.treble * 100))}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Color Swatch Orbs (matching Phone 2 in reference image) + Custom Pickers */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-300">
            Color Palette & Gradient
          </span>
          <span className="text-[11px] text-slate-400">
            {
              COLOR_PALETTES.find((p) => p.id === config.colorSchemeId)?.name ??
              'Custom Gradient'
            }
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 p-3 bg-[#110B22] border border-violet-500/15 rounded-xl">
          <div className="flex items-center gap-2.5 flex-wrap">
            {COLOR_PALETTES.map((palette) => {
              const selected = config.colorSchemeId === palette.id;
              return (
                <button
                  key={palette.id}
                  type="button"
                  onClick={() =>
                    onUpdateConfig({
                      colorSchemeId: palette.id,
                      primaryColor: palette.primary,
                      secondaryColor: palette.secondary,
                      accentColor: palette.accent,
                    })
                  }
                  aria-label={`Select color palette ${palette.name}`}
                  className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                    selected
                      ? 'scale-115 ring-2 ring-white ring-offset-2 ring-offset-[#110B22]'
                      : 'opacity-80 hover:opacity-100 hover:scale-105'
                  }`}
                  style={{
                    background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`,
                  }}
                />
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <input
              type="color"
              aria-label="Primary spectrum color"
              value={config.primaryColor}
              onChange={(e) =>
                onUpdateConfig({
                  colorSchemeId: 'custom',
                  primaryColor: e.target.value,
                })
              }
              className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
            />
            <input
              type="color"
              aria-label="Secondary spectrum color"
              value={config.secondaryColor}
              onChange={(e) =>
                onUpdateConfig({
                  colorSchemeId: 'custom',
                  secondaryColor: e.target.value,
                })
              }
              className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
            />
          </div>
        </div>
      </div>

      {/* Primary Sliders: Sensitivity, Glow, Bar Count, Size, Rotation, Scale */}
      <div className="space-y-3.5 bg-[#110B22] border border-violet-500/15 rounded-xl p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-violet-300 mb-1">
          <Sliders className="w-3.5 h-3.5" />
          <span>Audio Reactivity & Geometry</span>
        </div>

        {/* Sensitivity Slider (matching Phone 2 bottom control) */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <label htmlFor="slider-sensitivity" className="text-slate-300 font-medium">
              Sensitivity
            </label>
            <span className="font-mono tabular-nums text-violet-300">
              {config.sensitivity}%
            </span>
          </div>
          <input
            id="slider-sensitivity"
            type="range"
            min={20}
            max={180}
            value={config.sensitivity}
            onChange={(e) =>
              onUpdateConfig({ sensitivity: Number(e.target.value) })
            }
            className="w-full"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <label htmlFor="slider-glow" className="text-slate-300">
                Glow Intensity
              </label>
              <span className="font-mono tabular-nums text-slate-400">
                {config.glowIntensity}%
              </span>
            </div>
            <input
              id="slider-glow"
              type="range"
              min={0}
              max={100}
              value={config.glowIntensity}
              onChange={(e) =>
                onUpdateConfig({ glowIntensity: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <label htmlFor="slider-bars" className="text-slate-300">
                Bar Count
              </label>
              <span className="font-mono tabular-nums text-slate-400">
                {config.barCount} bars
              </span>
            </div>
            <input
              id="slider-bars"
              type="range"
              min={24}
              max={128}
              step={8}
              value={config.barCount}
              onChange={(e) =>
                onUpdateConfig({ barCount: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <label htmlFor="slider-size" className="text-slate-300">
                Spectrum Size
              </label>
              <span className="font-mono tabular-nums text-slate-400">
                {Math.round(config.spectrumSize * 100)}%
              </span>
            </div>
            <input
              id="slider-size"
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              value={config.spectrumSize}
              onChange={(e) =>
                onUpdateConfig({ spectrumSize: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <label htmlFor="slider-rotation" className="text-slate-300">
                Rotation Speed
              </label>
              <span className="font-mono tabular-nums text-slate-400">
                {config.rotationSpeed}°/s
              </span>
            </div>
            <input
              id="slider-rotation"
              type="range"
              min={-45}
              max={45}
              step={1}
              value={config.rotationSpeed}
              onChange={(e) =>
                onUpdateConfig({ rotationSpeed: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <label htmlFor="slider-opacity" className="text-slate-300">
                Master Opacity
              </label>
              <span className="font-mono tabular-nums text-slate-400">
                {Math.round(config.opacity * 100)}%
              </span>
            </div>
            <input
              id="slider-opacity"
              type="range"
              min={0.25}
              max={1}
              step={0.05}
              value={config.opacity}
              onChange={(e) =>
                onUpdateConfig({ opacity: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <label htmlFor="slider-smoothing" className="text-slate-300">
                FFT Smoothing
              </label>
              <span className="font-mono tabular-nums text-slate-400">
                {Math.round(config.smoothing * 100)}%
              </span>
            </div>
            <input
              id="slider-smoothing"
              type="range"
              min={0.15}
              max={0.92}
              step={0.02}
              value={config.smoothing}
              onChange={(e) =>
                onUpdateConfig({ smoothing: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Personal Background & Center Logo Uploaders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 bg-[#110B22] border border-violet-500/15 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-white">
              Custom Background
            </span>
            <label className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-300 hover:text-white cursor-pointer">
              <ImagePlus className="w-3.5 h-3.5" />
              <span>Upload</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageFile(e, 'backgroundUrl')}
                className="hidden"
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            {[
              { id: 'bg1', url: ARTWORK_COVERS.dreamscape, label: 'Portal' },
              { id: 'bg2', url: ARTWORK_COVERS.futureTrap, label: 'Avee Tunnel' },
              { id: 'bg3', url: ARTWORK_COVERS.lostInShadows, label: 'Moon' },
              { id: 'bg4', url: ARTWORK_COVERS.neonLights, label: 'City' },
            ].map((bg) => (
              <button
                key={bg.id}
                type="button"
                onClick={() => onUpdateConfig({ backgroundUrl: bg.url })}
                aria-label={`Set background to ${bg.label}`}
                className={`relative w-11 h-11 rounded-lg overflow-hidden border transition-all cursor-pointer ${
                  config.backgroundUrl === bg.url
                    ? 'border-violet-400 ring-2 ring-violet-400/40'
                    : 'border-violet-500/20 opacity-75 hover:opacity-100'
                }`}
              >
                <img
                  src={bg.url}
                  alt={bg.label}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        <div className="p-3.5 bg-[#110B22] border border-violet-500/15 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-white">
              Personal Center Emblem
            </span>
            {config.centerImageUrl && (
              <button
                type="button"
                onClick={() => onUpdateConfig({ centerImageUrl: '' })}
                aria-label="Clear custom center image"
                className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
          <label className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-violet-500/35 hover:border-violet-400 bg-[#090614] text-xs text-violet-200 cursor-pointer transition-colors">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span>
              {config.centerImageUrl
                ? 'Replace Center Emblem Image'
                : 'Upload Personal Emblem / Photo'}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageFile(e, 'centerImageUrl')}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Save Customized Visualizer as Reusable Preset */}
      <form
        onSubmit={handleSavePresetClick}
        className="flex items-center gap-2 p-3 bg-[#120C24] border border-violet-500/20 rounded-xl"
      >
        <input
          type="text"
          value={presetNameInput}
          onChange={(e) => setPresetNameInput(e.target.value)}
          placeholder="Save current configuration as preset..."
          aria-label="New preset name"
          className="flex-1 px-3 py-1.5 text-xs bg-[#090614] border border-violet-500/20 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <BookmarkPlus className="w-3.5 h-3.5" />
          Save Preset
        </button>
      </form>
      {presetFeedback && (
        <p
          className={`text-xs px-3 py-1.5 rounded-lg ${
            presetFeedback.type === 'ok'
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
              : 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
          }`}
        >
          {presetFeedback.msg}
        </p>
      )}
    </section>
  );
};
