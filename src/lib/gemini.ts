import { GoogleGenAI, Type } from "@google/genai";
import type { Part } from "@google/genai";

export async function summarizeForPartner(
  content: string | any[],
  personality: string,
  receptivity: string,
  outputLanguage: 'zh' | 'en'
): Promise<string[]> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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
      finalParts.push({ text: `\n\n請參考以下附加內容：` });
      if (Array.isArray(content)) {
        content.forEach(p => finalParts.push(p));
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
    return result.points || [];
  } catch (error: any) {
    console.error("Client API Error:", error);
    let errorMessage = "無法生成摘要，請檢查檔案格式或稍後再試。";
    if (error.message?.includes("API key not valid") || error.message?.includes("INVALID_ARGUMENT")) {
      errorMessage = "API 金鑰無效。請檢查您的 GEMINI_API_KEY 是否正確設置（Settings -> Secrets）。";
    }
    throw new Error(error.message || errorMessage);
  }
}
