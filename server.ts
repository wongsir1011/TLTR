import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import * as cheerio from "cheerio";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Check API Key existence and warn if missing
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || geminiKey === "MY_GEMINI_API_KEY") {
    console.error("WARNING: GEMINI_API_KEY is not set or is using a placeholder value.");
  }

  // API Route for URL Scraping
  app.post("/api/scrape", async (req, res) => {
    const { url } = req.body;
    
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return res.status(400).json({ error: "請輸入有效的 URL (需以 http 開頭)" });
    }

    try {
      console.log(`[Scraper] Attempting to scrape: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(15000), // 延長至 15s
      });

      if (!response.ok) {
        console.error(`[Scraper] Website returned ${response.status} for ${url}`);
        return res.status(500).json({ error: `該網站拒絕存取 (狀態碼: ${response.status})` });
      }

      const html = await response.text();
      if (!html || html.length < 10) {
        return res.status(500).json({ error: "無法從該網站讀取任何內容" });
      }

      const $ = cheerio.load(html);

      // Clean up common noise
      $("script, style, nav, footer, header, aside, .ads, .comments, iframe").remove();
      
      // Try to find the most relevant content
      let contentSelector = "article, main, .content, .post-content, .article-body, #content";
      let extractedText = $(contentSelector).text().trim();

      // Fallback to body if specific selectors return nothing
      if (!extractedText || extractedText.length < 100) {
        extractedText = $("body").text().trim();
      }
      
      const cleanText = extractedText
        .replace(/\s+/g, " ")
        .substring(0, 15000); // Increased limit for better context

      if (!cleanText || cleanText.length < 20) {
        throw new Error("未能從該網址提取到足夠的文字內容。");
      }

      res.json({ text: cleanText });
    } catch (error: any) {
      console.error("Scraping error:", error.message);
      res.status(500).json({ error: error.message || "擷取網址內容失敗" });
    }
  });

  // API Route for Gemini Summarization
  app.post("/api/summarize", async (req, res) => {
    const { content, personality, receptivity, outputLanguage, apiKey: clientApiKey } = req.body;

    if (!content || !personality || !receptivity) {
      return res.status(400).json({ error: "缺少必要參數" });
    }

    try {
      let apiKey = clientApiKey || process.env.GEMINI_API_KEY;
      
      // Fallback or validation
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        console.error("GEMINI_API_KEY is missing/placeholder in both client and server environment.");
        return res.status(500).json({ 
          error: "API 金鑰未正確設置或無效，請確保應用程式擁有合法的 Gemini API Key。" 
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const languagePrompt = outputLanguage === 'en' 
        ? "Please write the summary in English." 
        : "使用廣東話/繁體中文（香港口語感更好，視乎性格）。";

      const promptText = `你是一個超級貼心的溝通大師。
現在有一篇長文/文章/圖片/文件內容，我需要你將它精簡為正好「三個重點」。
最重要的是，你要根據我另一半的「性格」和「接收能力特徵」來調整這三個重點的輸出方式、語氣和內容側重點。

另一半的性格：${personality}
另一半的接收能力特徵：${receptivity}

輸出要求：
1. 必須正好是三個點。
2. 語氣要迎合上述特徵（例如：對急躁的人要極簡，對感性的人要溫暖，對理性的人要數據/邏輯）。
3. 如果對方沒耐性，重點要短；如果對方追求細節，重點要精準。
4. ${languagePrompt}
`;

      let finalParts: any[] = [{ text: promptText }];
      
      if (typeof content === 'string') {
        finalParts.push({ text: `\n\n內容：\n${content}` });
      } else {
        // Handle file parts if sent from client
        finalParts.push({ text: `\n\n請參考以下附加內容：` });
        if (Array.isArray(content)) {
          content.forEach((p: any) => finalParts.push(p));
        }
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", 
        contents: { parts: finalParts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              points: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "正好三個溝通重點"
              },
            },
            required: ["points"],
          },
        },
      });

      const result = JSON.parse(response.text || '{"points": []}');
      res.json(result);
    } catch (error: any) {
      console.error("Gemini Server Error:", error);
      let errorMessage = "無法生成摘要，請稍後再試。";
      
      if (error.message?.includes("API key not valid") || error.message?.includes("INVALID_ARGUMENT")) {
        errorMessage = "API 金鑰無效。如果您是自行設定金鑰，請檢查 Vercel 等部署平台的環境變數或 Settings 中的 GEMINI_API_KEY。";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      res.status(500).json({ error: errorMessage });
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
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
