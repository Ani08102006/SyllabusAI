const fs = require('fs');
const glob = require('glob'); // Note: we might not have glob, but we can use child_process or just find

const files = [
  'src/pages/Notes.tsx',
  'src/pages/QuestionPapers.tsx',
  'src/pages/UploadSyllabus.tsx',
  'src/pages/AssignmentGenerator.tsx',
  'src/pages/MySyllabus.tsx',
  'src/pages/Revision.tsx',
  'src/pages/AIChatTutor.tsx',
  'src/pages/Dashboard.tsx',
  'src/components/ImageGenerator.tsx',
  'src/components/Layout.tsx',
  'src/App.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/import \{ useAuth \} from '\.\.?\/?contexts\/AuthContext';?\n?/g, '');
  content = content.replace(/const \{ user \} = useAuth\(\);\n?/g, '');
  content = content.replace(/user\?\.userId/g, '"local-user"');
  content = content.replace(/user\.userId/g, '"local-user"');
  
  if (file === 'src/App.tsx') {
    content = content.replace(/import \{ AuthProvider \} from '\.\/contexts\/AuthContext';\n?/g, '');
    content = content.replace(/<AuthProvider>\s*/g, '');
    content = content.replace(/<\/AuthProvider>\s*/g, '');
  }
  
  fs.writeFileSync(file, content);
}
