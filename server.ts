import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import FormData from "form-data";
import crypto from "crypto";

// Load environment early
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!ELEVENLABS_API_KEY || !GEMINI_API_KEY) {
  console.error("FATAL ERROR: ELEVENLABS_API_KEY or GEMINI_API_KEY environment variables are missing.");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for audio uploads
// Limit file size to 10MB given the 30-60 second max length recommendation
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['audio/wav', 'audio/webm', 'audio/m4a', 'audio/mp4', 'audio/mpeg', 'audio/ogg'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  }
});

// Simple in-memory cache for repeated TTS phrases (e.g. standard greetings or common fallsbacks)
const ttsCache = new Map<string, { buffer: Buffer, contentType: string }>();
const MAX_CACHE_SIZE = 500;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/transcribe", upload.single('audio'), async (req, res) => {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    console.log(JSON.stringify({ event: 'STT_START', requestId, params: { size: req.file?.size, type: req.file?.mimetype } }));

    try {
      if (!req.file) {
        throw new Error("No audio file provided");
      }
      if (req.file.buffer.length < 100) {
        // Discard extremely small (likely empty) payloads to prevent API failures
        throw new Error("INVALID_AUDIO");
      }

      let mimeType = req.file.mimetype || 'audio/webm';
      // Strip codec suffix like audio/webm;codecs=opus
      mimeType = mimeType.split(';')[0].trim();
      
      let ext = 'webm';
      if (mimeType.includes('mp4')) ext = 'm4a';
      else if (mimeType.includes('mpeg')) ext = 'mp3';
      else if (mimeType.includes('ogg')) ext = 'ogg';
      else if (mimeType.includes('aac')) ext = 'aac';

      const form = new FormData();
      form.append("file", req.file.buffer, {
        filename: `recording.${ext}`,
        contentType: mimeType,
      });
      form.append("model_id", "scribe_v1"); // ElevenLabs STT model

      const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY!,
          ...form.getHeaders()
        },
        body: form as any,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let parsedReason = "unknown_error";
        try {
          const errData = JSON.parse(errorText);
          parsedReason = errData.detail?.status || errData.detail?.message || errData.detail || errData.message || "unknown_error";
        } catch (e) {
          // Fallback classification only when parsing fails
          parsedReason = "unparseable_error_payload";
        }
        
        console.error(JSON.stringify({ event: 'STT_API_ERROR', requestId, status: response.status, reason: String(parsedReason).substring(0, 100) }));
        
        if (response.status === 429) throw new Error("RATE_LIMIT");
        if (response.status === 400 || response.status === 422) {
          throw new Error("INVALID_AUDIO");
        }
        throw new Error("API_ERROR");
      }

      const data = await response.json();
      const text = data.text || '';
      let confidence = 1.0; 
      if (data.words && data.words.length > 0) {
        const confidences = data.words.map((w: any) => w.type === 'word' ? 1.0 : 0.0);
      }

      // Add fallback messaging when transcription confidence is low or empty
      if (!text || text.trim().length === 0) {
        console.log(JSON.stringify({ event: 'STT_SUCCESS_EMPTY', requestId, durationMs: Date.now() - startTime }));
        return res.json({ 
          text: "", 
          confidence: 0, 
          fallbackMessage: "We couldn't quite catch that. Please try asking again.",
          metadata: { _id: requestId }
        });
      }

      console.log(JSON.stringify({ event: 'STT_SUCCESS', requestId, durationMs: Date.now() - startTime, wordCount: text.split(' ').length }));
      res.json({
        text: text.trim(),
        confidence,
        metadata: { _id: requestId } // omit raw text from logs/metadata by default
      });
    } catch (error: any) {
      let errType = "network_failure";
      if (error.message === "RATE_LIMIT") errType = "rate_limit";
      else if (error.message === "No audio file provided") errType = "invalid_input";
      else if (error.message === "INVALID_AUDIO") errType = "invalid_audio";

      console.error(JSON.stringify({ event: 'STT_ERROR', requestId, error: errType, durationMs: Date.now() - startTime }));
      
      const safeMessage = errType === "rate_limit" ? "Service is currently busy. Please try again in a moment." :
                          errType === "invalid_input" ? "No audio file provided." :
                          errType === "invalid_audio" ? "Audio format is invalid or clip is too short to process." :
                          "Network error occurred while processing audio. Please try again.";
      
      res.status((errType === "invalid_audio" || errType === "invalid_input") ? 400 : errType === "rate_limit" ? 429 : 500)
         .json({ error: safeMessage, errorType: errType });
    }
  });

  app.post("/api/tts", async (req, res) => {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    try {
      const { text, voice_id, voice_settings, output_format, stream } = req.body;
      
      console.log(JSON.stringify({ event: 'TTS_START', requestId, params: { textLength: text?.length, voice_id } }));

      if (!text) {
        throw new Error("No text provided");
      }

      const MAX_CHARS = 3000;
      let truncatedText = text;
      if (text.length > MAX_CHARS) {
        truncatedText = text.slice(0, MAX_CHARS) + "...";
      }

      const voiceId = voice_id || 'pNInz6obpgDQGcFmaJgB'; 
      const outputFormat = output_format || 'mp3_44100_96';
      const settings = voice_settings || { stability: 0.5, similarity_boost: 0.75 };

      // Check cache first
      const cacheKeyPayload = JSON.stringify({ text: truncatedText, voiceId, outputFormat, settings });
      const cacheKey = crypto.createHash('sha256').update(cacheKeyPayload).digest('hex');

      if (ttsCache.has(cacheKey)) {
        console.log(JSON.stringify({ event: 'TTS_CACHE_HIT', requestId }));
        const cached = ttsCache.get(cacheKey)!;
        res.setHeader('Content-Type', cached.contentType);
        res.setHeader('Content-Length', cached.buffer.length.toString());
        return res.send(cached.buffer);
      }

      const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}${stream ? '/stream' : ''}?output_format=${outputFormat}`;
      
      const response = await fetch(elevenLabsUrl, {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY!
        },
        body: JSON.stringify({
          text: truncatedText,
          model_id: "eleven_monolingual_v1",
          voice_settings: settings
        })
      });

      if (!response.ok) {
        console.error(JSON.stringify({ event: 'TTS_API_ERROR', requestId, status: response.status }));
        if (response.status === 429) throw new Error("RATE_LIMIT");
        throw new Error("API_ERROR");
      }

      let contentType = 'audio/mpeg';
      if (outputFormat.includes('pcm')) contentType = 'audio/pcm';
      else if (outputFormat.includes('ulaw')) contentType = 'audio/basic';

      if (stream && response.body) {
        // Simple streaming relay if stream is requested and supported by backend fetch
        console.log(JSON.stringify({ event: 'TTS_STREAM_SUCCESS', requestId, durationMs: Date.now() - startTime }));
        res.setHeader('Content-Type', contentType);
        // We cannot easily cache streams without chunking them aside, so we bypass cache.
        (response.body as any).pipe(res);
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Update cache
      ttsCache.set(cacheKey, { buffer, contentType });
      if (ttsCache.size > MAX_CACHE_SIZE) {
        const firstKey = ttsCache.keys().next().value;
        ttsCache.delete(firstKey!);
      }

      console.log(JSON.stringify({ event: 'TTS_SUCCESS', requestId, durationMs: Date.now() - startTime, bufferSize: buffer.length }));

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', buffer.length.toString());
      res.send(buffer);
    } catch (error: any) {
      const errType = error.message === "RATE_LIMIT" ? "rate_limit" : error.message === "No text provided" ? "invalid_input" : "network_failure";
      console.error(JSON.stringify({ event: 'TTS_ERROR', requestId, error: errType, durationMs: Date.now() - startTime }));
      
      const safeMessage = errType === "rate_limit" ? "Voice service is currently busy." :
                          errType === "invalid_input" ? "No text provided to speak." :
                          "Failed to generate voice response.";
      res.status(errType === "invalid_input" ? 400 : errType === "rate_limit" ? 429 : 500).json({ error: safeMessage, errorType: errType });
    }
  });

  app.post("/api/gemini/chat", async (req, res) => {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    try {
      const { text, modelType, systemPrompt, safetySettings, maxOutputTokens, temperature } = req.body;

      console.log(JSON.stringify({ event: 'LLM_START', requestId, params: { modelType, textLength: text?.length } }));

      if (!text) {
        throw new Error("No text provided");
      }

      let model = "gemini-3.1-flash"; 
      if (modelType === "quality" || modelType === "pro") {
        model = "gemini-3.1-pro";
      } else if (modelType === "speed" || modelType === "flash-lite") {
        model = "gemini-3.1-flash-lite";
      } else if (modelType === "auto") {
        // Auto routing: simple queries -> flash-lite, complex/long -> pro
        model = text.length > 150 ? "gemini-3.1-pro" : "gemini-3.1-flash-lite";
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const generateConfig: any = { temperature: temperature ?? 0.7, maxOutputTokens: maxOutputTokens ?? 150 };
      if (systemPrompt) generateConfig.systemInstruction = { parts: [{ text: systemPrompt }] };

      const defaultSafetySettings = [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
      ];

      const payload = {
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: generateConfig,
        safetySettings: safetySettings || defaultSafetySettings,
      };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error(JSON.stringify({ event: 'LLM_API_ERROR', requestId, status: response.status }));
        if (response.status === 429) throw new Error("RATE_LIMIT");
        if (response.status === 400) throw new Error("SAFETY_FILTER");
        throw new Error("API_ERROR");
      }

      const data = await response.json();
      
      // Check for blocked transcript filtering
      if (data.promptFeedback && data.promptFeedback.blockReason) {
        console.warn(JSON.stringify({ event: 'LLM_PROMPT_BLOCKED', requestId, blockReason: data.promptFeedback.blockReason }));
        throw new Error("SAFETY_FILTER");
      }

      const candidate = data.candidates?.[0];
      
      // Check for blocked generation output moderation
      if (candidate?.finishReason === 'SAFETY') {
        console.warn(JSON.stringify({ event: 'LLM_RESPONSE_BLOCKED', requestId, finishReason: 'SAFETY' }));
        throw new Error("SAFETY_FILTER");
      }

      const responseText = candidate?.content?.parts?.[0]?.text || "";

      console.log(JSON.stringify({ event: 'LLM_SUCCESS', requestId, durationMs: Date.now() - startTime, responseTokens: responseText.length, model }));
      res.json({ text: responseText, model });
    } catch (error: any) {
      const errType = error.message === "RATE_LIMIT" ? "rate_limit" : error.message === "SAFETY_FILTER" ? "safety_filter" : error.message === "No text provided" ? "invalid_input" : "network_failure";
      console.error(JSON.stringify({ event: 'LLM_ERROR', requestId, error: errType, durationMs: Date.now() - startTime }));
      
      const safeMessage = errType === "rate_limit" ? "AI service is currently busy. Please try again." :
                          errType === "safety_filter" ? "I cannot process that request." :
                          errType === "invalid_input" ? "No text provided." :
                          "Failed to generate a response. Please try again.";
      res.status(errType === "invalid_input" ? 400 : (errType === "rate_limit" || errType === "safety_filter") ? 429 : 500).json({ error: safeMessage, errorType: errType });
    }
  });

  app.get("/api/pexels/search", async (req, res) => {
    try {
      const query = req.query.query as string;
      if (!query) {
        return res.status(400).json({ error: "Query parameter is required" });
      }
      
      const apiKey = process.env.PEXELS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "PEXELS_API_KEY is not configured" });
      }

      const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15`, {
        headers: {
          Authorization: apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Pexels API error: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error fetching from Pexels:", error);
      res.status(500).json({ error: "Failed to fetch images" });
    }
  });

  app.get("/api/pexels/proxy", async (req, res) => {
    try {
      const imageUrl = req.query.url as string;
      if (!imageUrl) {
        return res.status(400).json({ error: "URL parameter is required" });
      }
      
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      
      res.setHeader('Content-Type', contentType);
      res.send(buffer);
    } catch (error) {
      console.error("Error proxying image:", error);
      res.status(500).json({ error: "Failed to proxy image" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
