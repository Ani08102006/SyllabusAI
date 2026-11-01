import { logSearch } from '../lib/analytics';
import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../lib/apiFetch';
import { 
  MessageSquare, Send, Loader2, User, Bot, Mic, MicOff, 
  Sparkles, Search, Copy, Check, Volume2, VolumeX, ShieldAlert,
  Play, Square, GraduationCap, Award, HelpCircle, Laptop, Globe, Info
} from 'lucide-react';
import MathMarkdown from '../components/MathMarkdown';
import ImageGenerator from '../components/ImageGenerator';

type Message = {
  role: 'user' | 'ai';
  content: string;
  sources?: { title: string; uri: string }[];
};

type TutorRole = {
  id: string;
  name: string;
  description: string;
  systemInstruction: string;
  icon: any;
};

const TUTOR_ROLES: TutorRole[] = [
  {
    id: 'professional',
    name: 'Professional Tutor',
    description: 'A comprehensive academic tutor that adapts to your level, solves problems step-by-step, and can generate quizzes, flashcards, or study plans.',
    systemInstruction: 'You are a professional, elite academic study tutor. Always provide clear, step-by-step explanations and solve problems methodically. Adapt your language and depth of explanation to the student\'s level based on their questions. Use the conversation context to seamlessly answer follow-up questions. When requested, proactively generate high-quality quizzes, summaries, study plans, or flashcards. Always format your responses beautifully using Markdown. Never return a blank response.',
    icon: GraduationCap
  },
  {
    id: 'socratic',
    name: 'Socratic Tutor',
    description: 'Helps you understand concepts on your own by asking guidance questions.',
    systemInstruction: 'You are a patient Socratic study tutor. Never give direct answers immediately. Instead, guide the user to find the answer themselves by asking helpful, progressive hint questions. Adapt explanations to their level and use conversation context. Keep your tone encouraging and academic.',
    icon: HelpCircle
  },
  {
    id: 'grader',
    name: 'Strict Exam Grader',
    description: 'Grades your answers based on official university standards and checks gaps.',
    systemInstruction: 'You are a critical, strict academic evaluator. When the user provides an answer or notes, evaluate it rigorously out of 10 marks. Outline exactly what is missing, give feedback, and suggest concrete improvements to score a perfect 10/10. Base it on the conversation context.',
    icon: Award
  },
  {
    id: 'buddy',
    name: 'Encouraging Study Buddy',
    description: 'Explains complex topics simply using relatable, real-world analogies.',
    systemInstruction: 'You are an energetic, supportive, and friendly peer study buddy. Explain academic terms using fun, everyday analogies, humor, and plain language. Break down complex equations into intuitive steps. Encourage the user frequently!',
    icon: HelpCircle
  },
  {
    id: 'code',
    name: 'Tech & Logic Mentor',
    description: 'Explains algorithms, math, code structures, and logic flows.',
    systemInstruction: 'You are an expert technical and computer science mentor. Focus heavily on clean syntax, dry runs, algorithms, step-by-step mathematical logic, and edge cases. Structure your answers logically using bullet points and tables where helpful. Adapt to the student\'s level.',
    icon: Laptop
  }
];

export default function AIChatTutor() {
    const [activeTab, setActiveTab] = useState<'chat' | 'transcriber' | 'voice' | 'image'>('chat');

  // --- TAB 1: Chat State ---
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', content: 'Hello! I am your AI Study Tutor. Select a specialized role from the options, or ask me any question about your course syllabus!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<TutorRole>(TUTOR_ROLES[0]);
  const [selectedModel, setSelectedModel] = useState<'gemini-3.1-flash-lite' | 'gemini-2.0-flash' | 'gemini-3.1-pro-preview'>('gemini-2.0-flash');
  const [useSearch, setUseSearch] = useState(false);
  const [useThinking, setUseThinking] = useState(false);

  // --- TAB 2: Transcriber State ---
  const [isRecordingText, setIsRecordingText] = useState(false);
  const [transcribeRecorder, setTranscribeRecorder] = useState<MediaRecorder | null>(null);
  const [transcriptionText, setTranscriptionText] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [copiedTranscribe, setCopiedTranscribe] = useState(false);

  // --- TAB 3: Live API (Voice Buddy) State ---
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'idle' | 'connecting' | 'listening' | 'speaking' | 'error'>('idle');
  const [liveErrorMsg, setLiveErrorMsg] = useState('');
  const [isLiveMuted, setIsLiveMuted] = useState(false);

  // Refs for auto-scroll and WebSocket
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const liveWsRef = useRef<WebSocket | null>(null);
  const liveInputCtxRef = useRef<AudioContext | null>(null);
  const liveOutputCtxRef = useRef<AudioContext | null>(null);
  const liveNextStartTimeRef = useRef<number>(0);
  const liveStreamRef = useRef<MediaStream | null>(null);
  const liveProcessorRef = useRef<ScriptProcessorNode | null>(null);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Clean up Web Audio and Live WS when component unmounts or tab changes
  useEffect(() => {
    return () => {
      cleanupLiveVoice();
    };
  }, [activeTab]);

  // --- TAB 1: Chat Actions ---
  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsgText = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsgText }]);
    setLoading(true);

    try {
      const response = await apiFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsgText,
          history: messages.slice(1), // omit the initial welcome message from raw history
          model: selectedModel,
          roleInstruction: selectedRole.systemInstruction,
          useSearch,
          useThinking
        })
      }, "local-user", 'AI Chat Tutor');

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        let errMsg = errData.error || 'Failed to get tutoring response';
        // Cleanup technical details for the user
        if (typeof errMsg === 'string' && errMsg.includes('RESOURCE_EXHAUSTED')) {
          errMsg = 'The AI is currently experiencing high demand. Please wait a moment and try again.';
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      setMessages(prev => [...prev, { 
        role: 'ai', 
        content: data.reply,
        sources: data.sources 
      }]);
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, {
        role: 'ai',
        content: `**Error:** ${err.message || 'The tutoring service failed to respond. Please verify your internet connection.'}`
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Switch models or enforce thinking constraints
  const toggleThinking = (checked: boolean) => {
    setUseThinking(checked);
    if (checked) {
      setSelectedModel('gemini-3.1-pro-preview'); // Lock to Pro
    }
  };

  const handleModelChange = (model: any) => {
    setSelectedModel(model);
    if (model !== 'gemini-3.1-pro-preview') {
      setUseThinking(false);
    }
  };

  // --- TAB 2: Audio Dictation / Transcriber Actions ---
  const startTranscribeRecording = async () => {
    setTranscriptionText('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = { mimeType: 'audio/webm' };
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch (_) {
        recorder = new MediaRecorder(stream);
      }

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          await submitForTranscription(base64Audio, recorder.mimeType || 'audio/webm');
        };
        reader.readAsDataURL(audioBlob);

        // Turn off mic tracks
        stream.getTracks().forEach(t => t.stop());
      };

      setTranscribeRecorder(recorder);
      recorder.start();
      setIsRecordingText(true);
    } catch (err: any) {
      console.error('Mic access denied:', err);
      setTranscriptionText('Microphone permission or hardware access was denied.');
    }
  };

  const stopTranscribeRecording = () => {
    if (transcribeRecorder && isRecordingText) {
      transcribeRecorder.stop();
      setIsRecordingText(false);
    }
  };

  const submitForTranscription = async (base64Data: string, mimeType: string) => {
    setIsTranscribing(true);
    try {
      const res = await apiFetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64Data, mimeType })
      }, "local-user", 'AI Chat Tutor');
      if (!res.ok) throw new Error('Failed to parse audio payload');
      const data = await res.json();
      setTranscriptionText(data.text || 'No speech was detected in the recording. Try speaking louder or check your input levels.');
    } catch (err: any) {
      console.error(err);
      setTranscriptionText('Failed to transcribe audio. Verify your internet connection and try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleCopyTranscribe = () => {
    navigator.clipboard.writeText(transcriptionText);
    setCopiedTranscribe(true);
    setTimeout(() => setCopiedTranscribe(false), 2000);
  };

  const handleSummarizeLecture = async () => {
    if (!transcriptionText || isSummarizing) return;
    setIsSummarizing(true);
    try {
      const res = await apiFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Summarize the following transcribed lecture/audio notes into an organized study outline with key takeaways, definitions, and equations:\n\n${transcriptionText}`,
          model: 'gemini-2.0-flash',
          roleInstruction: 'You are an elite academic summarizer. Outline everything cleanly.'
        })
      }, "local-user", 'AI Chat Tutor');
      if (!res.ok) throw new Error('Summarization failed');
      const data = await res.json();
      
      // Inject directly into the main chat window
      setMessages(prev => [...prev, 
        { role: 'user', content: `[Summarize My Spoken Lecture/Audio]` },
        { role: 'ai', content: data.reply }
      ]);
      setActiveTab('chat');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSummarizing(false);
    }
  };

  // --- TAB 3: Live API real-time voice buddy ---
  const startLiveVoiceSession = async () => {
    setLiveStatus('connecting');
    setLiveErrorMsg('');
    try {
      // Connect to unified relative server endpoint via protocol-aware link
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live`;
      const ws = new WebSocket(wsUrl);
      liveWsRef.current = ws;

      // Audio capture (16kHz for downsampling raw PCM)
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      liveInputCtxRef.current = inputCtx;

      // Output audio ctx (24kHz for model output playback)
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      liveOutputCtxRef.current = outputCtx;
      liveNextStartTimeRef.current = outputCtx.currentTime;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      liveStreamRef.current = stream;

      const source = inputCtx.createMediaStreamSource(stream);
      // Create ScriptProcessor with buffer size 4096 (1 channel)
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      liveProcessorRef.current = processor;

      source.connect(processor);
      processor.connect(inputCtx.destination);

      // Handle PCM streaming output
      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN && !isLiveMuted) {
          const inputData = e.inputBuffer.getChannelData(0);
          // Convert inputData Float32 to 16-bit PCM buffer
          const pcmBuffer = new ArrayBuffer(inputData.length * 2);
          const view = new DataView(pcmBuffer);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
          }

          // Convert ArrayBuffer to base64
          const bytes = new Uint8Array(pcmBuffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64PCM = btoa(binary);

          ws.send(JSON.stringify({ audio: base64PCM }));
        }
      };

      ws.onopen = () => {
        setIsLiveConnected(true);
        setLiveStatus('listening');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.error) {
            setLiveErrorMsg(msg.error);
            setLiveStatus('error');
            cleanupLiveVoice();
            return;
          }

          if (msg.audio) {
            setLiveStatus('speaking');
            
            // Queue and schedule PCM playback
            const binary = atob(msg.audio);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            
            const int16Array = new Int16Array(bytes.buffer);
            const float32Array = new Float32Array(int16Array.length);
            for (let i = 0; i < int16Array.length; i++) {
              float32Array[i] = int16Array[i] / 32768;
            }

            const playCtx = liveOutputCtxRef.current || outputCtx;
            if (playCtx.state === 'suspended') {
              playCtx.resume();
            }

            const audioBuffer = playCtx.createBuffer(1, float32Array.length, 24000);
            audioBuffer.copyToChannel(float32Array, 0);

            const sourceNode = playCtx.createBufferSource();
            sourceNode.buffer = audioBuffer;
            sourceNode.connect(playCtx.destination);

            const now = playCtx.currentTime;
            let startTime = liveNextStartTimeRef.current;
            if (startTime < now) {
              startTime = now + 0.05; // tiny latency pad
            }

            sourceNode.start(startTime);
            liveNextStartTimeRef.current = startTime + audioBuffer.duration;

            // Trigger reset to 'listening' once playback finishes
            sourceNode.onended = () => {
              if (playCtx.currentTime >= liveNextStartTimeRef.current - 0.1) {
                setLiveStatus('listening');
              }
            };
          }

          if (msg.interrupted) {
            // Stop scheduled sounds immediately
            setLiveStatus('listening');
            liveNextStartTimeRef.current = liveOutputCtxRef.current?.currentTime || 0;
          }
        } catch (err) {
          console.error('Error handling WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        setIsLiveConnected(false);
        if (liveStatus !== 'error') {
          setLiveStatus('idle');
        }
      };

      ws.onerror = () => {
        setLiveStatus('error');
        setLiveErrorMsg('WebSocket connection encountered a socket error.');
        cleanupLiveVoice();
      };

    } catch (err: any) {
      console.error(err);
      setLiveStatus('error');
      setLiveErrorMsg(err.message || 'Microphone access failed.');
      cleanupLiveVoice();
    }
  };

  const cleanupLiveVoice = () => {
    if (liveWsRef.current) {
      try {
        liveWsRef.current.close();
      } catch (_) {}
      liveWsRef.current = null;
    }
    if (liveProcessorRef.current) {
      try {
        liveProcessorRef.current.disconnect();
      } catch (_) {}
      liveProcessorRef.current = null;
    }
    if (liveInputCtxRef.current) {
      try {
        liveInputCtxRef.current.close();
      } catch (_) {}
      liveInputCtxRef.current = null;
    }
    if (liveOutputCtxRef.current) {
      try {
        liveOutputCtxRef.current.close();
      } catch (_) {}
      liveOutputCtxRef.current = null;
    }
    if (liveStreamRef.current) {
      try {
        liveStreamRef.current.getTracks().forEach(t => t.stop());
      } catch (_) {}
      liveStreamRef.current = null;
    }
    setIsLiveConnected(false);
  };

  const toggleLiveMute = () => {
    setIsLiveMuted(prev => !prev);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header and Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-pulse" />
            AI Voice & Chat Companion
          </h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            A comprehensive, multi-modal hub containing chat, lecture transcriptions, and instant voice conversations.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl flex flex-wrap border border-zinc-200 dark:border-zinc-800 gap-1">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'chat'
                ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            AI Chat Tutor
          </button>
          <button
            onClick={() => setActiveTab('transcriber')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'transcriber'
                ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            Lecture Transcriber
          </button>
          <button
            onClick={() => setActiveTab('image')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'image'
                ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            Diagrams & Images
          </button>
          <button
            onClick={() => setActiveTab('voice')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'voice'
                ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            Live Voice Buddy
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* LEFT COLUMN: Sidebar Config for current tab */}
        <div className="lg:col-span-1 space-y-6">
          {activeTab === 'chat' && (
            <>
              {/* Tutor Role Selector */}
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-4">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Tutor Persona</h3>
                <div className="space-y-2">
                  {TUTOR_ROLES.map((role) => {
                    const Icon = role.icon;
                    return (
                      <button
                        key={role.id}
                        onClick={() => setSelectedRole(role)}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                          selectedRole.id === role.id
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500 text-indigo-700 dark:text-indigo-400'
                            : 'bg-transparent border-zinc-100 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                        }`}
                      >
                        <Icon className="w-5 h-5 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-semibold text-xs">{role.name}</p>
                          <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{role.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Advanced Controls Toggle */}
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-4">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Intelligence Options</h3>
                
                {/* Speed/Model selector */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Processing Speed</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => handleModelChange(e.target.value)}
                    disabled={useThinking}
                    className="w-full text-xs rounded-xl border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-100 py-2 px-3 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="gemini-3.1-flash-lite">Fast (Lite)</option>
                    <option value="gemini-2.0-flash">Normal (General)</option>
                    <option value="gemini-3.1-pro-preview">Complex (Pro)</option>
                  </select>
                </div>

                <hr className="border-zinc-100 dark:border-zinc-800" />

                {/* Search Grounding toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-500" />
                    <div>
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Google Search</span>
                      <p className="text-[10px] text-zinc-500">Real-time Grounding</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={useSearch}
                    onChange={(e) => setUseSearch(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                </div>

                <hr className="border-zinc-100 dark:border-zinc-800" />

                {/* Thinking Mode toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-500 animate-spin" style={{ animationDuration: '6s' }} />
                    <div>
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Deep Reasoning</span>
                      <p className="text-[10px] text-zinc-500">High thinking level</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={useThinking}
                    onChange={(e) => toggleThinking(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                </div>
              </div>
            </>
          )}

          {activeTab === 'transcriber' && (
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-4">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                <Info className="w-4 h-4 text-zinc-500" />
                Speech Dictate
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Record live college lectures, spoken essays, or dictation, and watch them convert instantly into readable notes using <strong className="text-indigo-600 dark:text-indigo-400">gemini-2.0-flash</strong>.
              </p>
            </div>
          )}

          {activeTab === 'image' && (
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-4">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                <Info className="w-4 h-4 text-zinc-500" />
                Diagram Generator
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Create high-quality diagrams, edit existing images, or visualize concepts using <strong className="text-indigo-600 dark:text-indigo-400">Gemini Image Generation</strong>.
              </p>
            </div>
          )}
          {activeTab === 'voice' && (
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-4">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                <Info className="w-4 h-4 text-zinc-500" />
                Live Audio Session
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Connect directly to our real-time low latency auditory gateway powered by <strong className="text-indigo-600 dark:text-indigo-400">gemini-2.0-flash</strong>.
              </p>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Speak directly into your microphone, listen to natural responses dynamically streamed over WebSockets, and learn comfortably hands-free.
              </p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Active workspace area */}
        <div className="lg:col-span-3">
          
          {/* TAB 1: Chat interface */}
          {activeTab === 'chat' && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col h-[70vh] lg:h-[600px] min-h-[400px] overflow-hidden">
              {/* Chat Header */}
              <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Active: {selectedRole.name} ({selectedModel})
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {useThinking && (
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                      Deep Thinking Mode Active
                    </span>
                  )}
                  <button
                    onClick={() => setMessages([{ role: 'ai', content: 'Hello! I am your AI Study Tutor. Select a specialized role from the options, or ask me any question about your course syllabus!' }])}
                    className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 px-2 py-1 rounded-md transition-colors"
                  >
                    Reset Chat
                  </button>
                </div>
              </div>

              {/* Scrollable messages thread */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex items-start gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      msg.role === 'user' ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                    </div>
                    <div className={`min-w-0 max-w-[85%] break-words rounded-2xl p-4 shadow-sm border ${
                      msg.role === 'user' 
                        ? 'bg-indigo-600 dark:bg-indigo-700 text-white border-indigo-500' 
                        : 'bg-zinc-50 dark:bg-zinc-800/40 text-zinc-900 dark:text-zinc-100 border-zinc-100 dark:border-zinc-800'
                    }`}>
                      <div className={`prose dark:prose-invert ${msg.role === 'user' ? 'prose-invert text-white' : 'prose-zinc text-zinc-900 dark:text-zinc-100'} max-w-full text-sm leading-relaxed overflow-hidden`}>
                        <MathMarkdown>{msg.content}</MathMarkdown>
                      </div>

                      {/* Display search grounding sources if present */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700 space-y-1.5">
                          <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                            <Search className="w-3. h-3" /> Grounded Search Sources:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.map((src, sIdx) => (
                              <a
                                key={sIdx}
                                href={src.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded flex items-center gap-1 truncate max-w-xs"
                              >
                                <Globe className="w-3 h-3" />
                                {src.title || 'Source'}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex flex-wrap gap-4">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4 flex items-center gap-3">
                      <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        {useThinking ? 'AI is processing through deep reasoning steps...' : 'SyllabusAI is thinking...'}
                      </span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={`Ask our ${selectedRole.name}...`}
                    className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-4 py-3 text-sm focus:outline-none"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || loading}
                    className="px-5 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-500 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Send</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Transcriber interface */}
          {activeTab === 'transcriber' && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 space-y-6">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Lecture Transcriber & Audio Notes</h2>
              
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 bg-zinc-50/50 dark:bg-zinc-900/30 text-center space-y-4">
                
                {/* Visual recording status */}
                {isRecordingText ? (
                  <div className="relative flex flex-col items-center space-y-3">
                    {/* Pulsing Waveform Mimic */}
                    <div className="flex items-center gap-1.5 h-12">
                      <span className="w-1.5 h-6 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <span className="w-1.5 h-10 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      <span className="w-1.5 h-8 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                      <span className="w-1.5 h-12 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                      <span className="w-1.5 h-5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }} />
                    </div>
                    <span className="text-sm font-semibold text-red-500 animate-pulse">Recording Lecture Audio...</span>
                  </div>
                ) : (
                  <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center shadow-inner">
                    <Mic className="w-7 h-7" />
                  </div>
                )}

                <div className="max-w-md">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {isRecordingText ? 'Stop recording when you are finished speaking.' : 'Click "Start Recording" to begin dictating your lecture.'}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Your audio will be processed locally and transcribed with high accuracy.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {!isRecordingText ? (
                    <button
                      onClick={startTranscribeRecording}
                      disabled={isTranscribing}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl flex items-center gap-2 shadow-sm transition-colors"
                    >
                      <Play className="w-4 h-4" /> Start Recording
                    </button>
                  ) : (
                    <button
                      onClick={stopTranscribeRecording}
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl flex items-center gap-2 shadow-sm transition-colors"
                    >
                      <Square className="w-4 h-4" /> Stop Recording
                    </button>
                  )}
                </div>
              </div>

              {/* Transcription Result Area */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Transcription Result</span>
                  {transcriptionText && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyTranscribe}
                        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors flex items-center gap-1 text-xs"
                        title="Copy text"
                      >
                        {copiedTranscribe ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedTranscribe ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        onClick={handleSummarizeLecture}
                        disabled={isSummarizing}
                        className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        {isSummarizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        <span>AI Summarize & Study</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative min-h-36 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 overflow-hidden">
                  {isTranscribing ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/75 dark:bg-zinc-900/75 gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                      <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Transcribing voice file to text using gemini-2.0-flash...</span>
                    </div>
                  ) : null}

                  {transcriptionText ? (
                    <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
                      {transcriptionText}
                    </p>
                  ) : (
                    <p className="text-sm text-zinc-400 italic flex items-center justify-center h-28">
                      No transcription content yet. Start recording to dictate.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Image Generator */}
          {activeTab === 'image' && (
            <ImageGenerator />
          )}

          {/* TAB 3: Live Voice Buddy */}
          {activeTab === 'image' && (
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-4">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                <Info className="w-4 h-4 text-zinc-500" />
                Diagram Generator
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Create high-quality diagrams, edit existing images, or visualize concepts using <strong className="text-indigo-600 dark:text-indigo-400">Gemini Image Generation</strong>.
              </p>
            </div>
          )}
          {activeTab === 'voice' && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 space-y-6">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Live Voice Buddy (Real-Time API)</h2>
              
              <div className="flex flex-col items-center justify-center min-h-[300px] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 bg-zinc-50/50 dark:bg-zinc-900/30 text-center space-y-6">
                
                {/* Real-time pulse animation circle */}
                <div className="relative flex items-center justify-center">
                  {isLiveConnected && liveStatus === 'speaking' && (
                    <span className="absolute inline-flex h-24 w-24 rounded-full bg-emerald-400/30 animate-ping" />
                  )}
                  {isLiveConnected && liveStatus === 'listening' && (
                    <span className="absolute inline-flex h-24 w-24 rounded-full bg-indigo-400/20 animate-ping" />
                  )}

                  <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all ${
                    !isLiveConnected 
                      ? 'bg-zinc-300 dark:bg-zinc-700 text-zinc-500' 
                      : liveStatus === 'speaking'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-indigo-600 text-white'
                  }`}>
                    <Mic className="w-10 h-10" />
                  </div>
                </div>

                <div className="max-w-md">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    liveStatus === 'idle'
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      : liveStatus === 'connecting'
                        ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 animate-pulse'
                        : liveStatus === 'speaking'
                          ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 animate-pulse'
                          : liveStatus === 'error'
                            ? 'bg-red-100 dark:bg-red-950/50 text-red-600'
                            : 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 animate-pulse'
                  }`}>
                    {liveStatus === 'idle' && 'Offline'}
                    {liveStatus === 'connecting' && 'Connecting...'}
                    {liveStatus === 'listening' && 'Listening (Speak now)'}
                    {liveStatus === 'speaking' && 'Tutor is Speaking...'}
                    {liveStatus === 'error' && 'Error'}
                  </span>

                  {liveErrorMsg && (
                    <div className="mt-3 bg-red-50 dark:bg-red-950/30 p-3 rounded-xl border border-red-200 dark:border-red-800 flex items-center gap-2 text-left">
                      <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                      <p className="text-xs font-semibold text-red-600 leading-tight">
                        {liveErrorMsg}
                      </p>
                    </div>
                  )}

                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mt-4 leading-relaxed">
                    {!isLiveConnected 
                      ? 'Start a real-time hands-free voice lesson with Gemini!' 
                      : liveStatus === 'listening' 
                        ? 'Connected. Go ahead, ask me anything verbally!' 
                        : 'Listening to response streams...'
                    }
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {!isLiveConnected ? (
                    <button
                      onClick={startLiveVoiceSession}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-colors"
                    >
                      <Play className="w-4 h-4" /> Connect Voice Session
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={toggleLiveMute}
                        className={`px-4 py-3 rounded-xl font-semibold flex items-center gap-2 shadow-sm border transition-colors ${
                          isLiveMuted
                            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 text-amber-700 dark:text-amber-400 hover:bg-amber-100'
                            : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200'
                        }`}
                      >
                        {isLiveMuted ? (
                          <>
                            <VolumeX className="w-4 h-4" /> Mic Muted
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-4 h-4" /> Mic On
                          </>
                        )}
                      </button>
                      <button
                        onClick={cleanupLiveVoice}
                        className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-colors"
                      >
                        <Square className="w-4 h-4" /> Stop Voice Session
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
