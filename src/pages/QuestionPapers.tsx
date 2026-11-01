import { logSearch } from '../lib/analytics';
import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/apiFetch';


import { HelpCircle, Loader2, FileText } from 'lucide-react';
import { getCollection, addDoc, updateDoc, deleteDoc, queryDocs } from '../lib/localDb';
import MathMarkdown from '../components/MathMarkdown';

export default function QuestionPapers() {
    const [subjects, setSubjects] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [paperType, setPaperType] = useState('Unit wise question bank');
  const [difficulty, setDifficulty] = useState('Medium');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState('');
  const [error, setError] = useState<string | null>(null);

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
    if (!selectedSubject || !selectedUnit) return;
    setLoading(true);
    setError(null);
    try {
      const subjectName = subjects.find(s => s.id === selectedSubject)?.name;
      const unitName = units.find(u => u.id === selectedUnit)?.name;

      const response = await apiFetch('/api/ai/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subjectName,
          unit: unitName,
          type: paperType,
          difficulty: difficulty
        })
      }, "local-user", 'Question Papers');

      if (!response.ok) {
        let errorMsg = 'Failed to generate questions';
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errorMsg = errData.error;
          }
        } catch (_) {}
        throw new Error(errorMsg);
      }
      const data = await response.json();
      setQuestions(data.questions);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate questions. The AI service is currently experiencing high demand. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">AI Question Paper Generator</h1>
        <p className="mt-2 text-zinc-600">Generate question banks, model papers, and practice tests based on your syllabus.</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-800 flex flex-wrap gap-3">
          <div className="font-semibold shrink-0">Error:</div>
          <div>{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Subject</label>
            <select
              className="w-full rounded-lg border-zinc-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setSelectedUnit('');
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
              onChange={(e) => setSelectedUnit(e.target.value)}
              disabled={!selectedSubject}
            >
              <option value="">Select Unit</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Paper Type</label>
            <select
              className="w-full rounded-lg border-zinc-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              value={paperType}
              onChange={(e) => setPaperType(e.target.value)}
            >
              <option value="Unit wise question bank">Unit wise question bank</option>
              <option value="Model exam paper">Model exam paper</option>
              <option value="Previous year style paper">Previous year style paper</option>
              <option value="MCQ practice test">MCQ practice test</option>
              <option value="Viva questions">Viva questions</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Difficulty</label>
            <select
              className="w-full rounded-lg border-zinc-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Exam level">Exam level</option>
            </select>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!selectedUnit || loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <HelpCircle className="w-4 h-4" />}
            Generate Questions
          </button>
        </div>

        <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-4 border-b border-zinc-100 bg-zinc-50 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-zinc-800">Generated Question Paper</h2>
          </div>
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto prose prose-indigo max-w-full break-words">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <p>Generating questions...</p>
              </div>
            ) : questions ? (
              <MathMarkdown>{questions}</MathMarkdown>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                <HelpCircle className="w-12 h-12 mb-4 opacity-20" />
                <p>Select a subject and unit to generate a question paper.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
