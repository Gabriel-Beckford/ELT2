import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import admin from "firebase-admin";
import rateLimit from "express-rate-limit";
import { WebSocketServer, WebSocket as WS } from "ws";
import { streamChat, generateSpeech, generateImage } from "./server/gemini.ts";
import { uploadImage } from "./server/storage.ts";
import { validateImagePrompt } from "./src/lib/imagePolicy/validateImagePrompt.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "firebase-applet-config.json"), "utf8"));
if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Failure Threshold Monitors (In-memory)
  let consecutiveImageFailures = 0;
  let consecutiveChatFailures = 0;
  const FAILURE_ALERT_THRESHOLD = 5;

  app.use(express.json());

  // WebSocket Server for Live API Proxy
  const wss = new WebSocketServer({ noServer: true });

  const apiKey = process.env.GEMINI_API_KEY;

  wss.on("connection", (ws, req) => {
    console.log("Client connected to Live Proxy");
    
    // Connect to Google Gemini Live API
    // The Gemini Live API endpoint for BidiGenerateContent
    const googleWs = new WS(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`);

    googleWs.on("open", () => {
      console.log("Connected to Google Live API");
    });

    ws.on("message", (data) => {
      if (googleWs.readyState === WS.OPEN) {
        googleWs.send(data);
      }
    });

    googleWs.on("message", (data) => {
      if (ws.readyState === WS.OPEN) {
        ws.send(data);
      }
    });

    googleWs.on("error", (err) => {
      console.error("Google WS Error:", err);
      ws.close();
    });

    ws.on("error", (err) => {
      console.error("Client WS Error:", err);
      googleWs.close();
    });

    ws.on("close", () => {
      console.log("Client local connection closed");
      googleWs.close();
    });

    googleWs.on("close", () => {
      console.log("Google connection closed");
      ws.close();
    });
  });

  // Auth Middleware
  const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      (req as any).user = decodedToken;
      next();
    } catch (error) {
      console.error("Auth Error:", error);
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // Rate Limiters
  const chatLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: { error: "Too many requests, please try again later." }
  });

  const mediaLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // Limit each IP to 50 requests per hour
    message: { error: "Media generation limit reached. Please try again in an hour." }
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/ai/chat", authenticate, chatLimiter, async (req, res) => {
    const { messages, systemInstruction, model, thinkingLevel, useGrounding } = req.body;
    const traceId = req.headers['x-trace-id'] as string || crypto.randomUUID();
    const startTime = Date.now();

    if (!messages) {
      return res.status(400).json({ error: "Messages are required" });
    }

    // Set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Trace-Id", traceId);

    try {
      const stream = streamChat(messages, systemInstruction, model, thinkingLevel, useGrounding);
      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.write("data: [DONE]\n\n");
      
      const duration = Date.now() - startTime;
      consecutiveChatFailures = 0; // Reset on success
      console.log(`[Trace] Chat Complete | TraceID: ${traceId} | Model: ${model} | Latency: ${duration}ms | Status: Success`);
    } catch (error) {
      const duration = Date.now() - startTime;
      consecutiveChatFailures++;
      if (consecutiveChatFailures >= FAILURE_ALERT_THRESHOLD) {
        console.error(`[ALERT] High Chat Failure Rate! Consecutive failures: ${consecutiveChatFailures}`);
      }
      console.error(`[Trace] Chat Failed | TraceID: ${traceId} | Model: ${model} | Latency: ${duration}ms | Error: ${error instanceof Error ? error.message : 'Unknown'}`);
      res.write(`data: ${JSON.stringify({ type: "error", content: "AI generation failed" })}\n\n`);
    } finally {
      res.end();
    }
  });

  app.post("/api/ai/tts", authenticate, mediaLimiter, async (req, res) => {
    const { text, voice } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    try {
      const base64Audio = await generateSpeech(text, voice);
      res.json({ data: base64Audio });
    } catch (error) {
      console.error("TTS Error:", error);
      res.status(500).json({ error: "Failed to generate speech" });
    }
  });

  app.post("/api/ai/image", authenticate, mediaLimiter, async (req, res) => {
    const { prompt, model, options } = req.body;
    const traceId = req.headers['x-trace-id'] as string || crypto.randomUUID();
    const startTime = Date.now();

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // Deterministic Policy Validation
    const validation = validateImagePrompt(prompt);
    if (!validation.isValid) {
      const duration = Date.now() - startTime;
      console.warn(`[Trace] Image Rejected | TraceID: ${traceId} | Reason: ${validation.reasonCode} | Latency: ${duration}ms`);
      return res.json({ 
        url: null, 
        policyViolation: true, 
        reason: validation.reasonCode,
        message: validation.message,
        traceId
      });
    }

    try {
      const result = await generateImage(prompt, model, options);
      if (!result) {
        throw new Error("Empty result from provider");
      }

      // Convert base64 to buffer and upload
      const buffer = Buffer.from(result.data, 'base64');
      const assetSize = buffer.length;
      const publicUrl = await uploadImage(buffer, result.mimeType);
      
      const duration = Date.now() - startTime;
      consecutiveImageFailures = 0; // Reset on success
      console.log(`[Trace] Image Success | TraceID: ${traceId} | Model: ${model || 'default'} | Latency: ${duration}ms | Size: ${assetSize} bytes`);
      
      res.json({ url: publicUrl, traceId, provider: model || 'nanobana2' });
    } catch (error) {
      const duration = Date.now() - startTime;
      consecutiveImageFailures++;
      if (consecutiveImageFailures >= FAILURE_ALERT_THRESHOLD) {
        console.error(`[ALERT] High Image Failure Rate! Consecutive failures: ${consecutiveImageFailures}`);
      }
      console.error(`[Trace] Image Failed | TraceID: ${traceId} | Model: ${model || 'default'} | Latency: ${duration}ms | Error: ${error instanceof Error ? error.message : 'Unknown'}`);
      res.status(500).json({ error: "Failed to generate image", traceId });
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

  const httpServer = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  httpServer.on('upgrade', (request, socket, head) => {
    if (request.url?.startsWith('/api/ai/live')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });
}

startServer();
