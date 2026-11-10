import React, { useState } from 'react';
import {
  Bookmark,
  Check,
  Droplet,
  Eye,
  EyeOff,
  Grid,
  Image as ImageIcon,
  Layers,
  Move,
  Palette,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Triangle,
} from 'lucide-react';
import {
  ReactiveBand,
  VisualizerConfig,
  VisualizerLayer,
  VisualizerLayerType,
} from '../types/novabeat';

interface EditorPresetsViewProps {
  config: VisualizerConfig;
  presets: VisualizerConfig[];
  selectedLayerId: string | null;
  onSelectLayer: (layerId: string | null) => void;
  onUpdateConfig: (updates: Partial<VisualizerConfig>) => void;
  onLoadPreset: (preset: VisualizerConfig) => void;
  onSavePreset: (name: string) => { ok: boolean; error?: string };
  onDeletePreset: (presetId: string) => void;
}

type EditorSubTab = 'layers' | 'effects' | 'presets';
type BottomToolMode = 'transform' | 'color' | 'opacity';

export const EditorPresetsView: React.FC<EditorPresetsViewProps> = ({
  config,
  presets,
  selectedLayerId,
  onSelectLayer,
  onUpdateConfig,
  onLoadPreset,
  onSavePreset,
  onDeletePreset,
}) => {
  const [subTab, setSubTab] = useState<EditorSubTab>('layers');
  const [toolMode, setToolMode] = useState<BottomToolMode>('transform');
  const [newPresetName, setNewPresetName] = useState('');
  const [savedBanner, setSavedBanner] = useState('');

  const activeLayer =
    config.layers.find((l) => l.id === selectedLayerId) ||
    config.layers[0] ||
    null;

  const updateLayer = (
    layerId: string,
    updates: Partial<VisualizerLayer>
  ): void => {
    const nextLayers = config.layers.map((layer) =>
      layer.id === layerId ? { ...layer, ...updates } : layer
    );
    onUpdateConfig({ layers: nextLayers });
  };

  const handleAddLayer = () => {
    const types: { type: VisualizerLayerType; name: string }[] = [
      { type: 'geometry-triangle', name: 'Neon Triangle Node' },
      { type: 'particles', name: 'Starfield Particles' },
      { type: 'spectrum-ring', name: 'Harmonic Spectrum Ring' },
      { type: 'center-emblem', name: 'Center Emblem Node' },
    ];
    const pick = types[config.layers.length % types.length];
    const newLayer: VisualizerLayer = {
      id: `layer-${Date.now()}`,
      name: `${pick.name} #${config.layers.length + 1}`,
      type: pick.type,
      visible: true,
      opacity: 0.9,
      scale: 1.0,
      rotation: 0,
      xOffset: 0,
      yOffset: 0,
      colorPrimary: config.primaryColor,
      colorSecondary: config.secondaryColor,
      reactToBand: 'bass',
      reactivityAmount: 0.85,
    };
    onUpdateConfig({ layers: [newLayer, ...config.layers] });
    onSelectLayer(newLayer.id);
  };

  const handleDeleteSelectedLayer = () => {
    if (!activeLayer || config.layers.length <= 1) return;
    const remaining = config.layers.filter((l) => l.id !== activeLayer.id);
    onUpdateConfig({ layers: remaining });
    onSelectLayer(remaining[0]?.id ?? null);
  };

  const getLayerIcon = (type: VisualizerLayerType) => {
    switch (type) {
      case 'geometry-triangle':
        return <Triangle className="w-4 h-4 text-violet-400 fill-violet-400/20" />;
      case 'particles':
        return <Star className="w-4 h-4 text-cyan-400 fill-cyan-400/20" />;
      case 'background-image':
        return <ImageIcon className="w-4 h-4 text-fuchsia-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-violet-300" />;
    }
  };

  return (
    <section
      aria-label="Multi-Layer Visualizer Editor and Presets"
      className="flex flex-col justify-between h-full bg-[#090614]/90 border border-violet-500/15 rounded-2xl p-4 sm:p-6 overflow-y-auto"
    >
      <div>
        {/* Top Header */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-violet-500/15">
          <div>
            <h2 className="text-lg font-bold text-white font-display">
              Layer Editor & Presets
            </h2>
            <p className="text-xs text-slate-400">
              Compose multi-layer Avee geometry, particles, backdrops & presets
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              onUpdateConfig({ showEditorGrid: !config.showEditorGrid })
            }
            aria-label="Toggle canvas alignment grid"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors cursor-pointer ${
              config.showEditorGrid
                ? 'bg-violet-600/25 border-violet-400 text-violet-200'
                : 'bg-[#120C24] border-violet-500/20 text-slate-400 hover:text-white'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            Grid
          </button>
        </div>

        {/* Sub-Navigation Tabs matching Phone 3: Layers | Effects | Presets */}
        <div
          role="tablist"
          aria-label="Editor sections"
          className="grid grid-cols-3 gap-1 p-1 bg-[#120C24] border border-violet-500/15 rounded-xl mt-4"
        >
          {(
            [
              { id: 'layers', label: `Layers (${config.layers.length})` },
              { id: 'effects', label: 'Effects & Transform' },
              { id: 'presets', label: `Presets (${presets.length})` },
            ] as const
          ).map((tab) => {
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  active
                    ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: LAYERS STACK & INSPECTOR (matching Phone 3 in reference image) */}
        {subTab === 'layers' && (
          <div className="mt-3.5 space-y-3">
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {config.layers.map((layer) => {
                const isSelected = activeLayer?.id === layer.id;
                return (
                  <div
                    key={layer.id}
                    onClick={() => onSelectLayer(layer.id)}
                    className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-violet-950/70 border-violet-400/60 shadow-sm'
                        : 'bg-[#120C24]/80 hover:bg-[#17102E] border-violet-500/15'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#090614] border border-violet-500/25 flex items-center justify-center shrink-0">
                        {getLayerIcon(layer.type)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">
                          {layer.name}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          Scale {Math.round(layer.scale * 100)}% · Opacity{' '}
                          {Math.round(layer.opacity * 100)}% · Reacts to{' '}
                          {layer.reactToBand.toUpperCase()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateLayer(layer.id, { visible: !layer.visible });
                        }}
                        aria-label={`Toggle ${layer.name} visibility`}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-violet-500/20 transition-colors cursor-pointer"
                      >
                        {layer.visible ? (
                          <Eye className="w-4 h-4 text-violet-300" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-slate-500" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Active Layer Property Inspector */}
            {activeLayer && (
              <div className="p-4 bg-[#110B22] border border-violet-500/20 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-violet-200">
                    Editing: {activeLayer.name}
                  </span>
                  <select
                    aria-label="Audio band reactivity"
                    value={activeLayer.reactToBand}
                    onChange={(e) =>
                      updateLayer(activeLayer.id, {
                        reactToBand: e.target.value as ReactiveBand,
                      })
                    }
                    className="px-2.5 py-1 text-[11px] bg-[#090614] border border-violet-500/25 rounded-lg text-violet-200"
                  >
                    <option value="bass">React: Bass (Sub)</option>
                    <option value="mid">React: Mid (Synths)</option>
                    <option value="treble">React: Treble (Highs)</option>
                    <option value="full">React: Full Spectrum</option>
                  </select>
                </div>

                {toolMode === 'transform' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">Layer Scale</span>
                        <span className="font-mono text-slate-400">
                          {Math.round(activeLayer.scale * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.4}
                        max={2.0}
                        step={0.05}
                        value={activeLayer.scale}
                        onChange={(e) =>
                          updateLayer(activeLayer.id, {
                            scale: Number(e.target.value),
                          })
                        }
                        aria-label="Layer scale"
                        className="w-full"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">Layer Rotation</span>
                        <span className="font-mono text-slate-400">
                          {activeLayer.rotation}°
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={360}
                        step={5}
                        value={activeLayer.rotation}
                        onChange={(e) =>
                          updateLayer(activeLayer.id, {
                            rotation: Number(e.target.value),
                          })
                        }
                        aria-label="Layer rotation"
                        className="w-full"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">Horizontal Offset</span>
                        <span className="font-mono text-slate-400">
                          {Math.round(activeLayer.xOffset * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-0.35}
                        max={0.35}
                        step={0.01}
                        value={activeLayer.xOffset}
                        onChange={(e) =>
                          updateLayer(activeLayer.id, {
                            xOffset: Number(e.target.value),
                          })
                        }
                        aria-label="Layer horizontal offset"
                        className="w-full"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">Vertical Offset</span>
                        <span className="font-mono text-slate-400">
                          {Math.round(activeLayer.yOffset * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-0.35}
                        max={0.35}
                        step={0.01}
                        value={activeLayer.yOffset}
                        onChange={(e) =>
                          updateLayer(activeLayer.id, {
                            yOffset: Number(e.target.value),
                          })
                        }
                        aria-label="Layer vertical offset"
                        className="w-full"
                      />
                    </div>
                  </div>
                )}

                {toolMode === 'color' && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <label className="flex items-center justify-between p-2.5 bg-[#090614] border border-violet-500/20 rounded-xl text-xs text-slate-200 cursor-pointer">
                      <span>Primary Tint</span>
                      <input
                        type="color"
                        value={activeLayer.colorPrimary}
                        onChange={(e) =>
                          updateLayer(activeLayer.id, {
                            colorPrimary: e.target.value,
                          })
                        }
                        className="w-7 h-7 rounded bg-transparent border-0 cursor-pointer"
                      />
                    </label>
                    <label className="flex items-center justify-between p-2.5 bg-[#090614] border border-violet-500/20 rounded-xl text-xs text-slate-200 cursor-pointer">
                      <span>Secondary Tint</span>
                      <input
                        type="color"
                        value={activeLayer.colorSecondary}
                        onChange={(e) =>
                          updateLayer(activeLayer.id, {
                            colorSecondary: e.target.value,
                          })
                        }
                        className="w-7 h-7 rounded bg-transparent border-0 cursor-pointer"
                      />
                    </label>
                  </div>
                )}

                {toolMode === 'opacity' && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">Layer Opacity</span>
                        <span className="font-mono text-violet-300">
                          {Math.round(activeLayer.opacity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.05}
                        max={1.0}
                        step={0.05}
                        value={activeLayer.opacity}
                        onChange={(e) =>
                          updateLayer(activeLayer.id, {
                            opacity: Number(e.target.value),
                          })
                        }
                        aria-label="Layer opacity"
                        className="w-full"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">
                          Audio Pulse Reactivity
                        </span>
                        <span className="font-mono text-cyan-300">
                          {Math.round(activeLayer.reactivityAmount * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={2.0}
                        step={0.05}
                        value={activeLayer.reactivityAmount}
                        onChange={(e) =>
                          updateLayer(activeLayer.id, {
                            reactivityAmount: Number(e.target.value),
                          })
                        }
                        aria-label="Audio pulse reactivity"
                        className="w-full"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: GLOBAL STAGE EFFECTS & SYMMETRY */}
        {subTab === 'effects' && (
          <div className="mt-4 space-y-4 p-4 bg-[#110B22] border border-violet-500/20 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">
                  Bilateral Spectrum Mirroring
                </p>
                <p className="text-[11px] text-slate-400">
                  Symmetrically mirror low-to-high FFT bins around the ring axis
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateConfig({ mirrorMode: !config.mirrorMode })
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  config.mirrorMode
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {config.mirrorMode ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-violet-500/15">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Stage Scale</span>
                  <span className="font-mono text-slate-400">
                    {Math.round(config.scale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={1.6}
                  step={0.05}
                  value={config.scale}
                  onChange={(e) =>
                    onUpdateConfig({ scale: Number(e.target.value) })
                  }
                  aria-label="Master stage scale"
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Base Orientation</span>
                  <span className="font-mono text-slate-400">
                    {config.baseRotation}°
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={5}
                  value={config.baseRotation}
                  onChange={(e) =>
                    onUpdateConfig({ baseRotation: Number(e.target.value) })
                  }
                  aria-label="Base orientation angle"
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Stage Position X</span>
                  <span className="font-mono text-slate-400">
                    {config.xPosition}%
                  </span>
                </div>
                <input
                  type="range"
                  min={-30}
                  max={30}
                  step={1}
                  value={config.xPosition}
                  onChange={(e) =>
                    onUpdateConfig({ xPosition: Number(e.target.value) })
                  }
                  aria-label="Stage horizontal position"
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Stage Position Y</span>
                  <span className="font-mono text-slate-400">
                    {config.yPosition}%
                  </span>
                </div>
                <input
                  type="range"
                  min={-30}
                  max={30}
                  step={1}
                  value={config.yPosition}
                  onChange={(e) =>
                    onUpdateConfig({ yPosition: Number(e.target.value) })
                  }
                  aria-label="Stage vertical position"
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: REUSABLE PRESETS GALLERY */}
        {subTab === 'presets' && (
          <div className="mt-4 space-y-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const res = onSavePreset(newPresetName);
                if (res.ok) {
                  setSavedBanner(`Saved "${newPresetName.trim()}"`);
                  setNewPresetName('');
                  setTimeout(() => setSavedBanner(''), 2500);
                }
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="Name current studio preset..."
                aria-label="Preset name input"
                className="flex-1 px-3 py-2 text-xs bg-[#120C24] border border-violet-500/25 rounded-xl text-white placeholder:text-slate-500"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl whitespace-nowrap cursor-pointer"
              >
                Save Current
              </button>
            </form>

            {savedBanner && (
              <p className="text-xs text-emerald-300 bg-emerald-950/50 border border-emerald-500/30 rounded-lg px-3 py-1.5">
                {savedBanner}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {presets.map((preset) => {
                const isActive =
                  config.id === preset.id || config.name === preset.name;
                const isCustom = preset.id.startsWith('preset-1');
                return (
                  <div
                    key={preset.id}
                    className={`flex items-center justify-between gap-2 p-3 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-violet-950/70 border-violet-400 shadow-sm'
                        : 'bg-[#120C24] border-violet-500/15 hover:border-violet-500/35'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onLoadPreset(preset)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
                    >
                      <div
                        className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center border border-white/15"
                        style={{
                          background: `linear-gradient(135deg, ${preset.primaryColor}, ${preset.secondaryColor})`,
                        }}
                      >
                        <Bookmark className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">
                          {preset.name}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {preset.style} · {preset.barCount} bars
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-1">
                      {isActive && (
                        <span className="w-6 h-6 rounded-full bg-violet-500/25 text-violet-300 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => onDeletePreset(preset.id)}
                          aria-label={`Delete preset ${preset.name}`}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom 5-Action Editor Toolbar (matching Phone 3 bottom bar: Add | Transform | Color | Opacity | Delete) */}
      <div className="mt-4 pt-3 border-t border-violet-500/15 grid grid-cols-5 gap-1.5">
        <button
          type="button"
          onClick={() => {
            setSubTab('layers');
            handleAddLayer();
          }}
          className="flex flex-col items-center justify-center py-2 rounded-xl bg-[#120C24] hover:bg-violet-950/70 text-slate-300 hover:text-white border border-violet-500/15 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 text-violet-400 mb-0.5" />
          <span className="text-[10px] font-medium">Add</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSubTab('layers');
            setToolMode('transform');
          }}
          className={`flex flex-col items-center justify-center py-2 rounded-xl border transition-colors cursor-pointer ${
            subTab === 'layers' && toolMode === 'transform'
              ? 'bg-violet-600/25 border-violet-400 text-white'
              : 'bg-[#120C24] border-violet-500/15 text-slate-300 hover:text-white'
          }`}
        >
          <Move className="w-4 h-4 text-cyan-400 mb-0.5" />
          <span className="text-[10px] font-medium">Transform</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSubTab('layers');
            setToolMode('color');
          }}
          className={`flex flex-col items-center justify-center py-2 rounded-xl border transition-colors cursor-pointer ${
            subTab === 'layers' && toolMode === 'color'
              ? 'bg-violet-600/25 border-violet-400 text-white'
              : 'bg-[#120C24] border-violet-500/15 text-slate-300 hover:text-white'
          }`}
        >
          <Palette className="w-4 h-4 text-fuchsia-400 mb-0.5" />
          <span className="text-[10px] font-medium">Color</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSubTab('layers');
            setToolMode('opacity');
          }}
          className={`flex flex-col items-center justify-center py-2 rounded-xl border transition-colors cursor-pointer ${
            subTab === 'layers' && toolMode === 'opacity'
              ? 'bg-violet-600/25 border-violet-400 text-white'
              : 'bg-[#120C24] border-violet-500/15 text-slate-300 hover:text-white'
          }`}
        >
          <Droplet className="w-4 h-4 text-sky-400 mb-0.5" />
          <span className="text-[10px] font-medium">Opacity</span>
        </button>

        <button
          type="button"
          onClick={handleDeleteSelectedLayer}
          aria-label="Delete selected layer"
          className="flex flex-col items-center justify-center py-2 rounded-xl bg-[#120C24] hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-violet-500/15 transition-colors cursor-pointer"
        >
          <Trash2 className="w-4 h-4 text-rose-400 mb-0.5" />
          <span className="text-[10px] font-medium">Delete</span>
        </button>
      </div>
    </section>
  );
};
