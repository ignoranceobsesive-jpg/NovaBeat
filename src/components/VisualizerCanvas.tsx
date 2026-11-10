import React, { useEffect, useRef } from 'react';
import {
  FrequencyBands,
  Track,
  VisualizerConfig,
  VisualizerLayer,
} from '../types/novabeat';

interface ParticleNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  hueShift: number;
}

interface VisualizerCanvasProps {
  config: VisualizerConfig;
  track: Track;
  isPlaying: boolean;
  sampleFrame: (
    barCount: number,
    sensitivity: number,
    smoothing: number
  ) => { currentTimeSec: number; bands: FrequencyBands };
  onTelemetryUpdate?: (currentTimeSec: number, bands: FrequencyBands) => void;
  selectedLayerId?: string | null;
  showEditorHandles?: boolean;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  className?: string;
  aspectRatioMode?: '16:9' | '9:16' | '1:1' | 'auto';
}

export const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({
  config,
  track,
  isPlaying,
  sampleFrame,
  onTelemetryUpdate,
  selectedLayerId,
  showEditorHandles = false,
  onCanvasReady,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const configRef = useRef<VisualizerConfig>(config);
  const trackRef = useRef<Track>(track);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const selectedLayerRef = useRef<string | null | undefined>(selectedLayerId);
  const showHandlesRef = useRef<boolean>(showEditorHandles);
  const sampleFrameRef = useRef(sampleFrame);
  const telemetryCallbackRef = useRef(onTelemetryUpdate);

  // Pre-allocated image cache for background and center emblem
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const bgUrlLoadedRef = useRef<string>('');
  const centerImageRef = useRef<HTMLImageElement | null>(null);
  const centerUrlLoadedRef = useRef<string>('');

  // Pre-allocated particle pool (zero allocations inside render loop)
  const particlesRef = useRef<ParticleNode[]>([]);
  const rotationAngleRef = useRef<number>(0);
  const lastTelemetryTimeRef = useRef<number>(0);

  configRef.current = config;
  trackRef.current = track;
  isPlayingRef.current = isPlaying;
  selectedLayerRef.current = selectedLayerId;
  showHandlesRef.current = showEditorHandles;
  sampleFrameRef.current = sampleFrame;
  telemetryCallbackRef.current = onTelemetryUpdate;

  // Initialize particle pool once
  useEffect(() => {
    const pool: ParticleNode[] = [];
    for (let i = 0; i < 72; i++) {
      pool.push({
        x: (Math.sin(i * 12.9898) * 43758.5453) % 1,
        y: (Math.cos(i * 78.233) * 19341.231) % 1,
        vx: ((i % 7) - 3) * 0.0006,
        vy: -0.0008 - (i % 5) * 0.0005,
        size: 1.5 + (i % 4) * 1.1,
        alpha: 0.25 + (i % 6) * 0.12,
        hueShift: i % 2 === 0 ? 0 : 1,
      });
    }
    particlesRef.current = pool;
  }, []);

  // Load background image when URL changes
  useEffect(() => {
    const targetBg =
      config.backgroundUrl || track.customBackdropUrl || track.coverUrl;
    if (targetBg && targetBg !== bgUrlLoadedRef.current) {
      bgUrlLoadedRef.current = targetBg;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        bgImageRef.current = img;
      };
      img.src = targetBg;
    }
  }, [config.backgroundUrl, track.customBackdropUrl, track.coverUrl]);

  // Load center custom image when URL changes
  useEffect(() => {
    const targetCenter = config.centerImageUrl;
    if (targetCenter && targetCenter !== centerUrlLoadedRef.current) {
      centerUrlLoadedRef.current = targetCenter;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        centerImageRef.current = img;
      };
      img.src = targetCenter;
    } else if (!targetCenter) {
      centerUrlLoadedRef.current = '';
      centerImageRef.current = null;
    }
  }, [config.centerImageUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onCanvasReady?.(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let lastFramePerf = performance.now();

    const getLayer = (
      layers: VisualizerLayer[],
      type: VisualizerLayer['type']
    ): VisualizerLayer | undefined => layers.find((l) => l.type === type);

    const getBandValue = (
      bands: FrequencyBands,
      band: VisualizerLayer['reactToBand']
    ): number => {
      switch (band) {
        case 'bass':
          return bands.bass;
        case 'mid':
          return bands.mid;
        case 'treble':
          return bands.treble;
        default:
          return bands.overall;
      }
    };

    const drawStage = (now: number) => {
      lastFramePerf = now;
      const cfg = configRef.current;
      const { currentTimeSec, bands } = sampleFrameRef.current(
        cfg.barCount,
        cfg.sensitivity,
        cfg.smoothing
      );

      // Throttle React HUD telemetry updates to ~15Hz so React never re-renders at 60Hz
      if (now - lastTelemetryTimeRef.current > 66) {
        lastTelemetryTimeRef.current = now;
        telemetryCallbackRef.current?.(currentTimeSec, bands);
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const targetW = Math.max(300, Math.floor(rect.width * dpr));
      const targetH = Math.max(240, Math.floor(rect.height * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      const w = canvas.width;
      const h = canvas.height;
      const minDim = Math.min(w, h);

      // Advance rotation angle smoothly
      if (isPlayingRef.current) {
        rotationAngleRef.current += (cfg.rotationSpeed * Math.PI) / 180 / 60;
      }
      const totalRotation =
        ((cfg.baseRotation * Math.PI) / 180 + rotationAngleRef.current) %
        (Math.PI * 2);

      // 1. Base deep obsidian background clear
      ctx.save();
      ctx.fillStyle = '#070510';
      ctx.fillRect(0, 0, w, h);

      // 2. Background Layer
      const bgLayer = getLayer(cfg.layers, 'background-image');
      if (!bgLayer || bgLayer.visible) {
        const bgOpacity = bgLayer ? bgLayer.opacity : 0.55;
        const bgReact = bgLayer
          ? getBandValue(bands, bgLayer.reactToBand) * bgLayer.reactivityAmount
          : bands.bass * 0.3;
        const bgScale = (bgLayer ? bgLayer.scale : 1.05) + bgReact * 0.12;

        ctx.save();
        ctx.globalAlpha = bgOpacity;
        ctx.translate(
          w * (0.5 + (bgLayer?.xOffset ?? 0)),
          h * (0.5 + (bgLayer?.yOffset ?? 0))
        );
        ctx.scale(bgScale, bgScale);

        if (bgImageRef.current && bgImageRef.current.complete) {
          const img = bgImageRef.current;
          const imgRatio = img.width / Math.max(1, img.height);
          const canvasRatio = w / h;
          let drawW = w;
          let drawH = h;
          if (imgRatio > canvasRatio) {
            drawW = h * imgRatio;
          } else {
            drawH = w / imgRatio;
          }
          ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        } else {
          const radGrad = ctx.createRadialGradient(
            0,
            0,
            minDim * 0.05,
            0,
            0,
            minDim * 0.75
          );
          radGrad.addColorStop(0, cfg.primaryColor + '44');
          radGrad.addColorStop(0.55, '#130929');
          radGrad.addColorStop(1, '#06040D');
          ctx.fillStyle = radGrad;
          ctx.fillRect(-w / 2, -h / 2, w, h);
        }
        ctx.restore();

        // Atmospheric dark radial vignette for crisp foreground contrast
        const vig = ctx.createRadialGradient(
          w * 0.5,
          h * 0.5,
          minDim * 0.18,
          w * 0.5,
          h * 0.5,
          Math.max(w, h) * 0.72
        );
        vig.addColorStop(0, 'rgba(7, 5, 16, 0.18)');
        vig.addColorStop(0.7, 'rgba(7, 5, 16, 0.62)');
        vig.addColorStop(1, 'rgba(5, 3, 12, 0.92)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, w, h);
      }

      // 3. Particles Layer
      const particleLayer = getLayer(cfg.layers, 'particles');
      if (!particleLayer || particleLayer.visible) {
        const pAlpha = particleLayer ? particleLayer.opacity : 0.85;
        const pEnergy = particleLayer
          ? getBandValue(bands, particleLayer.reactToBand) *
            particleLayer.reactivityAmount
          : bands.bass;
        const pColor1 = particleLayer?.colorPrimary || cfg.secondaryColor;
        const pColor2 = particleLayer?.colorSecondary || cfg.primaryColor;

        ctx.save();
        const pool = particlesRef.current;
        for (let i = 0; i < pool.length; i++) {
          const p = pool[i];
          const speedBoost = 1 + pEnergy * 3.8;
          p.x += p.vx * speedBoost;
          p.y += p.vy * speedBoost;

          if (p.y < -0.05) p.y = 1.05;
          if (p.y > 1.05) p.y = -0.05;
          if (p.x < -0.05) p.x = 1.05;
          if (p.x > 1.05) p.x = -0.05;

          const px = Math.abs(p.x) * w;
          const py = Math.abs(p.y) * h;
          const radius =
            (p.size + pEnergy * 3.2) * (particleLayer?.scale ?? 1.0) * (dpr * 0.85);

          ctx.globalAlpha = Math.min(1, p.alpha * pAlpha * (0.55 + pEnergy * 0.7));
          ctx.fillStyle = p.hueShift === 0 ? pColor1 : pColor2;
          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Compute primary stage anchor with user X/Y & Scale
      const centerX = w * (0.5 + cfg.xPosition / 100);
      const centerY = h * (0.48 + cfg.yPosition / 100);
      const masterScale = cfg.scale * cfg.spectrumSize;
      const baseRadius = minDim * 0.23 * masterScale * (1 + bands.bass * 0.08);

      // 4. Spectrum / Main Visualizer Layer
      const specLayer = getLayer(cfg.layers, 'spectrum-ring');
      if (!specLayer || specLayer.visible) {
        ctx.save();
        ctx.globalAlpha = cfg.opacity * (specLayer?.opacity ?? 1.0);
        ctx.translate(
          centerX + (specLayer?.xOffset ?? 0) * w,
          centerY + (specLayer?.yOffset ?? 0) * h
        );
        ctx.scale(specLayer?.scale ?? 1.0, specLayer?.scale ?? 1.0);

        if (cfg.glowIntensity > 5) {
          ctx.shadowBlur = (cfg.glowIntensity * 0.36 + bands.bass * 18) * dpr;
          ctx.shadowColor = cfg.primaryColor;
        }

        const spec = bands.spectrum;
        const barLen = spec.length;

        if (cfg.style === 'circular-spectrum') {
          ctx.rotate(totalRotation);
          // Ambient ring halo
          ctx.strokeStyle = cfg.primaryColor + '66';
          ctx.lineWidth = 2 * dpr;
          ctx.beginPath();
          ctx.arc(0, 0, baseRadius * 0.97, 0, Math.PI * 2);
          ctx.stroke();

          const maxBarHeight = minDim * 0.19 * masterScale;
          for (let i = 0; i < barLen; i++) {
            const angle = (i / barLen) * Math.PI * 2;
            const mirrorIdx = cfg.mirrorMode
              ? i < barLen / 2
                ? i * 2
                : (barLen - 1 - i) * 2
              : i;
            const safeIdx = Math.min(barLen - 1, mirrorIdx);
            const val = spec[safeIdx];
            const barH = Math.max(4 * dpr, val * maxBarHeight);

            const x0 = Math.cos(angle) * baseRadius;
            const y0 = Math.sin(angle) * baseRadius;
            const x1 = Math.cos(angle) * (baseRadius + barH);
            const y1 = Math.sin(angle) * (baseRadius + barH);

            // Gradient interpolation around circle (Cyan -> Purple -> Magenta)
            const t = Math.sin(angle) * 0.5 + 0.5;
            ctx.strokeStyle =
              t < 0.35
                ? cfg.secondaryColor
                : t < 0.72
                ? cfg.primaryColor
                : cfg.accentColor;
            ctx.lineWidth = Math.max(2 * dpr, (minDim / barLen) * 0.95);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
          }
        } else if (cfg.style === 'avee-wave-rings') {
          // Multi-ring Avee Player style smooth harmonic contour rings
          ctx.rotate(totalRotation * 0.6);
          const ringColors = [
            cfg.primaryColor,
            cfg.accentColor,
            cfg.secondaryColor,
            '#FBBF24',
          ];

          for (let ring = 0; ring < 4; ring++) {
            const phaseOffset = ring * 1.15 + now * 0.003;
            ctx.strokeStyle = ringColors[ring % ringColors.length];
            ctx.lineWidth = (3.4 - ring * 0.55) * dpr;
            ctx.beginPath();

            const points = 120;
            for (let p = 0; p <= points; p++) {
              const norm = (p % points) / points;
              const angle = norm * Math.PI * 2;
              const lobe1 = Math.pow(
                Math.max(0, Math.sin(angle * 3 + phaseOffset)),
                2
              );
              const lobe2 = Math.pow(
                Math.max(0, Math.cos(angle * 5 - phaseOffset * 0.7)),
                2
              );
              const harmonicWave =
                (lobe1 * bands.bass * 0.75 + lobe2 * bands.mid * 0.45) *
                minDim *
                0.085 *
                masterScale;
              const r = baseRadius * (1.0 + ring * 0.014) + harmonicWave;

              const px = Math.cos(angle) * r;
              const py = Math.sin(angle) * r;
              if (p === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
          }
        } else if (cfg.style === 'vertical-bars') {
          const totalWidth = w * 0.82 * masterScale;
          const startX = -totalWidth / 2;
          const baselineY = h * 0.24;
          const maxBarH = h * 0.48 * masterScale;
          const slotW = totalWidth / barLen;
          const barW = Math.max(2 * dpr, slotW * 0.68);

          const grad = ctx.createLinearGradient(0, baselineY, 0, baselineY - maxBarH);
          grad.addColorStop(0, cfg.secondaryColor);
          grad.addColorStop(0.55, cfg.primaryColor);
          grad.addColorStop(1, cfg.accentColor);

          for (let i = 0; i < barLen; i++) {
            const val = spec[i];
            const bh = Math.max(4 * dpr, val * maxBarH);
            const bx = startX + i * slotW;

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(bx, baselineY - bh, barW, bh, 3 * dpr);
            ctx.fill();

            // Subtle floor reflection
            ctx.globalAlpha = 0.22 * cfg.opacity;
            ctx.beginPath();
            ctx.roundRect(bx, baselineY + 4 * dpr, barW, bh * 0.32, 2 * dpr);
            ctx.fill();
            ctx.globalAlpha = cfg.opacity;
          }
        } else if (cfg.style === 'horizontal-spectrum') {
          const totalWidth = w * 0.84 * masterScale;
          const startX = -totalWidth / 2;
          const maxHalfH = h * 0.28 * masterScale;
          const slotW = totalWidth / barLen;
          const barW = Math.max(2 * dpr, slotW * 0.65);

          // Glowing center horizon line
          ctx.strokeStyle = cfg.secondaryColor;
          ctx.lineWidth = 1.5 * dpr;
          ctx.beginPath();
          ctx.moveTo(startX, 0);
          ctx.lineTo(startX + totalWidth, 0);
          ctx.stroke();

          for (let i = 0; i < barLen; i++) {
            const idx = cfg.mirrorMode
              ? Math.abs(Math.floor(barLen / 2) - i) * 2
              : i;
            const val = spec[Math.min(barLen - 1, idx)];
            const bh = Math.max(3 * dpr, val * maxHalfH);
            const bx = startX + i * slotW;

            ctx.fillStyle = i % 2 === 0 ? cfg.primaryColor : cfg.secondaryColor;
            ctx.beginPath();
            ctx.roundRect(bx, -bh, barW, bh * 2, 4 * dpr);
            ctx.fill();
          }
        } else if (cfg.style === 'audio-waveform') {
          const wave = bands.waveform;
          const totalWidth = w * 0.86 * masterScale;
          const startX = -totalWidth / 2;
          const ampScale = h * 0.28 * masterScale;

          // Secondary harmonic shadow ribbon
          ctx.strokeStyle = cfg.secondaryColor;
          ctx.lineWidth = 2.5 * dpr;
          ctx.beginPath();
          for (let i = 0; i < wave.length; i++) {
            const x = startX + (i / (wave.length - 1)) * totalWidth;
            const y = Math.sin(i * 0.15 + now * 0.005) * wave[i] * ampScale * 0.85;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // Primary waveform trace
          ctx.strokeStyle = cfg.primaryColor;
          ctx.lineWidth = 4 * dpr;
          ctx.beginPath();
          for (let i = 0; i < wave.length; i++) {
            const x = startX + (i / (wave.length - 1)) * totalWidth;
            const y = wave[i] * ampScale;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        } else if (cfg.style === 'radial-waveform') {
          ctx.rotate(totalRotation);
          const wave = bands.waveform;
          const len = wave.length;

          ctx.strokeStyle = cfg.secondaryColor;
          ctx.lineWidth = 3.5 * dpr;
          ctx.beginPath();
          for (let i = 0; i <= len; i++) {
            const idx = i % len;
            const angle = (i / len) * Math.PI * 2;
            const r = baseRadius * 1.05 + wave[idx] * minDim * 0.12 * masterScale;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
        } else if (cfg.style === 'particle-reactor') {
          ctx.rotate(totalRotation);
          // Shockwave rings
          for (let rIdx = 0; rIdx < 3; rIdx++) {
            const pulseR =
              baseRadius * (0.75 + rIdx * 0.28 + bands.bass * 0.22);
            ctx.strokeStyle =
              rIdx === 0
                ? cfg.primaryColor
                : rIdx === 1
                ? cfg.secondaryColor
                : cfg.accentColor;
            ctx.lineWidth = (3 - rIdx * 0.7) * dpr;
            ctx.beginPath();
            ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
            ctx.stroke();
          }
          // Radial burst rays
          for (let i = 0; i < barLen; i += 2) {
            const angle = (i / barLen) * Math.PI * 2;
            const val = spec[i];
            const innerR = baseRadius * 0.65;
            const outerR = innerR + val * minDim * 0.24 * masterScale;
            ctx.strokeStyle = i % 4 === 0 ? cfg.secondaryColor : cfg.accentColor;
            ctx.lineWidth = 2.5 * dpr;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
            ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // 5. Neon Triangle Geometry Layer (matching Editor center screenshot)
      const triLayer = getLayer(cfg.layers, 'geometry-triangle');
      if (
        triLayer &&
        triLayer.visible &&
        (cfg.style === 'radial-waveform' ||
          cfg.style === 'circular-spectrum' ||
          showHandlesRef.current)
      ) {
        const triBand = getBandValue(bands, triLayer.reactToBand);
        const triScale =
          triLayer.scale * masterScale * (1 + triBand * 0.14 * triLayer.reactivityAmount);
        const triR = minDim * 0.2 * triScale;

        ctx.save();
        ctx.globalAlpha = triLayer.opacity * cfg.opacity;
        ctx.translate(
          centerX + triLayer.xOffset * w,
          centerY + triLayer.yOffset * h
        );
        ctx.rotate((triLayer.rotation * Math.PI) / 180);

        ctx.shadowBlur = 24 * dpr;
        ctx.shadowColor = triLayer.colorPrimary || cfg.primaryColor;
        ctx.strokeStyle = triLayer.colorPrimary || '#C084FC';
        ctx.lineWidth = 3.5 * dpr;

        ctx.beginPath();
        ctx.moveTo(0, -triR * 0.92);
        ctx.lineTo(-triR * 0.86, triR * 0.68);
        ctx.lineTo(triR * 0.86, triR * 0.68);
        ctx.closePath();
        ctx.stroke();

        ctx.restore();
      }

      // 6. Center Emblem / Personal Image Layer
      const emblemLayer = getLayer(cfg.layers, 'center-emblem');
      if (
        (!emblemLayer || emblemLayer.visible) &&
        (cfg.style === 'circular-spectrum' ||
          cfg.style === 'avee-wave-rings' ||
          cfg.style === 'radial-waveform' ||
          cfg.style === 'particle-reactor')
      ) {
        const embBand = emblemLayer
          ? getBandValue(bands, emblemLayer.reactToBand)
          : bands.bass;
        const embScale =
          (emblemLayer?.scale ?? 1.0) *
          masterScale *
          (1 + embBand * 0.12 * (emblemLayer?.reactivityAmount ?? 0.8));
        const innerRadius = baseRadius * 0.56 * embScale;

        ctx.save();
        ctx.globalAlpha = (emblemLayer?.opacity ?? 0.95) * cfg.opacity;
        ctx.translate(
          centerX + (emblemLayer?.xOffset ?? 0) * w,
          centerY + (emblemLayer?.yOffset ?? 0) * h
        );

        // Dark circular core disc
        ctx.fillStyle = '#090614';
        ctx.beginPath();
        ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
        ctx.fill();

        if (centerImageRef.current && centerImageRef.current.complete) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(0, 0, innerRadius * 0.94, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(
            centerImageRef.current,
            -innerRadius,
            -innerRadius,
            innerRadius * 2,
            innerRadius * 2
          );
          ctx.restore();
        } else {
          // Signature NovaBeat 7-bar glowing equalizer emblem inside the circle
          const eqBars = 7;
          const eqSpan = innerRadius * 0.78;
          const barSpacing = eqSpan / eqBars;
          const barThickness = Math.max(3 * dpr, barSpacing * 0.48);

          for (let b = 0; b < eqBars; b++) {
            const centerDist = Math.abs(b - 3) / 3;
            const eqVal =
              (1 - centerDist * 0.58) * (0.35 + bands.bass * 0.65);
            const eqH = Math.max(8 * dpr, eqVal * innerRadius * 0.85);
            const bx = -eqSpan / 2 + b * barSpacing + (barSpacing - barThickness) / 2;

            ctx.fillStyle = b % 2 === 0 ? cfg.primaryColor : cfg.secondaryColor;
            ctx.shadowBlur = 12 * dpr;
            ctx.shadowColor = cfg.primaryColor;
            ctx.beginPath();
            ctx.roundRect(bx, -eqH / 2, barThickness, eqH, barThickness / 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      // 7. Editor Grid & Selection Bounding Box (when in Editor screen or toggled)
      if (showHandlesRef.current || cfg.showEditorGrid) {
        ctx.save();
        const boxSize = minDim * 0.66;
        const bx = centerX - boxSize / 2;
        const by = centerY - boxSize / 2;

        // Subtle 4x4 perspective grid
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.22)';
        ctx.lineWidth = 1 * dpr;
        for (let g = 1; g < 4; g++) {
          const gx = bx + (boxSize / 4) * g;
          const gy = by + (boxSize / 4) * g;
          ctx.beginPath();
          ctx.moveTo(gx, by);
          ctx.lineTo(gx, by + boxSize);
          ctx.moveTo(bx, gy);
          ctx.lineTo(bx + boxSize, gy);
          ctx.stroke();
        }

        // Outer bounding frame with 4 white corner handles matching middle Editor screenshot
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.72)';
        ctx.lineWidth = 1.5 * dpr;
        ctx.strokeRect(bx, by, boxSize, boxSize);

        const corners = [
          [bx, by],
          [bx + boxSize, by],
          [bx, by + boxSize],
          [bx + boxSize, by + boxSize],
        ];
        ctx.fillStyle = '#FFFFFF';
        for (const [cx, cy] of corners) {
          ctx.beginPath();
          ctx.arc(cx, cy, 5.5 * dpr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.restore();
    };

    const renderLoop = (now: number) => {
      drawStage(now);
      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);

    // Fallback heartbeat ensures canvas and audio clock keep advancing during MediaRecorder export or background tabs
    const heartbeatId = window.setInterval(() => {
      const now = performance.now();
      if (now - lastFramePerf > 48) {
        drawStage(now);
      }
    }, 40);

    return () => {
      cancelAnimationFrame(animId);
      window.clearInterval(heartbeatId);
    };
  }, [onCanvasReady]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="novabeat-visualizer-canvas"
      aria-label={`Real-time audio visualizer displaying ${config.style} for ${track.title}`}
      className={`block w-full h-full select-none ${className}`}
    />
  );
};
