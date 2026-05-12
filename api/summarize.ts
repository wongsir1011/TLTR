import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
        error: "API 金鑰未正確設置或無效，請確保應用程式擁有合法的 Gemini API Key (Vercel 環境變數)。" 
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
      model: "gemini-2.0-flash", 
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
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Gemini Server Error:", error);
    let errorMessage = "無法生成摘要，請稍後再試。";
    
    if (error.message?.includes("API key not valid") || error.message?.includes("INVALID_ARGUMENT")) {
      errorMessage = "API 金鑰無效。如果您是自行設定金鑰，請檢查 Vercel 的環境變數或 Settings 中的 GEMINI_API_KEY。";
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(500).json({ error: errorMessage });
  }
}
