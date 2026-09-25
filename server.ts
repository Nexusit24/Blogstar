import express from "express";
import axios from "axios";
import multer from "multer";
import FormData from "form-data";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB limit
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Fetch available models from xKiro or gateway
  app.get("/api/ai-models", async (req, res) => {
    try {
      const response = await axios.get("https://api.xkiro.com/v1/models", { 
        timeout: 15000,
        headers: { "Accept": "application/json" }
      });
      res.json(response.data);
    } catch (e: any) {
      console.warn("Could not fetch models from xKiro:", e.message);
      res.json({ data: [] });
    }
  });

  // Proxy for OpenAI-compatible AI API (e.g. xKiro, DeepSeek, etc.)
  app.post("/api/ai-proxy", async (req, res) => {
    const { baseUrl, apiKey, model, messages, temperature, max_tokens, response_format } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: { message: "API Key is required. Please set your xKiro API key in Settings." } });
    }

    const cleanBaseUrl = (baseUrl || "https://api.xkiro.com/v1").replace(/\/+$/, "");
    const endpoint = `${cleanBaseUrl}/chat/completions`;
    const targetModel = model || "deepseek/deepseek-v4-flash";
    
    console.log(`Proxying AI request to: ${endpoint} (Model: ${targetModel})`);

    const callChatApi = async (reqModel: string, reqMessages: any[], useJsonFormat = false) => {
      const payload: any = {
        model: reqModel,
        messages: reqMessages,
        temperature: temperature ?? 0.7,
        max_tokens: max_tokens || 8192
      };
      if (useJsonFormat && response_format) {
        payload.response_format = response_format;
      }

      return await axios.post(
        endpoint,
        payload,
        {
          headers: {
            "Authorization": `Bearer ${apiKey.trim()}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          timeout: 240000 // 4 minutes timeout
        }
      );
    };

    // Attempt 1: Standard call
    try {
      const response = await callChatApi(targetModel, messages, !!response_format);
      return res.json(response.data);
    } catch (firstError: any) {
      const status1 = firstError.response?.status || 500;
      const data1 = firstError.response?.data;
      console.warn(`AI Proxy attempt 1 failed (${status1}):`, JSON.stringify(data1 || firstError.message));

      // Attempt 2: If 500 or 400 with system message, convert system message to user message
      // (Many models/gateways fail when role: "system" is provided)
      const hasSystemRole = messages && messages.some((m: any) => m.role === "system");
      if (hasSystemRole) {
        try {
          console.log("Attempt 2: Retrying with system message converted to user message...");
          const convertedMessages = messages.map((m: any) => ({
            role: m.role === "system" ? "user" : m.role,
            content: m.role === "system" ? `[SYSTEM INSTRUCTIONS]\n${m.content}\n[END INSTRUCTIONS]` : m.content
          }));
          const response2 = await callChatApi(targetModel, convertedMessages, false);
          return res.json(response2.data);
        } catch (secondError: any) {
          console.warn("Attempt 2 with converted messages failed:", secondError.response?.status || secondError.message);
        }
      }

      // Attempt 3: If 500 server_error / internal_error (upstream model down on gateway), try fallback models
      if (status1 === 500) {
        const fallbackCandidates = [
          "deepseek/deepseek-chat-v3.1",
          "deepseek/deepseek-v3.2",
          "deepseek/deepseek-v4.1-flash:free",
          "qwen/qwen3.5-flash:free",
          "sensenova/sensenova-6.8-flash-lite"
        ].filter(m => m !== targetModel);

        for (const fallbackModel of fallbackCandidates) {
          try {
            console.log(`Attempt 3: Upstream 500 error on ${targetModel}. Trying fallback model: ${fallbackModel}...`);
            const fallbackMessages = hasSystemRole ? messages.map((m: any) => ({
              role: m.role === "system" ? "user" : m.role,
              content: m.role === "system" ? `[SYSTEM INSTRUCTIONS]\n${m.content}\n[END INSTRUCTIONS]` : m.content
            })) : messages;

            const responseFallback = await callChatApi(fallbackModel, fallbackMessages, false);
            console.log(`Fallback model ${fallbackModel} succeeded!`);
            return res.json({
              ...responseFallback.data,
              _fallbackNotice: `Original model '${targetModel}' had server error. Automatically completed with '${fallbackModel}'.`
            });
          } catch (fbErr: any) {
            console.warn(`Fallback ${fallbackModel} also failed:`, fbErr.response?.status || fbErr.message);
          }
        }
      }

      // If all attempts failed, provide clear, friendly error
      const status = firstError.response?.status || 500;
      const errorData = firstError.response?.data || { error: { message: firstError.message } };
      
      if (status === 500) {
        return res.status(500).json({
          error: {
            message: `xKiro সার্ভার থেকে 500 Server Error এসেছে (সম্ভবত '${targetModel}' মডেলটি এই মুহূর্তে xKiro গেটওয়েতে ওভারলোডেড)। অনুগ্রহ করে সেটিংস বা সাইডবার থেকে অন্য মডেল (যেমন: 'deepseek/deepseek-chat-v3.1' বা 'qwen/qwen3.5-flash:free') সিলেক্ট করে চেষ্টা করুন।`,
            original: errorData
          }
        });
      }

      if (status === 401) {
        return res.status(401).json({
          error: {
            message: "আপনার xKiro API Key টি সঠিক নয় বা নিষ্ক্রিয়। অনুগ্রহ করে xkiro.com ড্যাশবোর্ড থেকে সঠিক Key কপি করে সেটিংসে বসান।",
            original: errorData
          }
        });
      }

      return res.status(status).json(errorData);
    }
  });

  // Proxy for WordPress API
  app.post("/api/wp-proxy", async (req, res) => {
    const { url, method, auth, data, params } = req.body;
    console.log(`Proxying ${method} request to ${url}`);

    try {
      const response = await axios({
        url,
        method,
        headers: {
          'Authorization': `Basic ${Buffer.from(`${auth.username}:${auth.appPassword}`).toString('base64')}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        data,
        params,
        timeout: 60000, // Increased to 60s
        maxRedirects: 5,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      res.json(response.data);
    } catch (error: any) {
      const status = error.response?.status || 500;
      const errorData = error.response?.data || { message: error.message };
      
      console.error(`WP Proxy Error (${status}):`, JSON.stringify(errorData, null, 2));
      
      // If it's a 400, it might be a parameter issue
      if (status === 400) {
        res.status(400).json({
          ...errorData,
          _proxy_hint: "WordPress returned a 400 Bad Request. This often means a parameter is invalid (like a missing title, invalid date format, or a meta field that isn't registered). Check the 'code' and 'message' fields for details."
        });
      } else if (status === 401 || status === 403) {
        res.status(status).json({
          ...errorData,
          _proxy_hint: "WordPress returned a permission error. This can happen due to incorrect Application Password, insufficient user roles, or a security plugin blocking the request. If this works in a new tab but not here, it's likely an iframe security restriction."
        });
      } else {
        res.status(status).json(errorData);
      }
    }
  });

  // Proxy for Media Upload (Multipart)
  app.post("/api/wp-media-proxy", upload.single('file'), async (req, res) => {
    const { url, username, appPassword, title, alt_text, caption, description } = req.body;
    const file = req.file;

    if (!file) {
      console.error("Media Proxy: No file provided");
      return res.status(400).json({ message: "No file uploaded" });
    }

    console.log(`Proxying media upload to: ${url}`);

    try {
      const form = new FormData();
      form.append('file', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });
      form.append('title', title || '');
      form.append('alt_text', alt_text || '');
      form.append('caption', caption || '');
      form.append('description', description || '');

      const response = await axios.post(url, form, {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Basic ${Buffer.from(`${username}:${appPassword}`).toString('base64')}`,
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 60000, // 60 seconds timeout
        validateStatus: () => true
      });

      console.log(`WordPress responded with status: ${response.status}`);
      
      if (typeof response.data === 'string' && response.data.includes('<!doctype')) {
        console.error("WordPress returned HTML instead of JSON.");
        return res.status(response.status).json({ 
          message: "WordPress returned an HTML page instead of JSON. This usually happens if a security plugin (like Wordfence) is blocking the request or if the URL is incorrect.",
          details: response.data.substring(0, 150)
        });
      }

      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error("WP Media Proxy Error:", error.message);
      res.status(500).json({ message: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
