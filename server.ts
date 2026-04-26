import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

// Load environment early
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("FATAL ERROR: GEMINI_API_KEY environment variables are missing.");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
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
