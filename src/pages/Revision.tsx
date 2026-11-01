import { logSearch } from '../lib/analytics';
import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/apiFetch';


import { 
  Brain, 
  Loader2, 
  RefreshCw, 
  X, 
  Check, 
  HelpCircle, 
  Award, 
  RotateCcw, 
  Sparkles 
} from 'lucide-react';
import { getCollection, addDoc, updateDoc, deleteDoc, queryDocs } from '../lib/localDb';
import MathMarkdown from '../components/MathMarkdown';

export default function Revision() {
    const [subjects, setSubjects] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [loading, setLoading] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Flashcards state
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [flashcardsLoading, setFlashcardsLoading] = useState(false);
  const [showFlashcardModal, setShowFlashcardModal] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState<number[]>([]);
  const [unknownCards, setUnknownCards] = useState<number[]>([]);
  const [originalDeck, setOriginalDeck] = useState<any[]>([]);

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

      const response = await apiFetch('/api/ai/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subjectName,
          unit: unitName,
          topic: 'Complete Unit Revision Summary'
        })
      }, "local-user", 'Smart Revision');

      if (!response.ok) {
        let errorMsg = 'Failed to generate revision notes';
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errorMsg = errData.error;
          }
        } catch (_) {}
        throw new Error(errorMsg);
      }
      const data = await response.json();
      setRevisionNotes(data.notes);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate revision notes. The AI service is currently experiencing high demand. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFlashcards = async () => {
    if (!selectedSubject || !selectedUnit) return;
    setFlashcardsLoading(true);
    setError(null);
    try {
      const subjectName = subjects.find(s => s.id === selectedSubject)?.name;
      const unitName = units.find(u => u.id === selectedUnit)?.name;

      const response = await apiFetch('/api/ai/generate-flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subjectName,
          unit: unitName
        })
      }, "local-user", 'Smart Revision');

      if (!response.ok) {
        let errorMsg = 'Failed to generate flashcards';
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errorMsg = errData.error;
          }
        } catch (_) {}
        throw new Error(errorMsg);
      }
      const data = await response.json();
      if (!data.flashcards || !Array.isArray(data.flashcards) || data.flashcards.length === 0) {
        throw new Error('AI did not return any flashcards for this unit. Please try again.');
      }
      
      setFlashcards(data.flashcards);
      setOriginalDeck(data.flashcards);
      setCurrentCardIndex(0);
      setIsFlipped(false);
      setKnownCards([]);
      setUnknownCards([]);
      setShowFlashcardModal(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate flashcards. Please try again.');
    } finally {
      setFlashcardsLoading(false);
    }
  };

  const handleGradeCard = (known: boolean) => {
    const actualIndex = originalDeck.findIndex(d => d.front === flashcards[currentCardIndex].front);
    const resolvedIndex = actualIndex !== -1 ? actualIndex : currentCardIndex;

    if (known) {
      setKnownCards(prev => [...prev, resolvedIndex]);
    } else {
      setUnknownCards(prev => [...prev, resolvedIndex]);
    }

    setIsFlipped(false);
    setTimeout(() => {
      setCurrentCardIndex(prev => prev + 1);
    }, 200);
  };

  const handleRestartAll = () => {
    setFlashcards(originalDeck);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setKnownCards([]);
    setUnknownCards([]);
  };

  const handleRetryUnknownOnly = () => {
    const unknownSubset = originalDeck.filter((_, idx) => unknownCards.includes(idx));
    setFlashcards(unknownSubset);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setKnownCards([]);
    setUnknownCards([]);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Smart Revision Mode</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Generate 1-page summaries, interactive flashcards, and practice lists for quick revisions.</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-800 flex flex-wrap gap-3">
          <div className="font-semibold shrink-0">Error:</div>
          <div>{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Subject</label>
            <select
              className="w-full rounded-lg border-zinc-300 dark:border-zinc-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white dark:bg-zinc-800"
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
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Unit</label>
            <select
              className="w-full rounded-lg border-zinc-300 dark:border-zinc-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white dark:bg-zinc-800"
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

          <div className="pt-2 space-y-2">
            <button
              onClick={handleGenerate}
              disabled={!selectedUnit || loading || flashcardsLoading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Generate 1-Page Summary
            </button>

            <button
              onClick={handleGenerateFlashcards}
              disabled={!selectedUnit || loading || flashcardsLoading}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 px-4 py-2.5 text-sm font-semibold shadow-sm disabled:opacity-50 transition-all"
            >
              {flashcardsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-yellow-500 dark:text-yellow-600 fill-yellow-500 dark:fill-yellow-600" />}
              Generate & Practice Flashcards
            </button>
          </div>
        </div>

        <div className="md:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-zinc-800 dark:text-zinc-200">Revision Sheet</h2>
          </div>
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto prose prose-indigo max-w-full break-words dark:prose-invert">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <p>Generating smart revision sheet...</p>
              </div>
            ) : revisionNotes ? (
              <MathMarkdown>{revisionNotes}</MathMarkdown>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                <Brain className="w-12 h-12 mb-4 opacity-20" />
                <p>Select a subject and unit to generate a quick revision summary or practice flashcards.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FLASHCARD REVISION MODAL */}
      {showFlashcardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
              <div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-indigo-500" />
                  Flashcard Revision
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {subjects.find(s => s.id === selectedSubject)?.name} &bull; {units.find(u => u.id === selectedUnit)?.name}
                </p>
              </div>
              <button
                onClick={() => setShowFlashcardModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex-1 overflow-y-auto flex flex-col justify-between min-h-[460px]">
              {currentCardIndex < flashcards.length ? (
                <>
                  {/* Progress indicator */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      <span>Card {currentCardIndex + 1} of {flashcards.length}</span>
                      <span>Progress: {Math.round((currentCardIndex / flashcards.length) * 100)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-850 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
                        style={{ width: `${(currentCardIndex / flashcards.length) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* 3D Flashcard Container */}
                  <div className="my-8 flex justify-center">
                    <div 
                      className="perspective-1000 w-full max-w-lg h-72 cursor-pointer relative group"
                      onClick={() => setIsFlipped(!isFlipped)}
                    >
                      <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                        
                        {/* Card Front */}
                        <div className="absolute inset-0 w-full h-full backface-hidden bg-white dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 flex flex-col justify-between shadow-md hover:border-indigo-400 dark:hover:border-indigo-600 transition-all">
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 tracking-wider uppercase">QUESTION</span>
                          <div className="flex-1 flex items-center justify-center text-center">
                            <p className="text-lg font-semibold text-zinc-800 dark:text-zinc-150 px-2 leading-relaxed">
                              {flashcards[currentCardIndex]?.front}
                            </p>
                          </div>
                          <div className="text-center text-xs text-zinc-400 dark:text-zinc-500 flex items-center justify-center gap-1.5 animate-pulse">
                            <span>Click card to reveal answer</span>
                            <RotateCcw className="w-3.5 h-3.5" />
                          </div>
                        </div>

                        {/* Card Back */}
                        <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 bg-indigo-50/10 dark:bg-indigo-950/20 border-2 border-indigo-200 dark:border-indigo-900/60 rounded-2xl p-6 flex flex-col justify-between shadow-md">
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase">ANSWER / EXPLANATION</span>
                          <div className="flex-1 flex items-center justify-center overflow-y-auto text-center py-2 my-2">
                            <p className="text-base font-medium text-zinc-800 dark:text-zinc-200 px-2 leading-relaxed">
                              {flashcards[currentCardIndex]?.back}
                            </p>
                          </div>
                          <div className="text-center text-xs text-zinc-400 dark:text-zinc-550">
                            Click to flip back
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>

                  {/* Feedback description instructions */}
                  <div className="text-center mb-6">
                    {!isFlipped ? (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Read the question first, then <strong className="text-indigo-600 dark:text-indigo-400 cursor-pointer" onClick={() => setIsFlipped(true)}>click the card</strong> to inspect the explanation.
                      </p>
                    ) : (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Self-grade: Did you remember this correctly?
                      </p>
                    )}
                  </div>

                  {/* Response Grading Buttons */}
                  <div className="flex flex-wrap gap-4">
                    <button
                      onClick={() => handleGradeCard(false)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-semibold text-sm transition-all ${
                        isFlipped 
                          ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40' 
                          : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400 cursor-not-allowed'
                      }`}
                      disabled={!isFlipped}
                    >
                      <HelpCircle className="w-5 h-5 shrink-0" />
                      Still Learning (Unknown)
                    </button>
                    <button
                      onClick={() => handleGradeCard(true)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-semibold text-sm transition-all ${
                        isFlipped 
                          ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 shadow-sm' 
                          : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400 cursor-not-allowed'
                      }`}
                      disabled={!isFlipped}
                    >
                      <Check className="w-5 h-5 shrink-0" />
                      I Knew This (Known)
                    </button>
                  </div>
                </>
              ) : (
                /* SCORE REPORT PANEL */
                <div className="flex-1 flex flex-col justify-between">
                  <div className="text-center py-6 space-y-6">
                    <div className="inline-flex p-4 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 animate-bounce">
                      <Award className="w-12 h-12" />
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Revision Session Complete!</h4>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                        You reviewed all {originalDeck.length} flashcards in this deck. Here is your knowledge breakdown:
                      </p>
                    </div>

                    {/* Progress Circle or elegant metrics card */}
                    <div className="max-w-xs mx-auto bg-zinc-50 dark:bg-zinc-850/60 p-6 rounded-2xl border border-zinc-150 dark:border-zinc-800 space-y-4">
                      <div className="text-4xl font-extrabold text-indigo-600 dark:text-indigo-400">
                        {Math.round((knownCards.length / originalDeck.length) * 100)}%
                      </div>
                      <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full"
                          style={{ width: `${(knownCards.length / originalDeck.length) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Known: {knownCards.length}
                        </span>
                        <span className="flex items-center gap-1 text-red-500">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          Unknown: {unknownCards.length}
                        </span>
                      </div>
                    </div>

                    {/* Still Learning list for quick reminders */}
                    {unknownCards.length > 0 && (
                      <div className="text-left bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-150 dark:border-zinc-800 rounded-xl p-4 max-h-[160px] overflow-y-auto">
                        <h5 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5" />
                          Topics to focus on ({unknownCards.length})
                        </h5>
                        <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                          {unknownCards.map((idx) => (
                            <li key={idx} className="flex flex-wrap gap-2 items-start">
                              <span className="text-red-500 select-none font-semibold shrink-0">&bull;</span>
                              <span className="font-medium">{originalDeck[idx]?.front}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Final Feedback Message */}
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {knownCards.length === originalDeck.length 
                        ? '🏆 Stellar work! You have complete mastery over this content.'
                        : knownCards.length / originalDeck.length >= 0.7 
                          ? '✨ Solid effort! A little more study on the missed items and you will have it.'
                          : '📚 Practice makes perfect. Retry the deck or run through the missed items again.'}
                    </p>
                  </div>

                  {/* Actions footer inside Score Report */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                      onClick={handleRestartAll}
                      className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 font-semibold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Retry Full Deck
                    </button>
                    {unknownCards.length > 0 && (
                      <button
                        onClick={handleRetryUnknownOnly}
                        className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Retry Missed ({unknownCards.length})
                      </button>
                    )}
                    <button
                      onClick={() => setShowFlashcardModal(false)}
                      className="py-2.5 px-5 rounded-xl bg-zinc-800 hover:bg-zinc-750 dark:bg-zinc-700 dark:hover:bg-zinc-650 text-white font-semibold text-sm transition-colors"
                    >
                      Close Practice
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

