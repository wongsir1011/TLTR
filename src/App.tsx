/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Settings2, 
  Send, 
  Copy, 
  Check, 
  Link as LinkIcon, 
  Type as TextIcon,
  Loader2,
  AlertCircle,
  Share2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { summarizeForPartner } from './lib/gemini';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const PERSONALITY_OPTIONS = [
  { id: 'logical', label: '理性邏輯', emoji: '🧐', description: '講道理、重數據、不喜歡廢話' },
  { id: 'emotional', label: '感性溫柔', emoji: '❤️', description: '重感覺、需要情緒價值、溫暖' },
  { id: 'impatient', label: '急躁求快', emoji: '⚡', description: '趕時間、只要重點、沒耐性' },
  { id: 'detailed', label: '追求細節', emoji: '🔍', description: '要有具體背景、不喜歡含糊' },
  { id: 'humorous', label: '幽默風趣', emoji: '🤣', description: '喜歡講笑、氣氛要輕鬆' },
];

export const RECEPTIVITY_OPTIONS = [
  { id: 'no_patience', label: '冇耐性讀長文', emoji: '📉', prompt: '極致簡潔，直接講結論' },
  { id: 'concrete_advice', label: '需要具體建議', emoji: '✅', prompt: '要有 action points' },
  { id: 'emotional_trigger', label: '易被觸發情緒', emoji: '🌪️', prompt: '用詞要謹慎溫和，避免惹怒' },
  { id: 'bullet_lover', label: '喜歡聽重點', emoji: '📌', prompt: '清晰列點，層次分明' },
];

export default function App() {
  const [inputType, setInputType] = useState<'text' | 'url'>('text');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [personality, setPersonality] = useState(PERSONALITY_OPTIONS[0].id);
  const [receptivity, setReceptivity] = useState(RECEPTIVITY_OPTIONS[0].id);
  
  const [isLoading, setIsLoading] = useState(false);
  const [points, setPoints] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleScrape = async () => {
    const response = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("Server returned non-JSON response:", text);
      throw new Error(`伺服器回傳了非預期的格式。請檢查網址是否正確。`);
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      throw new Error('無法解析伺服器回傳的數據 (JSON Error)。');
    }

    if (!response.ok || data.error) {
      throw new Error(data.error || `伺服器連線失敗 (狀態碼: ${response.status})`);
    }
    return data.text;
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setPoints([]);
    
    try {
      let textToSummarize = content;
      if (inputType === 'url') {
        if (!url.startsWith('http')) {
          throw new Error('請輸入正確的網址 (需包含 http:// 或 https://)');
        }
        textToSummarize = await handleScrape();
      }

      if (!textToSummarize.trim()) {
        throw new Error('請輸入長文內容或網址。');
      }

      const p = PERSONALITY_OPTIONS.find(o => o.id === personality)?.label || personality;
      const r = RECEPTIVITY_OPTIONS.find(o => o.id === receptivity)?.label || receptivity;

      const result = await summarizeForPartner(textToSummarize, p, r);
      setPoints(result);
    } catch (err: any) {
      setError(err.message || '生成失敗，請稍後再試。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    if (points.length === 0) return;
    
    const intro = PERSONALITY_OPTIONS.find(o => o.id === personality)?.id === 'emotional' 
      ? '特登為你準備咗呢篇嘢嘅 3 個重點，費事你睇得咁辛苦 ❤️'
      : '長話短說，呢篇文有 3 個重點你要知：';

    let text = `${intro}\n\n${points.map((p, i) => `${indexToCircle(i)} ${p}`).join('\n\n')}`;
    
    if (inputType === 'url' && url) {
      text += `\n\n原文：${url}`;
    }
    
    text += `\n\n(來自重點傳聲筒 Pointy)`;
    
    const shareData = {
      title: '為你準備的重點摘要',
      text: text,
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        const encodedText = encodeURIComponent(text);
        const whatsappUrl = `https://wa.me/?text=${encodedText}`;
        window.open(whatsappUrl, '_blank');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('分享失敗，請使用複製功能。');
      }
    }
  };

  const indexToCircle = (i: number) => ['①', '②', '③'][i] || `${i + 1}.`;

  const copyToClipboard = () => {
    const text = points.map((p, i) => `${i + 1}. ${p}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdfcfb] to-[#e2d1c3] text-gray-800 font-sans selection:bg-pink-100 selection:text-pink-900 relative overflow-x-hidden">
      {/* Background Mesh Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[600px] h-[600px] bg-pink-200/40 rounded-full blur-[120px] animate-float pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[700px] h-[700px] bg-blue-200/30 rounded-full blur-[120px] animate-float-delayed pointer-events-none"></div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8 md:py-12">
        <header className="mb-10 flex items-center gap-4">
          <div className="bg-white/60 p-3 rounded-2xl shadow-sm backdrop-blur-md border border-white/40">
            <Sparkles className="w-8 h-8 text-pink-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-gray-800">重點傳聲筒 Pointy</h1>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">愛與溝通的翻譯機</p>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Panel: Inputs */}
          <main className="w-full lg:w-[400px] flex flex-col gap-6">
            <section className="backdrop-blur-xl bg-white/40 border border-white/40 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center gap-2 mb-6">
                <Settings2 className="w-4 h-4 text-pink-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">性格及接收特徵</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">另一半性格</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PERSONALITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setPersonality(opt.id)}
                        className={cn(
                          "px-3 py-2.5 rounded-xl text-xs font-bold transition-all border",
                          personality === opt.id 
                            ? "bg-pink-500 text-white border-pink-500 shadow-lg shadow-pink-200" 
                            : "bg-white/50 border-white/60 text-gray-600 hover:bg-white/80"
                        )}
                      >
                        {opt.emoji} {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">溝通偏好</label>
                  <div className="grid grid-cols-1 gap-2">
                    {RECEPTIVITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setReceptivity(opt.id)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                          receptivity === opt.id 
                            ? "bg-pink-500 text-white border-pink-500 shadow-lg shadow-pink-200" 
                            : "bg-white/50 border-white/60 text-gray-600 hover:bg-white/80"
                        )}
                      >
                        <span className="text-lg">{opt.emoji}</span>
                        <div>
                          <p className="text-xs font-bold">{opt.label}</p>
                          <p className={cn("text-[9px] opacity-70 leading-tight", receptivity === opt.id ? "text-pink-50" : "text-gray-400")}>{opt.prompt}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="backdrop-blur-xl bg-white/40 border border-white/40 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center gap-2 mb-6">
                <Send className="w-4 h-4 text-pink-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">來源內容</h2>
              </div>

              <div className="flex gap-2 p-1 bg-white/30 rounded-xl mb-4 border border-white/40">
                <button
                  onClick={() => setInputType('text')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-bold transition-all",
                    inputType === 'text' ? "bg-white text-pink-500 shadow-sm" : "text-gray-500"
                  )}
                >
                  <TextIcon className="w-3.5 h-3.5" /> 貼上文字
                </button>
                <button
                  onClick={() => setInputType('url')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-bold transition-all",
                    inputType === 'url' ? "bg-white text-pink-500 shadow-sm" : "text-gray-500"
                  )}
                >
                  <LinkIcon className="w-3.5 h-3.5" /> 網址連結
                </button>
              </div>

              <div className="space-y-4">
                {inputType === 'text' ? (
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="貼上長篇文章內容..."
                    className="w-full h-32 bg-white/50 border border-white/60 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 placeholder-gray-400 resize-none transition-all"
                  />
                ) : (
                  <div className="relative">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full p-4 bg-white/50 border border-white/60 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 placeholder-gray-400 pl-12 transition-all"
                    />
                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                  </div>
                )}

                <button
                  disabled={isLoading}
                  onClick={handleGenerate}
                  className={cn(
                    "w-full py-4 bg-gray-800 text-white rounded-2xl font-bold text-sm shadow-xl hover:bg-gray-900 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                  )}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>生成專屬重點 <Send className="w-4 h-4" /></>
                  )}
                </button>
              </div>
            </section>
          </main>

          {/* Right Panel: Results */}
          <div className="flex-grow flex flex-col gap-6">
            <div className="backdrop-blur-xl bg-white/30 border border-white/40 rounded-[2.5rem] p-8 md:p-12 shadow-2xl min-h-[400px] flex flex-col items-center justify-center relative overflow-hidden">
              <AnimatePresence mode="wait">
                {points.length > 0 ? (
                  <motion.div
                    key="results"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full h-full flex flex-col"
                  >
                    <div className="absolute top-0 right-0 p-8 hidden md:block">
                      <span className="px-4 py-1.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase tracking-widest border border-green-200">
                        {PERSONALITY_OPTIONS.find(o => o.id === personality)?.emoji} 已根據「{PERSONALITY_OPTIONS.find(o => o.id === personality)?.label}」優化
                      </span>
                    </div>

                    <div className="mb-10">
                      <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">生成摘要內容</p>
                      <h2 className="text-3xl font-black text-gray-800 leading-tight">為你準備的 3 個重點</h2>
                    </div>

                    <div className="space-y-10 flex-grow">
                      {points.map((point, index) => (
                        <div key={index} className="flex gap-6 items-start group">
                          <span className="text-6xl font-black text-pink-500/20 leading-none select-none group-hover:text-pink-500/40 transition-colors">
                            0{index + 1}
                          </span>
                          <div>
                            <p className="text-gray-700 leading-relaxed text-lg font-bold">
                              {point}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-12 flex flex-col md:flex-row items-center justify-between border-t border-gray-200/30 pt-8 gap-6">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={copyToClipboard}
                          className="flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-gray-900 bg-white/60 px-6 py-3 rounded-full border border-white/40 shadow-sm transition-all active:scale-95"
                        >
                          {copied ? (
                            <><Check className="w-4 h-4 text-green-500" /> 已複製文字</>
                          ) : (
                            <><Copy className="w-4 h-4" /> 複製文字</>
                          )}
                        </button>
                        <button 
                          className="flex items-center gap-2 text-xs font-bold text-pink-500 bg-white/60 px-6 py-3 rounded-full border border-white/40 shadow-sm transition-all active:scale-95"
                          onClick={handleShare}
                        >
                          <Share2 className="w-4 h-4" /> 發送給另一半
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-400 font-medium">
                        * 已根據接收能力「{RECEPTIVITY_OPTIONS.find(o => o.id === receptivity)?.label}」優化語法
                      </p>
                    </div>
                  </motion.div>
                ) : !isLoading ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center space-y-4"
                  >
                    <div className="w-20 h-20 bg-white/50 rounded-full flex items-center justify-center mx-auto text-4xl shadow-inner border border-white/40">
                      📝
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-gray-400">尚未生成摘要</h3>
                      <p className="text-gray-400 text-sm">請完成左側設定並點擊「生成專屬重點」</p>
                    </div>
                  </motion.div>
                ) : (
                   <motion.div key="loading" className="flex flex-col items-center gap-4 text-gray-400">
                     <Loader2 className="w-10 h-10 animate-spin text-pink-500" />
                     <p className="text-sm font-bold tracking-widest uppercase">AI 正在深度解構內容中...</p>
                   </motion.div>
                )}
              </AnimatePresence>

              {error && (
                <div className="absolute bottom-10 left-12 right-12 p-4 rounded-2xl bg-red-100/80 backdrop-blur-md border border-red-200 text-red-600 text-xs font-bold text-center">
                  ⚠️ {error}
                </div>
              )}
            </div>

            {/* AI Tip Box */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="h-24 backdrop-blur-md bg-pink-500/10 border border-white/30 rounded-3xl flex items-center px-8 gap-4 shadow-xl border-white/40 group hover:bg-white/20 transition-all"
            >
              <div className="w-12 h-12 bg-white/60 rounded-full flex items-center justify-center text-2xl shadow-sm border border-white/40 group-hover:scale-110 transition-transform">
                💡
              </div>
              <div className="flex-grow">
                <h4 className="text-xs font-black text-gray-800 uppercase tracking-widest mb-0.5">AI 哄另一半小貼士</h4>
                <p className="text-xs text-gray-600 leading-tight">建議傳送時加句「知道你今日忙，特登幫你執咗 3 個重點，最尾嗰點最適合你」。</p>
              </div>
            </motion.div>
          </div>
        </div>

        <footer className="mt-16 text-center text-gray-400">
          <p className="text-[10px] font-black tracking-[0.4em] uppercase mb-6">Designed with Love and AI</p>
          <div className="flex justify-center gap-8 opacity-40 grayscale group hover:grayscale-0 transition-all">
            <span className="text-2xl hover:scale-125 transition-transform cursor-default">💘</span>
            <span className="text-2xl hover:scale-125 transition-transform cursor-default">💌</span>
            <span className="text-2xl hover:scale-125 transition-transform cursor-default">✨</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

