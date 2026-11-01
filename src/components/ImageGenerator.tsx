import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, Wand2, Loader2, Download, RefreshCw, Layers, History, X } from 'lucide-react';

export default function ImageGenerator() {
    const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'generate' | 'edit'>('generate');
  const [model, setModel] = useState<string>('gemini-3.1-flash-image');
  const [size, setSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [recentPrompts, setRecentPrompts] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(`studyforge_recent_prompts_${"local-user"}`);
    if (saved) {
      try {
        setRecentPrompts(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const savePrompt = (p: string) => {
    if (!p.trim()) return;
    const newPrompts = [p, ...recentPrompts.filter(rp => rp !== p)].slice(0, 5);
    setRecentPrompts(newPrompts);
    localStorage.setItem(`studyforge_recent_prompts_${"local-user"}`, JSON.stringify(newPrompts));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
      setProgressText('');
      setError('Request cancelled by user.');
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return;
    
    savePrompt(prompt);
    setLoading(true);
    setError('');
    setResultImage(null);
    setProgressText('Initializing AI model...');
    
    abortControllerRef.current = new AbortController();
    
    try {
      let body: any = { prompt, model, size, mode };
      if (mode === 'edit') {
        if (!referenceImage) {
          throw new Error("Please upload a reference image for editing.");
        }
        body.referenceImage = referenceImage;
      }
      
      setProgressText('Generating your diagram/image. This may take a few seconds...');
      
      const res = await fetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate image');
      
      setProgressText('Finalizing image processing...');
      setResultImage(data.imageUrl);
      setProgressText('');
    } catch (err: any) {
      if (err.name === 'AbortError') {
         setError('Request cancelled.');
      } else {
         setError(err.message || 'An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
      setProgressText('');
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <ImageIcon className="w-6 h-6 text-indigo-500" />
          Diagram & Image Studio
        </h2>
        <div className="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl flex gap-1">
          <button 
            onClick={() => setMode('generate')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${mode === 'generate' ? 'bg-white dark:bg-zinc-700 shadow-sm text-indigo-600' : 'text-zinc-600 hover:text-zinc-900'}`}
          >
            Generate
          </button>
          <button 
            onClick={() => setMode('edit')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${mode === 'edit' ? 'bg-white dark:bg-zinc-700 shadow-sm text-indigo-600' : 'text-zinc-600 hover:text-zinc-900'}`}
          >
            Edit Image
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          {mode === 'edit' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Reference Image</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all overflow-hidden"
              >
                {referenceImage ? (
                   <img src={referenceImage} alt="Reference" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-zinc-500 flex flex-col items-center">
                    <Layers className="w-6 h-6 mb-2" />
                    <span className="text-sm">Click to upload image</span>
                  </div>
                )}
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            </div>
          )}

          <div className="space-y-2 relative">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {mode === 'edit' ? 'Edit Instructions' : 'Diagram / Image Prompt'}
              </label>
              {recentPrompts.length > 0 && (
                <button 
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-xs text-indigo-600 hover:text-indigo-500 flex items-center gap-1"
                >
                  <History className="w-3 h-3" /> Recent Prompts
                </button>
              )}
            </div>
            
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={mode === 'edit' ? "e.g., Change the background to a sunny beach..." : "e.g., A highly detailed flowchart diagram of cellular respiration..."}
              className="w-full h-24 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 text-zinc-900 dark:text-zinc-100 resize-none"
            />
            
            {showHistory && recentPrompts.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg p-2 max-h-40 overflow-y-auto">
                <div className="flex justify-between items-center mb-2 px-2">
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Recent</span>
                  <button onClick={() => setShowHistory(false)}><X className="w-3 h-3 text-zinc-400" /></button>
                </div>
                {recentPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setPrompt(p); setShowHistory(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg truncate"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
              >
                <option value="gemini-3.1-flash-image">Gemini 3.1 Flash Image</option>
                <option value="gemini-3-pro-image">Gemini 3 Pro Image</option>
                <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image</option>
              </select>
            </div>
            
            {mode === 'generate' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Resolution</label>
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value as any)}
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                >
                  <option value="1K">1K</option>
                  <option value="2K">2K</option>
                  <option value="4K">4K</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || loading || (mode === 'edit' && !referenceImage)}
              className={`flex-1 py-3 font-medium rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50 ${loading ? 'bg-indigo-500 cursor-not-allowed text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
              {loading ? 'Processing...' : (mode === 'edit' ? 'Apply Edit' : 'Generate Image')}
            </button>
            
            {loading && (
              <button 
                onClick={handleCancel}
                className="px-4 py-3 bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 rounded-xl font-medium transition-colors"
                title="Cancel Generation"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          
          {progressText && (
             <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium animate-pulse text-center mt-2">{progressText}</p>
          )}
          
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg flex items-start gap-2">
              <span className="shrink-0 font-bold">Error:</span> {error}
            </p>
          )}
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center min-h-[300px] overflow-hidden relative group">
          {resultImage ? (
            <>
              <img src={resultImage} alt="Generated result" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <a 
                  href={resultImage} 
                  download="generated-image.png"
                  className="px-4 py-2 bg-white text-zinc-900 rounded-lg font-medium flex items-center gap-2 hover:bg-zinc-100"
                >
                  <Download className="w-4 h-4" /> Download
                </a>
              </div>
            </>
          ) : (
            <div className="text-center text-zinc-400">
              {loading ? (
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-indigo-900/30"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-600 dark:border-indigo-400 border-t-transparent animate-spin"></div>
                  </div>
                  <p className="animate-pulse font-medium text-indigo-600 dark:text-indigo-400">Creating Masterpiece...</p>
                </div>
              ) : (
                <>
                  <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>Your generated diagram or image will appear here</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
