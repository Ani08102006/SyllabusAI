import { logSearch } from '../lib/analytics';
import { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../lib/apiFetch';
import { PenTool, Download, Settings, Loader2 } from 'lucide-react';
import ImageGenerator from '../components/ImageGenerator';
import jsPDF from 'jspdf';
import { toCanvas } from 'html-to-image';

export default function AssignmentGenerator() {
    const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('');
  const [pages, setPages] = useState('2');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Handwriting Settings
  const [fontStyle, setFontStyle] = useState('font-caveat');
  const [inkColor, setInkColor] = useState('text-blue-800');
  const [messiness, setMessiness] = useState(0); // 0-10
  const [mistakes, setMistakes] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  const handleGenerateContent = async () => {
    if (!topic || !subject) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch('/api/ai/generate-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, subject, pages })
      }, "local-user", 'HumanWrite AI');
      if (!response.ok) {
        let errorMsg = 'Failed to generate assignment';
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errorMsg = errData.error;
          }
        } catch (_) {}
        throw new Error(errorMsg);
      }
      const data = await response.json();
      setContent(data.content);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate assignment content. The AI service is currently experiencing high demand. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!canvasRef.current) return;
    setExporting(true);
    try {
      const canvas = await toCanvas(canvasRef.current, { 
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      
      // A4 size: 210 x 297 mm
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add remaining pages
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`Assignment_${topic.replace(/\s+/g, '_') || 'Handwritten'}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  // Simulate human mistakes by randomly crossing out words
  const renderContentWithMistakes = (text: string) => {
    if (!mistakes) return text;
    const words = text.split(' ');
    return words.map((word, i) => {
      if (Math.random() < 0.05 && word.length > 3) {
        return <span key={i} className="line-through opacity-80 mr-1">{word}</span>;
      }
      return <span key={i} className="mr-1">{word}</span>;
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 flex items-center gap-3">
          <PenTool className="w-8 h-8 text-indigo-600" />
          HumanWrite AI
        </h1>
        <p className="mt-2 text-zinc-600">Generate realistic handwritten assignments and practical records.</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-800 flex flex-wrap gap-3">
          <div className="font-semibold shrink-0">Error:</div>
          <div>{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Controls Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 space-y-4">
            <h2 className="font-semibold text-zinc-900 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Content Generation
            </h2>
            
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., Artificial Intelligence"
                className="w-full rounded-lg border-zinc-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Introduction to Neural Networks"
                className="w-full rounded-lg border-zinc-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Approx. Pages</label>
              <select
                value={pages}
                onChange={(e) => setPages(e.target.value)}
                className="w-full rounded-lg border-zinc-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="1">1 Page</option>
                <option value="2">2 Pages</option>
                <option value="3">3 Pages</option>
                <option value="5">5 Pages</option>
              </select>
            </div>

            <button
              onClick={handleGenerateContent}
              disabled={!topic || !subject || loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate Content'}
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 space-y-4">
            <h2 className="font-semibold text-zinc-900">Handwriting Style</h2>
            
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Font Style</label>
              <select
                value={fontStyle}
                onChange={(e) => setFontStyle(e.target.value)}
                className="w-full rounded-lg border-zinc-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white dark:bg-zinc-800"
              >
                <option value="font-caveat">Neat Cursive (Caveat)</option>
                <option value="font-indie-flower">Casual Print (Indie Flower)</option>
                <option value="font-shadows-into-light">Tall & Thin (Shadows Into Light)</option>
                <option value="font-architects-daughter">Draftsman Print (Architects Daughter)</option>
                <option value="font-patrick-hand">Friendly Print (Patrick Hand)</option>
                <option value="font-kalam">Bold & Blocky (Kalam)</option>
                <option value="font-gochi-hand">Playful Crayon (Gochi Hand)</option>
                <option value="font-schoolbell">Primary School (Schoolbell)</option>
                <option value="font-just-another-hand">Quick Scribble (Just Another Hand)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Ink Color</label>
              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={() => setInkColor('text-blue-800')} 
                  className={`w-8 h-8 rounded-full bg-blue-800 border-2 ${inkColor === 'text-blue-800' ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-transparent'}`}
                  title="Royal Blue Ink"
                />
                <button 
                  onClick={() => setInkColor('text-black')} 
                  className={`w-8 h-8 rounded-full bg-black border-2 ${inkColor === 'text-black' ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-transparent'}`}
                  title="Black Ballpoint Ink"
                />
                <button 
                  onClick={() => setInkColor('text-blue-600')} 
                  className={`w-8 h-8 rounded-full bg-blue-600 border-2 ${inkColor === 'text-blue-600' ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-transparent'}`}
                  title="Gel Blue Ink"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Handwriting Messiness</label>
                <span className="text-xs text-zinc-500 font-mono font-medium">{messiness}/10</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={messiness}
                onChange={(e) => setMessiness(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <p className="text-[10px] text-zinc-400 mt-1">Adjusts the random page tilt and organic alignment for realism.</p>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Add Human Mistakes</label>
              <input
                type="checkbox"
                checked={mistakes}
                onChange={(e) => setMistakes(e.target.checked)}
                className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-600"
              />
            </div>
          </div>
        </div>

        {/* Canvas Panel */}
        <div className="lg:col-span-8 flex flex-col items-center">
          <div className="w-full flex justify-end mb-4">
            <button
              onClick={handleExportPDF}
              disabled={!content || exporting}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:bg-emerald-400 disabled:opacity-75 transition-all cursor-pointer"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Exporting PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Export PDF</span>
                </>
              )}
            </button>
          </div>

          {/* MIDDLE ROW: Image Generator */}
          <div className="w-full mb-8">
            <ImageGenerator />
          </div>

          {/* A4 Canvas Container */}
          <div className="w-full overflow-x-auto pb-8 flex justify-start sm:justify-center">
            <div 
              ref={canvasRef}
              className="bg-white shadow-xl relative"
              style={{
                width: '100%', maxWidth: '800px',
                minHeight: '1130px',
                padding: '2rem 1.5rem 2rem 14%', // Top, Right, Bottom, Left (extra for margin)
                backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, #e5e7eb 31px, #e5e7eb 32px)',
                backgroundPosition: '0 20mm',
              }}
            >
              {/* Red Margin Line */}
              <div className="absolute top-0 bottom-0 left-[12%] w-[1px] bg-red-400 opacity-70"></div>
              <div className="absolute top-0 bottom-0 left-[12.5%] w-[1px] bg-red-400 opacity-30"></div>

              {/* Header */}
              <div className="flex justify-between mb-8 pb-2 border-b-2 border-zinc-300">
                <div className={`text-lg ${fontStyle} ${inkColor}`}>
                  Date: {new Date().toLocaleDateString()}
                </div>
                <div className={`text-lg ${fontStyle} ${inkColor}`}>
                  Page No: 1
                </div>
              </div>

              {/* Content */}
              <div 
                className={`w-full ${fontStyle} ${inkColor} text-2xl leading-[32px] whitespace-pre-wrap`}
                style={{ 
                  transform: `rotate(${messiness * 0.1}deg)`,
                  letterSpacing: '1px'
                }}
              >
                {content ? (
                  renderContentWithMistakes(content)
                ) : (
                  <span className="opacity-30">Generate content to see the handwritten preview...</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
