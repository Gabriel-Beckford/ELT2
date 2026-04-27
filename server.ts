import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";

// Load environment early
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

if (!GEMINI_API_KEY) {
  console.warn("WARNING: GEMINI_API_KEY environment variable is missing. LLM features may fail.");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY || "dummy-key" });
const ttsBuffers = new Map<string, { text: string, voiceId: string }>();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['audio/wav', 'audio/webm', 'audio/m4a', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/aac'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: "50mb" }));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/gemini/image", async (req, res) => {
    try {
      const { prompt } = req.body;
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { imageConfig: { aspectRatio: "4:3", imageSize: "1K" } } as any,
      });
      if (response.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
        const { data, mimeType } = response.candidates[0].content.parts[0].inlineData;
        return res.json({ result: `data:${mimeType || 'image/png'};base64,${data}` });
      }
      res.json({ result: null });
    } catch (e: any) {
      console.error("Image gen error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/gemini/streamchat", async (req, res) => {
    const { messages, systemInstruction, model, thinkingLevel, useGrounding } = req.body;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const tools: any[] = [];
      if (useGrounding) {
        tools.push({ googleSearch: {} });
      }

      const stream = await ai.models.generateContentStream({
        model: model || "gemini-3-flash-preview",
        contents: messages,
        tools,
        config: {
          systemInstruction: systemInstruction || "You are Aura, a helpful and friendly AI assistant.",
          thinkingConfig: thinkingLevel ? { includeThoughts: true, thinkingLevel } : undefined,
          includeServerSideToolInvocations: useGrounding ? true : undefined,
          temperature: 0.7,
          topP: 0.95,
          maxOutputTokens: 8192,
        } as any
      } as any);

      for await (const chunk of stream) {
        const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata as any;
        if (groundingMetadata?.groundingChunks) {
          const sources = groundingMetadata.groundingChunks
            .filter((c: any) => c.web)
            .map((c: any) => ({ title: c.web?.title || 'Untitled', url: c.web?.uri || '' }))
            .filter((s: any) => s.url);
          if (sources.length > 0) {
            res.write(`data: ${JSON.stringify({ type: 'sources', content: sources })}\n\n`);
          }
        }

        const parts = chunk.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.thought) {
            res.write(`data: ${JSON.stringify({ type: 'thought', content: part.text || '' })}\n\n`);
          } else if (part.text) {
            res.write(`data: ${JSON.stringify({ type: 'text', content: part.text })}\n\n`);
          }
        }
      }
      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch (e: any) {
      console.error("Stream error:", e);
      res.write(`data: ${JSON.stringify({ type: 'error', content: e.message })}\n\n`);
      res.end();
    }
  });

  app.post("/api/elevenlabs/prepare", (req, res) => {
    const { text, voiceId } = req.body;
    if (!text || !voiceId) return res.status(400).json({ error: "Missing text or voiceId" });
    const id = crypto.randomUUID();
    ttsBuffers.set(id, { text, voiceId });
    // Clean up after 5 minutes
    setTimeout(() => ttsBuffers.delete(id), 5 * 60 * 1000);
    res.json({ id });
  });

  app.get("/api/elevenlabs/stream/:id", async (req, res) => {
    const id = req.params.id;
    const data = ttsBuffers.get(id);
    if (!data) return res.status(404).send("Not found");
    
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${data.voiceId}/stream`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': process.env.ELEVENLABS_API_KEY || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: data.text,
          model_id: 'eleven_multilingual_v2',
        })
      });

      if (!response.ok) {
        return res.status(response.status).send('ElevenLabs Error');
      }

      res.setHeader('Content-Type', 'audio/mpeg');
      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
        ttsBuffers.delete(id);
      }
    } catch (e) {
      console.error(e);
      res.status(500).send("Error");
    }
  });

  app.post("/api/speech/transcribe", upload.single('audio'), async (req, res) => {
    const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();
    const startTime = Date.now();
    console.log(JSON.stringify({ event: 'STT_START', requestId, params: { size: req.file?.size, type: req.file?.mimetype } }));

    try {
      if (!req.file) {
        throw new Error("No audio file provided");
      }
      if (req.file.buffer.length < 100) {
        throw new Error("INVALID_AUDIO");
      }

      const model = "gemini-3.1-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

      const payload = {
        contents: [{
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: req.file.mimetype,
                data: req.file.buffer.toString('base64')
              }
            },
            { text: "Please transcribe the following audio carefully. Output only the transcript text." }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 }
      };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error(JSON.stringify({ event: 'STT_API_ERROR', requestId, status: response.status }));
        if (response.status === 429) throw new Error("RATE_LIMIT");
        if (response.status === 400 || response.status === 422) throw new Error("INVALID_AUDIO");
        throw new Error("API_ERROR");
      }

      const data = await response.json();
      
      const candidate = data.candidates?.[0];
      if (candidate?.finishReason === 'SAFETY') {
        throw new Error("SAFETY_FILTER");
      }

      const transcriptText = candidate?.content?.parts?.[0]?.text?.trim() || "";

      console.log(JSON.stringify({ event: 'STT_SUCCESS', requestId, durationMs: Date.now() - startTime, textLength: transcriptText.length }));
      res.json({ text: transcriptText });
    } catch (error: any) {
      let errType = "network_failure";
      if (error.message === "RATE_LIMIT") errType = "rate_limit";
      else if (error.message === "SAFETY_FILTER") errType = "safety_filter";
      else if (error.message === "No audio file provided") errType = "invalid_input";
      else if (error.message === "INVALID_AUDIO") errType = "invalid_audio";

      console.error(JSON.stringify({ event: 'STT_ERROR', requestId, error: errType, durationMs: Date.now() - startTime }));
      
      const safeMessage = errType === "rate_limit" ? "Service is currently busy. Please try again." :
                          errType === "safety_filter" ? "Could not process audio due to safety filters." :
                          errType === "invalid_input" ? "No audio file provided." :
                          errType === "invalid_audio" ? "Audio format is invalid or unsupported." :
                          "Network error occurred while processing audio. Please try again.";
      
      res.status((errType === "invalid_audio" || errType === "invalid_input") ? 400 : errType === "rate_limit" ? 429 : errType === "safety_filter" ? 403 : 500)
         .json({ error: safeMessage, errorType: errType });
    }
  });

  app.post("/api/gemini/chat", async (req, res) => {
    const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();
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
