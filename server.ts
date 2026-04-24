import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for memory storage so we can forward the buffer
const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // ElevenLabs Speech-to-Text
  app.post("/api/speech-to-text", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "ELEVENLABS_API_KEY is not configured" });
      }

      const formData = new FormData();
      const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
      
      const ext = req.file.mimetype.includes("mp4") ? "m4a" : "webm";
      formData.append("file", blob, `audio.${ext}`);
      formData.append("model_id", "scribe_v1");

      const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: {
          "xi-api-key": apiKey
        },
        body: formData
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`ElevenLabs STT error: ${response.status} ${errText}`);
      }

      const data = await response.json();
      res.json({ text: data.text });
    } catch (error: any) {
      console.error("Error in speech-to-text:", error);
      res.status(500).json({ error: error.message || "Failed to process audio" });
    }
  });

  // ElevenLabs Text-to-Speech
  app.post("/api/text-to-speech", async (req, res) => {
    try {
      const { text, voiceId = "N2lVS1w4EtoT3g4xXjV7" } = req.body; // Default voice (e.g. Antony)
      
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "ELEVENLABS_API_KEY is not configured" });
      }

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`ElevenLabs TTS error: ${response.status} ${errText}`);
      }

      // Stream the audio back
      res.setHeader("Content-Type", "audio/mpeg");
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.send(buffer);
    } catch (error: any) {
      console.error("Error in text-to-speech:", error);
      res.status(500).json({ error: error.message || "Failed to generate speech" });
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
