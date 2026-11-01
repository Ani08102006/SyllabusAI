import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import UploadSyllabus from './pages/UploadSyllabus';
import MySyllabus from './pages/MySyllabus';
import Notes from './pages/Notes';
import QuestionPapers from './pages/QuestionPapers';
import Revision from './pages/Revision';
import AIChatTutor from './pages/AIChatTutor';
import AssignmentGenerator from './pages/AssignmentGenerator';

export default function App() {
  return (
    <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="upload" element={<UploadSyllabus />} />
            <Route path="my-syllabus" element={<MySyllabus />} />
            <Route path="notes" element={<Notes />} />
            <Route path="questions" element={<QuestionPapers />} />
            <Route path="revision" element={<Revision />} />
            <Route path="chat" element={<AIChatTutor />} />
            <Route path="assignments" element={<AssignmentGenerator />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    );
}
