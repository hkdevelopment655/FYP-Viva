import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();
const AI_URL = () => process.env.AI_SERVICE_URL || 'http://localhost:8000';

// ── AI / SD Status check ───────────────────────────────────────────────────
router.get('/sd-status', async (req, res) => {
  try {
    const response = await fetch(`${AI_URL()}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('health check failed');
    const data = await response.json();
    return res.json({
      sdAvailable: data.sd_configured || false,
      mediapipeOk: data.mediapipe_ok || false,
      mediapipe: data.mediapipe || 'unknown',
      gemini: data.gemini_configured || false,
      status: data.status || 'OK',
    });
  } catch {
    return res.json({ sdAvailable: false, mediapipeOk: false, reason: 'AI service offline' });
  }
});

export default router;