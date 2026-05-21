/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Copy, 
  Trash2, 
  ChevronRight,
  Info,
  MousePointer2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Toaster, toast } from 'sonner';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface ProofreadResult {
  markedText: string;
  errorCount: number;
}

export default function App() {
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState<ProofreadResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const handleProofread = async () => {
    if (!inputText.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const model = "gemini-3.1-pro-preview";
      
      const systemInstruction = `
        You are a specialized Proofreading Assistant for all Bangla academic manuscripts (MCQs, Q&A, and general prose). 
        Your primary objective is to act as the first-pass reviewer.
        
        CRITICAL OUTPUT RULE: 
        1. You must NOT rewrite the text. 
        2. Your task is to return the ORIGINAL text but wrap any errors you find in a <span class="error-mark" style="color:#ef4444; font-weight:bold; text-decoration:underline; cursor:pointer;">...</span> tag.
        3. IMMEDIATELY after every error you mark, you MUST provide the correct version in brackets [CORRECTION].
        4. The correction should also be interactive: <span class="correction-mark" style="color:#2563eb; font-weight:bold; cursor:pointer;">[CORRECTION]</span>.
        5. Do NOT use any Markdown formatting like ** (bold) or * (italic) in your output or corrections.
        6. Do NOT add any preamble, explanation, or conclusion. Return ONLY the marked-up text.
        
        SPECIFIC ERROR TYPES TO IDENTIFY:
        - Spelling: Typos in Bangla and English technical terms. (e.g., <span class="error-mark" style="color:#ef4444; font-weight:bold; text-decoration:underline; cursor:pointer;">ভূল</span> <span class="correction-mark" style="color:#2563eb; font-weight:bold; cursor:pointer;">[ভুল]</span>)
        - Numbering: Ensure questions or points follow a strict 1, 2, 3... sequence. Mark any skipped, repeated, or out-of-order numbers. Do NOT convert English numbers to Bangla numbers or vice versa; maintain the original digit style used in the text. (e.g., <span class="error-mark" style="color:#ef4444; font-weight:bold; text-decoration:underline; cursor:pointer;">৫.</span> <span class="correction-mark" style="color:#2563eb; font-weight:bold; cursor:pointer;">[৪.]</span> if 4 was skipped)
        - AI Artifacts: Scan for "GPT-isms" (e.g., "Certainly!", "Here is the content," or prompt-like instructions). (e.g., <span class="error-mark" style="color:#ef4444; font-weight:bold; text-decoration:underline; cursor:pointer;">Certainly! Here is the question:</span> <span class="correction-mark" style="color:#2563eb; font-weight:bold; cursor:pointer;">[DELETE]</span>)
        - Logical Consistency: For MCQs, ensure four options (ক, খ, গ, ঘ). For general Q&A, ensure logical flow and factual accuracy in Bangla.
        
        LOGIC:
        - Prioritize Bangla Academy Dictionary standard for spelling.
        - Do not provide a correction if the word is already correct.
        - If you are unsure, mark it as an error but provide a [?] or [Needs Review] correction.
        
        Example:
        Input: "১. বাংলাদেশের রাজধানী কি? (ক) ঢাকা (খ) খুলনা (গ) সিলেট (ঘ) ঢাকা"
        Output: "১. বাংলাদেশের রাজধানী কি? (ক) ঢাকা (খ) খুলনা (গ) সিলেট <span class="error-mark" style="color:#ef4444; font-weight:bold; text-decoration:underline; cursor:pointer;">(ঘ) ঢাকা</span> <span class="correction-mark" style="color:#2563eb; font-weight:bold; cursor:pointer;">[(ঘ) চট্টগ্রাম]</span>"
      `;

      const response = await ai.models.generateContent({
        model: model,
        contents: [{ role: 'user', parts: [{ text: inputText }] }],
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.1,
        },
      });

      const markedText = response.text || '';
      const errorCount = (markedText.match(/class="error-mark"/g) || []).length;

      setResult({ markedText, errorCount });
    } catch (err) {
      console.error("Proofreading error:", err);
      setError("Failed to process the text. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle click on corrections to copy them
  useEffect(() => {
    const handleOutputClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('correction-mark') || target.classList.contains('error-mark')) {
        let textToCopy = target.innerText;
        // If it's a correction mark, strip the brackets
        if (target.classList.contains('correction-mark')) {
          textToCopy = textToCopy.replace(/^\[|\]$/g, '');
        }
        
        if (textToCopy === 'DELETE') {
          toast.success('AI Artifact marked for deletion');
          return;
        }

        navigator.clipboard.writeText(textToCopy);
        toast.success(`Copied: ${textToCopy}`, {
          description: "Correction copied to clipboard",
          duration: 2000,
        });
      }
    };

    const outputEl = outputRef.current;
    if (outputEl) {
      outputEl.addEventListener('click', handleOutputClick as any);
    }

    return () => {
      if (outputEl) {
        outputEl.removeEventListener('click', handleOutputClick as any);
      }
    };
  }, [result]);

  const clearAll = () => {
    setInputText('');
    setResult(null);
    setError(null);
  };

  const copyResult = () => {
    if (outputRef.current) {
      const text = outputRef.current.innerText;
      navigator.clipboard.writeText(text);
      toast.success('Full review copied to clipboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-red-100 selection:text-red-900">
      <Toaster position="top-center" richColors />
      
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center text-white shadow-sm">
              <FileText size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">QNA Proofreader</h1>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Academic Manuscript Reviewer</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">
              <MousePointer2 size={14} />
              <span>Click Corrections to Copy</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-[calc(100vh-16rem)]">
          
          {/* Input Section */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                <ChevronRight size={16} className="text-red-500" />
                Input Manuscript
              </h2>
              <button 
                onClick={clearAll}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-md hover:bg-red-50"
                title="Clear all"
              >
                <Trash2 size={18} />
              </button>
            </div>
            
            <div className="relative flex-1 group">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste your Bangla academic text (MCQs, Q&A, etc.) here..."
                className="w-full h-full min-h-[300px] p-6 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all resize-none font-mono text-lg leading-relaxed"
                dir="auto"
              />
              {!inputText && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                  <FileText size={80} />
                </div>
              )}
            </div>

            <button
              onClick={handleProofread}
              disabled={isLoading || !inputText.trim()}
              className={cn(
                "w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2",
                isLoading || !inputText.trim() 
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed" 
                  : "bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] hover:shadow-red-500/20"
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Analyzing Manuscript...
                </>
              ) : (
                <>
                  <CheckCircle2 size={20} />
                  Start Proofreading
                </>
              )}
            </button>
          </section>

          {/* Output Section */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                <ChevronRight size={16} className="text-blue-500" />
                Review Results
              </h2>
              {result && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-1 bg-red-100 text-red-700 rounded-full">
                    {result.errorCount} Potential Errors
                  </span>
                  <button 
                    onClick={copyResult}
                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors rounded-md hover:bg-blue-50"
                    title="Copy text"
                  >
                    <Copy size={18} />
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[300px]">
              <div className="flex-1 overflow-y-auto p-6 font-mono text-lg leading-relaxed whitespace-pre-wrap" ref={outputRef}>
                <AnimatePresence mode="wait">
                  {error ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="h-full flex flex-col items-center justify-center text-center gap-3 p-8"
                    >
                      <AlertCircle size={48} className="text-red-500" />
                      <p className="text-red-600 font-medium">{error}</p>
                    </motion.div>
                  ) : result ? (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      dangerouslySetInnerHTML={{ __html: result.markedText }}
                    />
                  ) : (
                    <motion.div 
                      key="placeholder"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="h-full flex flex-col items-center justify-center text-center gap-4 text-gray-300 p-8"
                    >
                      <div className="w-16 h-16 border-2 border-dashed border-gray-200 rounded-full flex items-center justify-center">
                        <ChevronRight size={32} />
                      </div>
                      <p className="text-sm font-medium">Results will appear here after analysis</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {/* Legend */}
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center gap-4 overflow-x-auto">
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-3 h-3 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Error (Click to Copy Correction)</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-3 h-3 bg-blue-600 rounded-full" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Correction [Click to Copy]</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 border-l border-gray-200 pl-4">
                  <Info size={12} className="text-gray-400" />
                  <span className="text-[10px] font-medium text-gray-400">Spelling • Numbering • AI Artifacts • Options</span>
                </div>
              </div>
            </div>
          </section>

        </div>
      </main>

      {/* Footer Info */}
      <footer className="max-w-7xl mx-auto px-4 py-8 border-t border-gray-200 mt-12 flex flex-col md:flex-row items-center justify-between gap-6 text-gray-400 text-xs text-center md:text-left">
        <p>© 2026 QNA Proofreader. All rights reserved.</p>
        <div className="flex flex-wrap justify-center md:justify-end gap-4">
          <span className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-md">
            <CheckCircle2 size={12} className="text-green-500" />
            Immediate Corrections
          </span>
          <span className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-md">
            <CheckCircle2 size={12} className="text-green-500" />
            Interactive Review
          </span>
        </div>
      </footer>
    </div>
  );
}
