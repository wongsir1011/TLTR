import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import * as cheerio from "cheerio";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
