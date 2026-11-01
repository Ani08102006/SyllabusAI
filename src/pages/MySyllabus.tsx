
import { useState, useEffect } from 'react';


import { FileText, Search, Trash2, Calendar, File, RefreshCw, Download, Filter, FileSpreadsheet, FileImage, CheckCircle2 } from 'lucide-react';
import { getCollection, addDoc, updateDoc, deleteDoc, queryDocs } from '../lib/localDb';
import { Link } from 'react-router-dom';

interface UploadRecord {
  id: string;
  originalFileName: string;
  fileType: string;
  fileSize: number;
  uploadDate: string;
  status: string;
  detectedSubjects: string[];
}

export default function MySyllabus() {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<string | null>(null);
  
  useEffect(() => {
    const data = queryDocs('uploads', 'ownerUid', "local-user");
    data.sort((a: any, b: any) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    setUploads(data);
    setLoading(false);
  }, []);

  const handleDelete = (id: string) => {
    try {
      setErrorState(null);
      // 1. Find the upload record to get the subjects name/details
      const uploadRecord = uploads.find(u => u.id === id);
      if (uploadRecord) {
        // 2. Query all subjects with this uploadId
        const subjects = queryDocs("subjects", "uploadId", id);
        
        // 3. Cascade delete subjects, units, and related study tasks
        for (const subject of subjects) {
          // Delete units for this subject
          const units = queryDocs("units", "subjectId", subject.id);
          for (const unit of units) {
            deleteDoc("units", unit.id);
          }
          
          // Delete study tasks associated with this subject name
          const tasks = queryDocs("study_tasks", "subjectName", subject.name);
          for (const task of tasks) {
            deleteDoc("study_tasks", task.id);
          }
          
          // Delete the subject
          deleteDoc("subjects", subject.id);
        }
      }

      // 4. Delete the upload record itself
      deleteDoc("uploads", id);

      // 5. Update state
      setUploads(queryDocs("uploads", "ownerUid", "local-user"));
    } catch (error) {
      console.error('Error deleting upload:', error);
      setErrorState('Failed to delete syllabus cascade.');
    }
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="w-8 h-8 text-red-500" />;
    if (type.includes('image')) return <FileImage className="w-8 h-8 text-blue-500" />;
    if (type.includes('sheet') || type.includes('csv')) return <FileSpreadsheet className="w-8 h-8 text-emerald-500" />;
    return <File className="w-8 h-8 text-indigo-500" />;
  };

  const filteredUploads = uploads.filter(u => 
    u.originalFileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.detectedSubjects.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 sm:p-0">
      {errorState && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 flex justify-between items-center animate-in fade-in duration-200">
          <span>{errorState}</span>
          <button onClick={() => setErrorState(null)} className="text-red-600 hover:text-red-800 font-bold text-xs bg-red-100 hover:bg-red-200 px-2.5 py-1 rounded-lg transition-colors">Close</button>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">My Syllabus</h1>
          <p className="mt-2 text-zinc-600">View and manage your uploaded syllabi and documents.</p>
        </div>
        <Link 
          to="/upload" 
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          Upload New
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-zinc-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-zinc-50/50">
          <div className="relative w-full sm:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-zinc-400" />
            </div>
            <input
              type="text"
              placeholder="Search by filename or subject..."
              className="block w-full rounded-xl border-0 py-2.5 pl-10 pr-4 text-zinc-900 ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-xl hover:bg-zinc-50 w-full sm:w-auto justify-center">
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-zinc-500">Loading uploads...</div>
        ) : filteredUploads.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-zinc-400" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 mb-1">No uploads found</h3>
            <p className="text-zinc-500 max-w-sm mb-6">You haven't uploaded any syllabus documents yet, or none match your search.</p>
            <Link to="/upload" className="text-indigo-600 font-medium hover:text-indigo-700">Upload your first syllabus &rarr;</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="bg-zinc-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-zinc-900 sm:pl-6">File</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-900">Subjects Detected</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-900">Upload Date</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-zinc-900">Status</th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {filteredUploads.map((upload) => (
                  <tr key={upload.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 sm:pl-6">
                      <div className="flex items-center gap-4">
                        {getFileIcon(upload.fileType)}
                        <div>
                          <div className="font-medium text-zinc-900">{upload.originalFileName}</div>
                          <div className="text-xs text-zinc-500">{(upload.fileSize / 1024).toFixed(1)} KB &bull; {upload.fileType.split('/')[1] || 'Document'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-3">
                      <div className="flex flex-wrap gap-1">
                        {upload.detectedSubjects.length > 0 ? (
                          upload.detectedSubjects.map((sub, i) => (
                            <span key={i} className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                              {sub}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-zinc-500">-</span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {new Date(upload.uploadDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${
                        upload.status === 'Processed' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20' :
                        upload.status === 'Failed' ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10' :
                        'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20'
                      }`}>
                        {upload.status === 'Processed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {upload.status === 'Processing' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        {upload.status}
                      </span>
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => setDeleteId(upload.id)} className="text-zinc-400 hover:text-red-600 transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-zinc-200 space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-red-100 rounded-full text-red-600 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Delete Syllabus?</h3>
                <p className="text-sm text-zinc-500 mt-1">
                  Are you sure you want to delete <span className="font-semibold text-zinc-800">"{uploads.find(u => u.id === deleteId)?.originalFileName}"</span>?
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-800 space-y-2">
              <p className="font-bold">This will permanently delete:</p>
              <ul className="list-disc pl-4 space-y-1 opacity-90">
                <li>Syllabus upload record</li>
                <li>All related subjects ({uploads.find(u => u.id === deleteId)?.detectedSubjects.join(', ') || 'None'})</li>
                <li>All associated units, topics, and chapters</li>
                <li>All scheduled study and revision tasks</li>
              </ul>
              <p className="font-semibold mt-2 text-red-700">This action is irreversible.</p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 border border-zinc-300 rounded-xl text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteId) {
                    handleDelete(deleteId);
                    setDeleteId(null);
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
              >
                Delete Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
