import { useState, useRef, DragEvent, ChangeEvent, useEffect } from 'react';
import { Upload, FileText, Loader2, CheckCircle2, X, AlertCircle, RefreshCw, ClipboardPaste, BookOpen } from 'lucide-react';
import { addDoc } from '../lib/localDb';
import { useNavigate } from 'react-router-dom';

const SUPPORTED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.csv', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.webp'];

export default function UploadSyllabus() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ state: '', percent: 0 });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global paste handler
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Don't intercept if user is typing in a text area or input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        handleFile(e.clipboardData.files[0]);
      } else if (e.clipboardData?.items) {
        for (let i = 0; i < e.clipboardData.items.length; i++) {
          if (e.clipboardData.items[i].kind === 'string' && e.clipboardData.items[i].type === 'text/plain') {
            e.clipboardData.items[i].getAsString((s) => {
              setText((prev) => (prev ? prev + '\n' + s : s));
            });
            break;
          }
        }
      }
    };
    
    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, []);

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (selectedFile: File) => {
    const maxSize = 200 * 1024 * 1024; // 200MB
    const ext = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
    
    if (!SUPPORTED_EXTENSIONS.includes(ext) && !SUPPORTED_EXTENSIONS.includes('.' + selectedFile.type.split('/')[1])) {
      setError(`Unsupported file type: ${ext || 'Unknown'}. Please upload PDF, Word, Text, Excel, PowerPoint, or Images.`);
      setFile(null);
      return;
    }
    
    if (selectedFile.size > maxSize) {
      setError('File is too large. Maximum size is 200MB.');
      setFile(null);
      return;
    }
    
    setFile(selectedFile);
    setError(null);
    setText(''); // clear text if file selected
  };

  const handleUpload = async () => {
    if (!file && !text.trim()) {
      setError('Please provide syllabus text or select a file to process.');
      return;
    }
    
    setLoading(true);
    setSuccess(false);
    setError(null);
    setProgress({ state: 'Initializing engine...', percent: 5 });

    try {
      let data;
      let originalFileName = 'Pasted Text';
      let fileType = 'text/plain';
      let fileSize = text.length;

      if (file) {
        originalFileName = file.name;
        fileType = file.type || 'unknown';
        fileSize = file.size;
        
        setProgress({ state: 'Uploading file securely...', percent: 20 });
        
        const formData = new FormData();
        formData.append('file', file);
        
        // Timeout handling for large files via AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes timeout

        const response = await fetch('/api/ai/upload-syllabus', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          let errorMsg = 'Network or server error during file upload.';
          try {
            const errData = await response.json();
            if (errData?.error) errorMsg = errData.error;
            if (errData?.details) errorMsg += ' - ' + errData.details;
          } catch (_) {}
          throw new Error(errorMsg);
        }
        setProgress({ state: 'Extracting text and structure (AI)...', percent: 60 });
        data = await response.json();
      } else {
        setProgress({ state: 'Analyzing text (AI)...', percent: 40 });
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);
        
        const response = await fetch('/api/ai/parse-syllabus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          let errorMsg = 'Failed to process syllabus text.';
          try {
            const errData = await response.json();
            if (errData?.error) errorMsg = errData.error;
            if (errData?.details) errorMsg += ' - ' + errData.details;
          } catch (_) {}
          throw new Error(errorMsg);
        }
        setProgress({ state: 'Extracting structure...', percent: 70 });
        data = await response.json();
      }

      if (!data?.subjects || !Array.isArray(data.subjects) || data.subjects.length === 0) {
        throw new Error('Could not detect any structured subjects or units from the provided content. Please ensure it is a valid syllabus.');
      }

      setProgress({ state: 'Saving structured data...', percent: 85 });

      // Save upload record
      const uploadRef = addDoc("uploads", {
        ownerUid: "local-user",
        userId: "local-user",
        originalFileName,
        fileType,
        fileSize,
        uploadDate: new Date().toISOString(),
        status: 'Processed',
        detectedSubjects: data.subjects?.map((s: any) => s.name) || []
      });

      // Save subjects & units
      let totalUnits = 0;
      for (const subject of data.subjects) {
        const subjectRef = addDoc("subjects", {
          ownerUid: "local-user",
          userId: "local-user",
          uploadId: uploadRef.id,
          updatedAt: new Date().toISOString(),
          semesterId: 'default',
          name: (subject.name || 'Untitled Subject').substring(0, 100),
          marksDistribution: subject.marksDistribution || '',
          createdAt: new Date().toISOString(),
        });

        if (subject.units && Array.isArray(subject.units)) {
          for (const unit of subject.units) {
            addDoc("units", {
              ownerUid: "local-user",
              userId: "local-user",
              subjectId: subjectRef.id,
              name: (unit.name || 'Untitled Unit').substring(0, 100),
              topics: unit.topics || [],
              status: 'Not Started',
              createdAt: new Date().toISOString(),
            });
            totalUnits++;
          }
        }
      }
      
      setProgress({ state: `Generated structure for ${data.subjects.length} subjects and ${totalUnits} units...`, percent: 95 });

      // Generate study plan automatically
      setTimeout(() => {
         fetch('/api/ai/generate-schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subjects: data.subjects })
         }).then(res => res.json()).then(scheduleData => {
            if (scheduleData?.tasks) {
               for (const task of scheduleData.tasks) {
                  addDoc("study_tasks", {
                     ownerUid: "local-user",
                     userId: "local-user",
                     title: task.title,
                     subjectName: task.subjectName,
                     description: task.description || '',
                     dueDate: new Date(Date.now() + task.dayOffset * 86400000).toISOString(),
                     completed: false,
                     createdAt: new Date().toISOString(),
                  });
               }
            }
         }).catch(console.error);
      }, 100); // fire and forget

      setProgress({ state: 'Complete!', percent: 100 });
      setSuccess(true);
      setFile(null);
      setText('');
      
      setTimeout(() => {
        navigate('/my-syllabus');
      }, 2000);

    } catch (err: any) {
      console.error('Upload Error:', err);
      let displayError = err.message || 'An unexpected error occurred.';
      if (displayError.includes('AbortError') || displayError.includes('signal is aborted')) {
        displayError = 'The request timed out because the document is extremely large. Please try splitting the document or extracting plain text.';
      }
      setError(displayError);
    } finally {
      setLoading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
          Upload Syllabus
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 max-w-2xl">
          Upload your university syllabus document. Our AI engine will analyze the structure, extract topics, and automatically prepare notes, quizzes, and a custom revision roadmap.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-sm text-red-800 dark:text-red-300 flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold mb-1">Processing Failed</h4>
            <p className="opacity-90">{error}</p>
            <div className="mt-3">
              <button 
                onClick={handleUpload}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-900/80 text-red-700 dark:text-red-200 font-medium rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-3 shadow-sm">
          <CheckCircle2 className="w-6 h-6 shrink-0" />
          <div>
            <div className="font-semibold text-base">Syllabus processed successfully!</div>
            <p className="opacity-90">Auto-generating study roadmap... Redirecting to your dashboard.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Upload Section */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col h-full">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-500" />
            Document Upload
          </h2>
          
          <div
            className={`flex-1 relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl transition-all duration-200 ease-in-out ${
              dragActive 
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' 
                : file 
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' 
                  : 'border-zinc-300 dark:border-zinc-700 hover:border-indigo-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={SUPPORTED_EXTENSIONS.join(',')}
              onChange={handleChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              disabled={loading || !!text}
            />
            
            {file ? (
              <div className="text-center space-y-3 z-10">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <p className="font-medium text-emerald-700 dark:text-emerald-400 break-all">{file.name}</p>
                  <p className="text-sm text-emerald-600/70 dark:text-emerald-500 mt-1">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type || 'Document'}
                  </p>
                </div>
                {!loading && (
                  <button 
                    type="button"
                    onClick={(e) => { e.preventDefault(); removeFile(); }}
                    className="relative z-20 mt-4 px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-red-600 hover:border-red-200 transition-colors shadow-sm"
                  >
                    Remove File
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-base font-medium text-zinc-700 dark:text-zinc-300">
                    <span className="text-indigo-600 dark:text-indigo-400 cursor-pointer pointer-events-none">Click to browse</span> or drag and drop
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                    PDF, Word, Excel, PPT, TXT, CSV, or Images
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                    Supports large multi-subject documents (up to 200MB)
                  </p>
                </div>
              </div>
            )}
            
            {dragActive && !file && (
              <div className="absolute inset-0 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-xl pointer-events-none border-2 border-indigo-500" />
            )}
          </div>
        </div>

        {/* Text/Paste Section */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col h-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <ClipboardPaste className="w-5 h-5 text-emerald-500" />
              Manual Text Entry
            </h2>
            <span className="text-xs font-medium px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-md">
              Ctrl+V Anywhere
            </span>
          </div>
          
          <div className="flex-1 relative flex flex-col">
            <textarea
              className={`flex-1 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-4 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none ${
                file ? 'opacity-50 cursor-not-allowed bg-zinc-100 dark:bg-zinc-900' : ''
              }`}
              placeholder="Paste raw syllabus text here if you prefer not to upload a file. The AI engine will parse long pasted content directly..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={loading || !!file}
            />
            
            {text && !loading && (
               <button 
                type="button"
                onClick={() => setText('')}
                className="absolute top-3 right-3 p-1.5 bg-white dark:bg-zinc-700 rounded-md text-zinc-400 hover:text-red-500 shadow-sm border border-zinc-200 dark:border-zinc-600"
               >
                 <X className="w-4 h-4" />
               </button>
            )}
          </div>
        </div>
      </div>

      {/* Upload Controls & Progress */}
      <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
        {!loading ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
              <BookOpen className="w-5 h-5" />
              <span>The AI engine will automatically extract units, chapters, and marks.</span>
            </div>
            
            <button
              onClick={handleUpload}
              disabled={!file && !text.trim()}
              className="w-full sm:w-auto px-8 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
            >
              Analyze Syllabus
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm font-medium">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                {progress.state}
              </div>
              <span className="text-zinc-500">{progress.percent}%</span>
            </div>
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out relative overflow-hidden" 
                style={{ width: `${progress.percent}%` }}
              >
                <div className="absolute top-0 bottom-0 left-0 right-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>
            <p className="text-xs text-zinc-500 text-center">
              Please wait while the AI extracts structured knowledge. This can take up to 2 minutes for very large documents.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
