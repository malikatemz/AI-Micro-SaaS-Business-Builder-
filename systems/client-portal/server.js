const express = require('express');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const db = new Database('portals.db');

app.use(express.json());
app.use(express.static('public'));

db.exec(`
  CREATE TABLE IF NOT EXISTS portals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    domain TEXT,
    features TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    portal_id TEXT,
    name TEXT,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

app.get('/api/portals', (req, res) => res.json(db.prepare('SELECT * FROM portals ORDER BY created_at DESC').all()));
app.get('/api/portals/:id', (req, res) => {
  const portal = db.prepare('SELECT * FROM portals WHERE id = ?').get(req.params.id);
  const clients = db.prepare('SELECT * FROM clients WHERE portal_id = ?').all(req.params.id);
  res.json({ ...portal, features: JSON.parse(portal.features || '{}'), clients });
});
app.post('/api/portals', (req, res) => {
  const { name, color, domain, features } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO portals (id, name, color, domain, features) VALUES (?, ?, ?, ?, ?)').run(id, name, color, domain, JSON.stringify(features));
  res.json(db.prepare('SELECT * FROM portals WHERE id = ?').get(id));
});
app.post('/api/portals/:id/clients', (req, res) => {
  const { name, email } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO clients (id, portal_id, name, email) VALUES (?, ?, ?, ?)').run(id, req.params.id, name, email);
  res.json({ id, portal_id: req.params.id, name, email });
});
app.get('/api/stats', (req, res) => {
  const portals = db.prepare('SELECT COUNT(*) as c FROM portals').get().c;
  const clients = db.prepare('SELECT COUNT(*) as c FROM clients').get().c;
  res.json({ totalPortals: portals, totalClients: clients });
});
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
const PORT = process.env.PORT || 3005;
app.listen(PORT, () => console.log(`Client Portal running on http://localhost:${PORT}`));
