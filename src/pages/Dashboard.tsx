import { logSearch } from '../lib/analytics';
import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/apiFetch';


import { 
  BookOpen, 
  FileText, 
  HelpCircle, 
  PenTool, 
  CheckSquare, 
  RefreshCw, 
  Sparkles, 
  Check, 
  Trash2, 
  Plus, 
  Calendar, 
  ListTodo, 
  Loader2,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { getCollection, addDoc, updateDoc, deleteDoc, queryDocs } from '../lib/localDb';
import { Link } from 'react-router-dom';





export default function Dashboard() {
    const [subjects, setSubjects] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'today' | 'all'>('today');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [addingTask, setAddingTask] = useState(false);

  // Google Calendar States
  const [calendarToken, setCalendarToken] = useState<string | null>(null);
  const [syncingTaskId, setSyncingTaskId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [tasksToSync, setTasksToSync] = useState<any[]>([]);
  const [bulkSyncResult, setBulkSyncResult] = useState<{ success: number; failed: number } | null>(null);

  const getLocalDateString = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const todayStr = getLocalDateString();

  
  const refetchTasks = () => {
    const ts = queryDocs('study_tasks', 'ownerUid', "local-user");
    ts.sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
    setTasks(ts);
  };

  useEffect(() => {
    
    setSubjects(queryDocs('subjects', 'ownerUid', "local-user"));
    setUnits(queryDocs('units', 'ownerUid', "local-user"));
    refetchTasks();
  }, []);


  const handleToggleTask = async (taskId: string, currentCompleted: boolean) => {
    const tasksPath = `study_tasks/${taskId}`;
    try {
      updateDoc("study_tasks", taskId, {
        completed: !currentCompleted
      });
      refetchTasks();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const tasksPath = `study_tasks/${taskId}`;
    try {
      deleteDoc("study_tasks", taskId); refetchTasks();
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddCustomTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || false) return;

    setAddingTask(true);
    const tasksPath = 'study_tasks';
    try {
      const matchedSub = subjects.find(s => s.id === selectedSubjectId);
      addDoc("study_tasks", {
        ownerUid: "local-user",
        userId: "local-user",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        title: newTaskTitle.trim(),
        subjectId: selectedSubjectId || '',
        subjectName: matchedSub ? matchedSub.name : 'Custom Goal',
        date: todayStr,
        completed: false
      });
      setNewTaskTitle('');
      setSelectedSubjectId('');
    } catch (error) {
      console.error(error);
    } finally {
      setAddingTask(false);
    }
  };

  const handleGenerateSchedule = async () => {
    if (subjects.length === 0 || false) return;
    setGenerating(true);
    try {
      const subjectsWithUnits = subjects.map(sub => {
        const subUnits = units.filter(un => un.subjectId === sub.id);
        return {
          name: sub.name,
          units: subUnits.map(un => ({
            name: un.name,
            topics: un.topics
          }))
        };
      });

      const response = await apiFetch('/api/ai/generate-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjects: subjectsWithUnits })
      }, "local-user", 'Dashboard');

      if (!response.ok) {
        throw new Error('Failed to generate study schedule from server.');
      }

      const data = await response.json();
      if (data.tasks && Array.isArray(data.tasks)) {
        const addPromises = data.tasks.map((t: any) => {
          const taskDate = new Date();
          taskDate.setDate(taskDate.getDate() + (t.dayOffset || 0));
          const dateStr = getLocalDateString(taskDate);
          
          const subMatch = subjects.find(s => s.name.toLowerCase() === t.subjectName.toLowerCase()) || subjects[0];

          return addDoc("study_tasks", {
            ownerUid: "local-user",
        userId: "local-user",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
            subjectId: subMatch ? subMatch.id : '',
            subjectName: t.subjectName || 'General',
            title: t.title,
            date: dateStr,
            completed: false
      });
        });

        await Promise.all(addPromises);
      }
    } catch (error) {
      console.error('Error generating schedule:', error);
      alert('Failed to generate study schedule. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // Helper to safely format end date (exclusive in Google Calendar all-day events)
  const getNextDayDateString = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    d.setDate(d.getDate() + 1);
    
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const r = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${r}`;
  };

  // Helper to authenticate/fetch Google Calendar token
  const getGoogleCalendarToken = async (): Promise<string> => {
    setCalendarError('Google Calendar integration requires a configured OAuth backend. It is disabled in the open source version.');
    throw new Error('Google Calendar integration is disabled.');
  };

  // Create an event in Google Calendar
  const createGoogleCalendarEvent = async (task: any, token: string) => {
    const nextDay = getNextDayDateString(task.date);
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary: `📚 StudyForge: ${task.subjectName} - ${task.title}`,
        description: `Target Study Goal generated by StudyForge AI.\nSubject: ${task.subjectName}\nStatus: ${task.completed ? 'Completed' : 'Pending'}`,
        start: {
          date: task.date
        },
        end: {
          date: nextDay
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 30 }
          ]
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google API Error: ${errText}`);
    }

    const data = await response.json();
    return data.id;
  };

  // Sync a single task
  const handleSyncSingleTask = async (task: any) => {
    const confirmed = window.confirm(`Export "${task.title}" to your personal Google Calendar?`);
    if (!confirmed) return;

    setSyncingTaskId(task.id);
    setCalendarError(null);
    try {
      const token = await getGoogleCalendarToken();
      const eventId = await createGoogleCalendarEvent(task, token);
      
      updateDoc("study_tasks", task.id, {
        syncedToCalendar: true,
        googleEventId: eventId
      });
      refetchTasks();
    } catch (error: any) {
      console.error('Error syncing task:', error);
      setCalendarError(error.message || 'Failed to sync task with Google Calendar.');
    } finally {
      setSyncingTaskId(null);
    }
  };

  // Sync all unsynced tasks with a custom confirmation dialog
  const triggerBulkSync = () => {
    const unsynced = tasks.filter(t => !t.syncedToCalendar);
    if (unsynced.length === 0) {
      alert('All of your tasks are already synced to Google Calendar!');
      return;
    }
    setTasksToSync(unsynced);
    setShowConfirmModal(true);
    setBulkSyncResult(null);
  };

  const handleBulkSyncConfirm = async () => {
    setShowConfirmModal(false);
    setSyncingAll(true);
    setCalendarError(null);
    setBulkSyncResult(null);
    
    try {
      const token = await getGoogleCalendarToken();
      let successCount = 0;
      let failedCount = 0;

      for (const task of tasksToSync) {
        try {
          const eventId = await createGoogleCalendarEvent(task, token);
          updateDoc("study_tasks", task.id, {
            syncedToCalendar: true,
            googleEventId: eventId
          });
      refetchTasks();
          successCount++;
        } catch (err) {
          console.error(`Failed to sync task: ${task.title}`, err);
          failedCount++;
        }
      }

      setBulkSyncResult({ success: successCount, failed: failedCount });
    } catch (error: any) {
      console.error('Bulk sync failed:', error);
      setCalendarError(error.message || 'Failed to complete bulk sync.');
    } finally {
      setSyncingAll(false);
    }
  };

  const handleDisconnectCalendar = () => {
    setCalendarToken(null);
    setCalendarError(null);
    setBulkSyncResult(null);
  };

  const todayTasks = tasks.filter(t => t.date === todayStr);
  const completedToday = todayTasks.filter(t => t.completed).length;
  const totalToday = todayTasks.length;
  const todayProgress = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  const stats = [
    { name: 'Subjects', value: subjects.length, icon: BookOpen, color: 'bg-blue-500' },
    { name: 'Notes Generated', value: 12, icon: FileText, color: 'bg-emerald-500' },
    { name: 'Practice Papers', value: 4, icon: HelpCircle, color: 'bg-purple-500' },
    { name: 'Assignments', value: 2, icon: PenTool, color: 'bg-orange-500' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Welcome back, Student!
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Here's an overview of your academic progress and daily study goals.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 flex items-center gap-4 transition-colors">
            <div className={`p-3 rounded-xl text-white ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{stat.name}</p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid: Subjects list + Quick Tasks sidebar widget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Area: Subjects List */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 p-6 transition-colors">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Your Subjects</h2>
              <Link
                to="/upload"
                className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
              >
                + Add Syllabus
              </Link>
            </div>

            {subjects.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="mx-auto h-12 w-12 text-zinc-300 dark:text-zinc-700" />
                <h3 className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">No subjects</h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Get started by uploading your syllabus.</p>
                <div className="mt-6">
                  <Link
                    to="/upload"
                    className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    Upload Syllabus
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {subjects.map((subject) => (
                  <div key={subject.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-indigo-300 dark:hover:border-indigo-800/80 transition-colors bg-white dark:bg-zinc-900/50">
                    <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">{subject.name}</h3>
                    {subject.marksDistribution && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 truncate">Marks: {subject.marksDistribution}</p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link to={`/notes?subject=${subject.id}`} className="text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2.5 py-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Notes</Link>
                      <Link to={`/questions?subject=${subject.id}`} className="text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2.5 py-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Questions</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Area: Quick Tasks Sidebar Widget */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col h-full transition-colors">
            {/* Widget Header */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-indigo-500" />
                Quick Tasks
              </h2>
              {tasks.length > 0 && (
                <button
                  onClick={handleGenerateSchedule}
                  disabled={generating || subjects.length === 0}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1 disabled:opacity-50"
                  title="Regenerate schedule using AI"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                  Reset Plan
                </button>
              )}
            </div>

            {/* Progress Bar */}
            {totalToday > 0 && (
              <div className="mb-6 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <div className="flex justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                  <span>Today's Progress</span>
                  <span>{completedToday}/{totalToday} Tasks ({todayProgress}%)</span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 dark:bg-indigo-500 h-full transition-all duration-300"
                    style={{ width: `${todayProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Google Calendar Sync Control Panel */}
            {tasks.length > 0 && (
              <div className="mb-6 bg-blue-50/40 dark:bg-blue-950/10 p-4 rounded-xl border border-blue-100/50 dark:border-blue-900/30">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-blue-600 dark:text-blue-400 fill-current" xmlns="http://www.w3.org/2000/svg">
                      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm-5-8h-2v2h2v-2zm-4 0H8v2h2v-2zm4 4h-2v2h2v-2zm-4 0H8v2h2v-2z"/>
                    </svg>
                    Google Calendar Sync
                  </span>
                  {calendarToken ? (
                    <button
                      onClick={handleDisconnectCalendar}
                      className="text-[10px] text-zinc-500 hover:text-red-600 underline font-medium transition-colors"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <span className="text-[10px] text-zinc-500 font-medium">Not Connected</span>
                  )}
                </div>

                {calendarToken ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                      <span>Sync status:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Connected
                      </span>
                    </div>
                    
                    <button
                      onClick={triggerBulkSync}
                      disabled={syncingAll || tasks.filter(t => !t.syncedToCalendar).length === 0}
                      className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-zinc-100 dark:disabled:bg-zinc-800/40 disabled:text-zinc-400 disabled:border-zinc-200 dark:disabled:border-zinc-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    >
                      {syncingAll ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Syncing tasks...
                        </>
                      ) : (
                        <>
                          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/>
                          </svg>
                          Sync All Unsynced ({tasks.filter(t => !t.syncedToCalendar).length})
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
                      Export your custom generated study schedule directly to your Google Calendar to receive notifications and stay on track.
                    </p>
                    <button
                      onClick={getGoogleCalendarToken}
                      className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    >
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm-5-8h-2v2h2v-2zm-4 0H8v2h2v-2zm4 4h-2v2h2v-2zm-4 0H8v2h2v-2z"/>
                      </svg>
                      Authorize Google Calendar
                    </button>
                  </div>
                )}

                {/* Bulk Sync Feedback */}
                {bulkSyncResult && (
                  <div className="mt-2.5 p-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-lg text-[11px] text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Sync complete! <strong>{bulkSyncResult.success}</strong> synced successfully{bulkSyncResult.failed > 0 && `, ${bulkSyncResult.failed} failed`}.
                    </span>
                  </div>
                )}

                {/* Calendar Error Message */}
                {calendarError && (
                  <div className="mt-2.5 p-2 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-lg text-[11px] text-red-800 dark:text-red-400 flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{calendarError}</span>
                  </div>
                )}
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-zinc-100 dark:border-zinc-800 mb-4">
              <button
                onClick={() => setActiveTab('today')}
                className={`flex-1 pb-2 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'today'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
              >
                Today ({todayTasks.length})
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`flex-1 pb-2 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'all'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
              >
                All ({tasks.length})
              </button>
            </div>

            {/* Tasks List */}
            <div className="flex-1 overflow-y-auto space-y-3 max-h-[350px] pr-1">
              {generating ? (
                <div className="py-12 text-center text-zinc-500 dark:text-zinc-400 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <p className="text-sm font-medium">Creating your custom study schedule...</p>
                </div>
              ) : (activeTab === 'today' ? todayTasks : tasks).length === 0 ? (
                <div className="py-12 text-center">
                  <ListTodo className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">No tasks found</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    {activeTab === 'today' 
                      ? "You've completed all tasks or none are scheduled for today."
                      : "Create a study schedule using AI or add a custom task below!"}
                  </p>
                  
                  {tasks.length === 0 && subjects.length > 0 && (
                    <button
                      onClick={handleGenerateSchedule}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 text-xs font-semibold shadow-sm transition-all"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Generate Study Schedule
                    </button>
                  )}
                  {subjects.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 bg-amber-50 dark:bg-amber-950/20 p-2.5 rounded-xl border border-amber-100/50 dark:border-amber-900/30">
                      Upload your syllabus first to unlock AI study schedule generation!
                    </p>
                  )}
                </div>
              ) : (
                (activeTab === 'today' ? todayTasks : tasks).map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-start justify-between p-3 rounded-xl border transition-all ${
                      task.completed
                        ? 'bg-zinc-50/50 dark:bg-zinc-800/10 border-zinc-100 dark:border-zinc-800/50 opacity-60'
                        : 'bg-white dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/80 hover:border-zinc-300 dark:hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <button
                        onClick={() => handleToggleTask(task.id, task.completed)}
                        className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                          task.completed
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-zinc-300 dark:border-zinc-600 hover:border-indigo-500 dark:hover:border-indigo-400'
                        }`}
                      >
                        {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium leading-tight text-zinc-900 dark:text-zinc-100 ${task.completed ? 'line-through text-zinc-400 dark:text-zinc-500' : ''}`}>
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30">
                            {task.subjectName}
                          </span>
                          {activeTab === 'all' && (
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {task.date === todayStr ? 'Today' : task.date}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      {task.syncedToCalendar ? (
                        <span 
                          className="text-emerald-600 dark:text-emerald-400 p-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/10 text-[10px] font-semibold flex items-center gap-0.5"
                          title="Synced with Google Calendar"
                        >
                          <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current text-emerald-500" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm-5-8h-2v2h2v-2zm-4 0H8v2h2v-2zm4 4h-2v2h2v-2zm-4 0H8v2h2v-2z"/>
                          </svg>
                          Synced
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSyncSingleTask(task)}
                          disabled={syncingTaskId === task.id || syncingAll}
                          className="text-zinc-400 hover:text-blue-500 dark:text-zinc-500 dark:hover:text-blue-400 p-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                          title="Export to Google Calendar"
                        >
                          {syncingTaskId === task.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                              <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm-5-8h-2v2h2v-2zm-4 0H8v2h2v-2zm4 4h-2v2h2v-2zm-4 0H8v2h2v-2z"/>
                            </svg>
                          )}
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-zinc-400 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors shrink-0"
                        title="Delete Task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add Custom Task Form */}
            <form onSubmit={handleAddCustomTask} className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2 shrink-0">
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  placeholder="Add a daily goal..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  disabled={addingTask}
                  className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm py-2 px-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                />
                <button
                  type="submit"
                  disabled={addingTask || !newTaskTitle.trim()}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white p-2 text-sm font-semibold shadow-sm transition-all disabled:opacity-40"
                >
                  {addingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>

              {subjects.length > 0 && (
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 py-1.5 px-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                >
                  <option value="">No subject (Custom Goal)</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </form>

          </div>
        </div>
      </div>

      {/* Google Calendar Bulk Sync Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" id="bulk-sync-modal">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 transition-opacity bg-zinc-900/60 backdrop-blur-sm" 
              onClick={() => setShowConfirmModal(false)}
            />

            {/* Modal Box */}
            <div className="inline-block align-bottom bg-white dark:bg-zinc-900 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-zinc-100 dark:border-zinc-800">
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 sm:mx-0 sm:h-10 sm:w-10">
                    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current" xmlns="http://www.w3.org/2000/svg">
                      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm-5-8h-2v2h2v-2zm-4 0H8v2h2v-2zm4 4h-2v2h2v-2zm-4 0H8v2h2v-2z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                      Sync Study Schedule to Google Calendar?
                    </h3>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      This will export <strong>{tasksToSync.length}</strong> study task(s) directly to your personal Google Calendar as all-day events.
                    </p>
                    
                    {/* List of Tasks to be Sync'd */}
                    <div className="mt-4 max-h-32 overflow-y-auto space-y-1.5 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
                      {tasksToSync.map(t => (
                        <div key={t.id} className="flex justify-between items-center py-0.5 border-b border-zinc-100 dark:border-zinc-800/50 last:border-0 pb-1 last:pb-0">
                          <span className="truncate font-medium pr-2 text-zinc-800 dark:text-zinc-300">{t.title}</span>
                          <span className="text-[10px] shrink-0 font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 px-1.5 py-0.5 rounded-md">{t.subjectName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800/20 px-6 py-4 flex flex-row-reverse gap-3 border-t border-zinc-100 dark:border-zinc-800/40">
                <button
                  type="button"
                  onClick={handleBulkSyncConfirm}
                  className="inline-flex justify-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all"
                >
                  Confirm Sync
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="inline-flex justify-center px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
