import type { Part } from "@google/genai";

export async function summarizeForPartner(
  content: string | Part[],
  personality: string,
  receptivity: string,
  outputLanguage: 'zh' | 'en'
): Promise<string[]> {
  try {
    const response = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, personality, receptivity, outputLanguage })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "無法生成摘要");
    }

    const result = await response.json();
    return result.points || [];
  } catch (error: any) {
    console.error("Client API Error:", error);
    throw new Error(error.message || "無法生成摘要，請檢查檔案格式或稍後再試。");
  }
}
