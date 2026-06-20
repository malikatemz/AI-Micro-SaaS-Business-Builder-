const express = require('express');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const db = new Database('meetings.db');

app.use(express.json());
app.use(express.static('public'));

db.exec(`
  CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    title TEXT,
    transcript TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS actions (
    id TEXT PRIMARY KEY,
    meeting_id TEXT,
    task TEXT NOT NULL,
    owner TEXT,
    deadline TEXT,
    priority TEXT DEFAULT 'Medium',
    completed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

function extractActions(transcript) {
  const owners = ['Sarah', 'John', 'Mike', 'Alex', 'Emma', 'David', 'Lisa', 'Tom'];
  const lines = transcript.split('\n').filter(l => l.trim());
  return lines.map(line => {
    const clean = line.replace(/^[^:]+:\s*/, '').trim();
    const owner = owners.find(o => line.toLowerCase().includes(o.toLowerCase())) || 'Unassigned';
    const dateMatch = clean.match(/(january|february|march|april|may|june|july|august|september|october|november|december|next week|q[1-4]|friday|monday)/i);
    const priority = clean.match(/\b(urgent|asap|immediately|important|critical|bug)\b/i) ? 'High' : 'Low';
    return { id: uuidv4(), task: clean, owner, deadline: dateMatch ? dateMatch[0] : 'Not set', priority };
  });
}

app.get('/api/meetings', (req, res) => res.json(db.prepare('SELECT * FROM meetings ORDER BY created_at DESC').all()));
app.get('/api/meetings/:id', (req, res) => {
  const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(req.params.id);
  const actions = db.prepare('SELECT * FROM actions WHERE meeting_id = ?').all(req.params.id);
  res.json({ ...meeting, actions });
});
app.post('/api/meetings', (req, res) => {
  const { title, transcript } = req.body;
  const meetingId = uuidv4();
  db.prepare('INSERT INTO meetings (id, title, transcript) VALUES (?, ?, ?)').run(meetingId, title, transcript);
  extractActions(transcript).forEach(a => db.prepare('INSERT INTO actions VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)').run(a.id, meetingId, a.task, a.owner, a.deadline, a.priority));
  res.json({ id: meetingId, title, actions: extractActions(transcript) });
});
app.put('/api/actions/:id', (req, res) => { db.prepare('UPDATE actions SET completed = ? WHERE id = ?').run(req.body.completed ? 1 : 0, req.params.id); res.json({ success: true }); });
app.delete('/api/meetings/:id', (req, res) => { db.prepare('DELETE FROM actions WHERE meeting_id = ?').run(req.params.id); db.prepare('DELETE FROM meetings WHERE id = ?').run(req.params.id); res.json({ success: true }); });
app.get('/api/stats', (req, res) => { const t = db.prepare('SELECT COUNT(*) as c FROM actions').get().c; const c = db.prepare('SELECT COUNT(*) as c FROM actions WHERE completed=1').get().c; res.json({ totalActions: t, completed: c }); });

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
const PORT = process.env.PORT || 3003;
app.listen(PORT, () => console.log(`Meeting Notes running on http://localhost:${PORT}`));
