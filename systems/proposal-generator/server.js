const express = require('express');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const db = new Database('proposals.db');

app.use(express.json());
app.use(express.static('public'));

db.exec(`
  CREATE TABLE IF NOT EXISTS proposals (
    id TEXT PRIMARY KEY,
    client TEXT,
    service TEXT,
    budget REAL,
    timeline INTEGER,
    company TEXT,
    deliverables TEXT,
    content TEXT,
    status TEXT DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const services = {
  web: { name: 'Website Development', items: ['Custom website design', 'Responsive development', 'SEO optimization', '3 months support'] },
  marketing: { name: 'Digital Marketing', items: ['SEO audit & strategy', 'Content calendar (12 posts)', 'Monthly reporting', 'Social media management'] },
  branding: { name: 'Branding & Design', items: ['Logo design (3 concepts)', 'Brand guidelines', 'Business card design', 'Social media templates'] },
  consulting: { name: 'Consulting Services', items: ['Strategy session (4 hrs/month)', 'Implementation roadmap', 'Weekly check-ins', 'Email support'] },
  app: { name: 'App Development', items: ['Native iOS & Android', 'UI/UX design', 'Backend development', 'App store submission'] },
  seo: { name: 'SEO Services', items: ['Technical SEO audit', 'Keyword research (50 terms)', 'On-page optimization', 'Monthly reporting'] }
};

function generateProposal(data) {
  const svc = services[data.service] || services.web;
  const deposit = Math.round(data.budget * 0.5);
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const endDate = new Date(Date.now() + (data.timeline || 8) * 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const deliverables = data.deliverables ? data.deliverables.split('\n').filter(d => d.trim()) : svc.items;

  return {
    client: data.client,
    service: svc.name,
    budget: data.budget,
    timeline: data.timeline,
    company: data.company,
    date: today,
    endDate,
    deposit,
    balance: data.budget - deposit,
    deliverables,
    items: svc.items
  };
}

app.get('/api/services', (req, res) => res.json(services));
app.get('/api/proposals', (req, res) => res.json(db.prepare('SELECT * FROM proposals ORDER BY created_at DESC').all()));
app.get('/api/proposals/:id', (req, res) => res.json(db.prepare('SELECT * FROM proposals WHERE id = ?').get(req.params.id)));
app.post('/api/proposals', (req, res) => {
  const data = req.body;
  const proposal = generateProposal(data);
  const id = uuidv4();
  db.prepare('INSERT INTO proposals (id, client, service, budget, timeline, company, deliverables, content, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, data.client, data.service, data.budget, data.timeline, data.company, data.deliverables, JSON.stringify(proposal), 'draft');
  res.json({ id, ...proposal });
});
app.put('/api/proposals/:id', (req, res) => {
  db.prepare('UPDATE proposals SET status = ? WHERE id = ?').run('sent', req.params.id);
  res.json({ success: true });
});
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => console.log(`Proposal Generator running on http://localhost:${PORT}`));
