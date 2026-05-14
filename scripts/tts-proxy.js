const http = require('http');
const { URL } = require('url');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), '.env'), override: true });

const PORT = Number(process.env.TTS_PROXY_PORT || 8787);
const HOST = process.env.TTS_PROXY_HOST || '127.0.0.1';
const GOOGLE_TTS_API_KEY = process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
const GOOGLE_TTS_DEFAULT_VOICE_NAME = process.env.GOOGLE_TTS_DEFAULT_VOICE_NAME || 'en-US-Neural2-F';
const GOOGLE_TTS_DEFAULT_LANGUAGE_CODE = process.env.GOOGLE_TTS_DEFAULT_LANGUAGE_CODE || 'en-US';

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res, statusCode, payload) {
  setCors(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

async function handleGoogleTts(req, res) {
  if (!GOOGLE_TTS_API_KEY) {
    sendJson(res, 500, { error: 'GOOGLE_TTS_API_KEY is missing in server env.' });
    return;
  }

  let payload = {};
  try {
    const raw = await readBody(req);
    payload = raw ? JSON.parse(raw) : {};
  } catch (error) {
    sendJson(res, 400, { error: `Invalid JSON body: ${error.message}` });
    return;
  }

  const text = String(payload.text || '').trim();
  if (!text) {
    sendJson(res, 400, { error: 'text is required' });
    return;
  }

  const voiceName = String(payload.voiceName || GOOGLE_TTS_DEFAULT_VOICE_NAME || '').trim();
  const languageCode = String(payload.languageCode || GOOGLE_TTS_DEFAULT_LANGUAGE_CODE || 'en-US').trim();
  const speakingRate = clamp(payload.speakingRate, 0.25, 2, 1);
  const pitch = clamp(payload.pitch, -20, 20, 0);
  const audioEncoding = String(payload.audioEncoding || 'MP3').trim().toUpperCase();

  const body = {
    input: { text: text.slice(0, 4800) },
    voice: {
      languageCode,
      name: voiceName || undefined,
    },
    audioConfig: {
      audioEncoding,
      speakingRate,
      pitch,
    },
  };

  try {
    const upstream = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(GOOGLE_TTS_API_KEY)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    const json = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const detail = json?.error?.message || `HTTP ${upstream.status}`;
      sendJson(res, upstream.status, { error: `Google TTS request failed: ${detail}` });
      return;
    }

    const audioContent = String(json?.audioContent || '');
    if (!audioContent) {
      sendJson(res, 502, { error: 'Google TTS returned empty audioContent' });
      return;
    }

    const audioBuffer = Buffer.from(audioContent, 'base64');
    setCors(res);
    res.statusCode = 200;
    res.setHeader('Content-Type', audioEncoding === 'MP3' ? 'audio/mpeg' : 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(audioBuffer);
  } catch (error) {
    sendJson(res, 500, { error: `Google proxy failed: ${error.message || String(error)}` });
  }
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (req.method === 'OPTIONS') {
    setCors(res);
    res.statusCode = 204;
    res.end('');
    return;
  }

  if (requestUrl.pathname === '/health' && req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      service: 'tts-proxy',
      provider: 'google-tts',
      googleApiKeyConfigured: Boolean(GOOGLE_TTS_API_KEY),
    });
    return;
  }

  if (requestUrl.pathname === '/google-tts' && req.method === 'POST') {
    await handleGoogleTts(req, res);
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`[tts-proxy] Listening at http://${HOST}:${PORT}`);
  console.log('[tts-proxy] POST /google-tts');
  console.log('[tts-proxy] GET  /health');
  if (!GOOGLE_TTS_API_KEY) {
    console.warn('[tts-proxy] GOOGLE_TTS_API_KEY is missing in .env');
  }
});
