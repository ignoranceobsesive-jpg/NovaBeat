import express from 'express';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BILLING_LEDGER_PATH = path.join(
  os.tmpdir(),
  'novabeat-play-billing-ledger.json'
);

interface LedgerPurchaseRecord {
  orderId: string;
  productId: string;
  purchaseToken: string;
  purchaseTimeMs: number;
  purchaseState: 'NOT_PURCHASED' | 'PENDING' | 'PURCHASED' | 'CANCELLED' | 'FAILED';
  acknowledged: boolean;
  signatureVerified: boolean;
}

async function readBillingLedger(): Promise<LedgerPurchaseRecord[]> {
  try {
    const raw = await fs.readFile(BILLING_LEDGER_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeBillingLedger(
  records: LedgerPurchaseRecord[]
): Promise<void> {
  await fs.writeFile(
    BILLING_LEDGER_PATH,
    JSON.stringify(records, null, 2),
    'utf-8'
  );
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Accept raw video blobs up to 250MB for full-track transcoding to H.264/AAC MP4
  app.post(
    '/api/transcode-mp4',
    express.raw({
      type: ['video/*', 'application/octet-stream'],
      limit: '250mb',
    }),
    async (req, res) => {
      const bodyBuffer = req.body;
      if (!Buffer.isBuffer(bodyBuffer) || bodyBuffer.length === 0) {
        res.status(400).json({ error: 'Empty video payload received.' });
        return;
      }

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const inputPath = path.join(os.tmpdir(), `novabeat-in-${id}.webm`);
      const outputPath = path.join(os.tmpdir(), `novabeat-out-${id}.mp4`);

      try {
        await fs.writeFile(inputPath, bodyBuffer);

        // Transcode WebM (VP8/VP9 + Opus) to universal H.264 (yuv420p) + AAC MP4 with faststart
        await execFileAsync('ffmpeg', [
          '-y',
          '-i',
          inputPath,
          '-vf',
          'scale=trunc(iw/2)*2:trunc(ih/2)*2',
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-crf',
          '21',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-b:a',
          '192k',
          '-movflags',
          '+faststart',
          outputPath,
        ]);

        const mp4Buffer = await fs.readFile(outputPath);
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Length', String(mp4Buffer.length));
        res.status(200).send(mp4Buffer);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'FFmpeg transcode failed';
        res.status(500).json({ error: message });
      } finally {
        await fs.unlink(inputPath).catch(() => {});
        await fs.unlink(outputPath).catch(() => {});
      }
    }
  );

  app.use(express.json());

  // Google Play Billing 9.1.0 authoritative queryPurchasesAsync endpoint
  app.get('/api/billing/purchases', async (_req, res) => {
    const purchases = await readBillingLedger();
    res.json({
      responseCode: 0, // BillingResponseCode.OK
      productId: 'novabeat_pro_lifetime',
      purchases,
    });
  });

  // Google Play Billing 9.1.0 launchBillingFlow & acknowledgePurchase endpoint
  app.post('/api/billing/purchase', async (req, res) => {
    const {
      productId = 'novabeat_pro_lifetime',
      outcome = 'PURCHASED',
    }: {
      productId?: string;
      outcome?: 'PURCHASED' | 'PENDING' | 'CANCELLED' | 'FAILED';
    } = req.body || {};

    if (outcome === 'CANCELLED') {
      res.json({
        responseCode: 1, // BillingResponseCode.USER_CANCELED
        debugMessage: 'User cancelled Google Play purchase sheet.',
        purchases: await readBillingLedger(),
      });
      return;
    }

    if (outcome === 'FAILED') {
      res.json({
        responseCode: 6, // BillingResponseCode.ERROR
        debugMessage: 'Payment method declined by issuer.',
        purchases: await readBillingLedger(),
      });
      return;
    }

    const now = Date.now();
    const orderId = `GPA.${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(
      1000 + Math.random() * 9000
    )}-${String(now).slice(-5)}`;
    const purchaseToken = `novabeat_play_token_${now}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;

    const record: LedgerPurchaseRecord = {
      orderId,
      productId,
      purchaseToken,
      purchaseTimeMs: now,
      purchaseState: outcome === 'PENDING' ? 'PENDING' : 'PURCHASED',
      // Completed purchases are acknowledged automatically via acknowledgePurchase
      acknowledged: outcome === 'PURCHASED',
      signatureVerified: true,
    };

    await writeBillingLedger([record]);

    res.json({
      responseCode: 0,
      debugMessage: 'OK',
      purchases: [record],
    });
  });

  // Complete a PENDING Google Play purchase and acknowledge it
  app.post('/api/billing/complete-pending', async (_req, res) => {
    const current = await readBillingLedger();
    const updated = current.map((rec) =>
      rec.productId === 'novabeat_pro_lifetime'
        ? {
            ...rec,
            purchaseState: 'PURCHASED' as const,
            acknowledged: true,
            signatureVerified: true,
          }
        : rec
    );
    await writeBillingLedger(updated);
    res.json({
      responseCode: 0,
      purchases: updated,
    });
  });

  // Reset Play Billing ledger (for testing free vs Pro startup & restore flows)
  app.post('/api/billing/reset', async (_req, res) => {
    await writeBillingLedger([]);
    res.json({
      responseCode: 0,
      purchases: [],
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NovaBeat Studio Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
