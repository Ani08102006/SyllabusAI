import { logSearch } from '../lib/analytics';
import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/apiFetch';


import { FileText, Loader2, BookOpen, ChevronRight, Download } from 'lucide-react';
import { getCollection, addDoc, updateDoc, deleteDoc, queryDocs } from '../lib/localDb';
import MathMarkdown from '../components/MathMarkdown';
import jsPDF from 'jspdf';
import { toCanvas } from 'html-to-image';

export default function Notes() {
    const [subjects, setSubjects] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleExportPDF = async () => {
    const element = document.getElementById('notes-pdf-container');
    if (!element) return;
    setExporting(true);
    try {
      const canvas = await toCanvas(element, {
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      
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
      
      const fileName = `Notes_${selectedTopic.replace(/\s+/g, '_') || 'Study'}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    const fetchSubjects = async () => {
      
      setSubjects(queryDocs('subjects', 'ownerUid', "local-user"));
    };
    fetchSubjects();
  }, []);

  useEffect(() => {
    const fetchUnits = async () => {
      if (!selectedSubject || false) {
        setUnits([]);
        return;
      }
      setUnits(queryDocs('units', 'subjectId', selectedSubject));
    };
    fetchUnits();
  }, [selectedSubject]);

  const handleGenerate = async () => {
    if (!selectedTopic) return;
    setLoading(true);
    setError(null);
    try {
      const subjectName = subjects.find(s => s.id === selectedSubject)?.name;
      const unitName = units.find(u => u.id === selectedUnit)?.name;

      const response = await apiFetch('/api/ai/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subjectName,
          unit: unitName,
          topic: selectedTopic
        })
      }, "local-user", 'AI Notes');

      if (!response.ok) {
        let errorMsg = 'Failed to generate notes';
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errorMsg = errData.error;
          }
        } catch (_) {}
        throw new Error(errorMsg);
      }
      const data = await response.json();
      setNotes(data.notes);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate notes. The AI service is currently experiencing high load. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedUnitData = units.find(u => u.id === selectedUnit);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">AI Notes Generator</h1>
        <p className="mt-2 text-zinc-600">Generate comprehensive, exam-ready notes for any topic in your syllabus.</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-800 flex flex-wrap gap-3">
          <div className="font-semibold shrink-0">Error:</div>
          <div>{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Subject</label>
            <select
              className="w-full rounded-lg border-zinc-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setSelectedUnit('');
                setSelectedTopic('');
              }}
            >
              <option value="">Select Subject</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Unit</label>
            <select
              className="w-full rounded-lg border-zinc-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              value={selectedUnit}
              onChange={(e) => {
                setSelectedUnit(e.target.value);
                setSelectedTopic('');
              }}
              disabled={!selectedSubject}
            >
              <option value="">Select Unit</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Topic</label>
            <select
              className="w-full rounded-lg border-zinc-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              disabled={!selectedUnit}
            >
              <option value="">Select Topic</option>
              {selectedUnitData?.topics?.map((t: string, idx: number) => (
                <option key={idx} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!selectedTopic || loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Generate Notes
          </button>
        </div>

        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-4 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <h2 className="font-semibold text-zinc-800">Generated Notes</h2>
            </div>
            {notes && !loading && (
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all cursor-pointer"
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Export PDF</span>
                  </>
                )}
              </button>
            )}
          </div>
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto prose prose-indigo max-w-full break-words">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <p>Generating comprehensive notes...</p>
              </div>
            ) : notes ? (
              <div id="notes-pdf-container" className="bg-white p-4 sm:p-6 md:p-8">
                <div className="mb-6 pb-6 border-b border-zinc-200">
                  <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-1">
                    {subjects.find(s => s.id === selectedSubject)?.name || 'Subject'} &bull; {units.find(u => u.id === selectedUnit)?.name || 'Unit'}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-zinc-950 mb-2">
                    {selectedTopic}
                  </h1>
                  <div className="text-xs text-zinc-500 flex items-center gap-4">
                    <span>Generated: {new Date().toLocaleDateString()}</span>
                    <span>&bull;</span>
                    <span>AI Lecture Handout</span>
                  </div>
                </div>
                <div className="text-zinc-800 leading-relaxed">
                  <MathMarkdown>{notes}</MathMarkdown>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                <FileText className="w-12 h-12 mb-4 opacity-20" />
                <p>Select a topic and click generate to create notes.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
