const express = require('express');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const db = new Database('jobs.db');

app.use(express.json());
app.use(express.static('public'));

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT,
    company TEXT,
    salary TEXT,
    location TEXT,
    skills TEXT,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const categories = {
  webflow: { icon: '🌊', name: 'Webflow Developers' },
  framer: { icon: '🎨', name: 'Framer Designers' },
  bubble: { icon: '🫧', name: 'No-Code Developers' },
  web3: { icon: '⛓️', name: 'Web3 Engineers' },
  ai: { icon: '🤖', name: 'AI/ML Engineers' },
  react: { icon: '⚛️', name: 'React Developers' },
  node: { icon: '🟢', name: 'Node.js Developers' }
};

app.get('/api/categories', (req, res) => res.json(categories));
app.get('/api/jobs', (req, res) => {
  const jobs = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all();
  res.json(jobs.map(j => ({ ...j, skills: JSON.parse(j.skills || '[]') })));
});
app.get('/api/jobs/:id', (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (job) job.skills = JSON.parse(job.skills || '[]');
  res.json(job || { error: 'Not found' });
});
app.post('/api/jobs', (req, res) => {
  const { title, category, company, salary, location, skills, description } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO jobs (id, title, category, company, salary, location, skills, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, title, category, company, salary, location, JSON.stringify(skills), description);
  res.json({ id, title, category, company, salary, location, skills, description });
});
app.delete('/api/jobs/:id', (req, res) => {
  db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});
app.get('/api/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM jobs').get().c;
  const active = db.prepare("SELECT COUNT(*) as c FROM jobs WHERE status='active'").get().c;
  res.json({ totalJobs: total, activeJobs: active });
});
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3007;
app.listen(PORT, () => console.log(`Job Board running on http://localhost:${PORT}`));
