import * as cheerio from "cheerio";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    res.status(200).json({ text: cleanText });
  } catch (error: any) {
    console.error("Scraping error:", error.message);
    res.status(500).json({ error: error.message || "擷取網址內容失敗" });
  }
}
