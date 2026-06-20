const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const db = new Database('invoices.db');

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    client TEXT NOT NULL,
    amount REAL NOT NULL,
    invoice_date TEXT,
    due_date TEXT,
    client_type TEXT,
    stage INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    invoice_id TEXT,
    stage INTEGER,
    sent_at DATETIME,
    email_content TEXT,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
  );
`);

// Email Templates
const emailTemplates = {
  0: {
    subject: 'Friendly Reminder: Invoice Due Today',
    tone: 'friendly',
    body: (invoice) => `Hi ${invoice.client.split(' ')[0]},

This is a friendly reminder that Invoice for $${invoice.amount.toLocaleString()} is due today.

If you've already sent payment, please disregard this message.

[Pay Now Button]

Thank you for your business!`
  },
  7: {
    subject: 'Quick Follow-up: Invoice Payment',
    tone: 'followup',
    body: (invoice) => `Hi ${invoice.client.split(' ')[0]},

Following up on Invoice for $${invoice.amount.toLocaleString()}, now 7 days past due.

[Pay Now Button]

Please let me know if you have any questions.`
  },
  14: {
    subject: '⚠️ Action Required: Invoice Overdue',
    tone: 'firm',
    body: (invoice) => `Hi ${invoice.client.split(' ')[0]},

Invoice for $${invoice.amount.toLocaleString()} is now 14 days overdue.

[Pay Now Button]

If not received within 5 days, services will be paused.`
  },
  30: {
    subject: '🚨 Final Notice: Payment Required',
    tone: 'final',
    body: (invoice) => `Hi ${invoice.client.split(' ')[0]},

FINAL NOTICE: Invoice for $${invoice.amount.toLocaleString()} is 30 days overdue.

[Pay Now Button]

Account will be suspended in 48 hours.`
  }
};

// API Routes
app.get('/api/invoices', (req, res) => {
  const invoices = db.prepare('SELECT * FROM invoices ORDER BY created_at DESC').all();
  res.json(invoices);
});

app.get('/api/invoices/:id', (req, res) => {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  res.json(invoice || { error: 'Invoice not found' });
});

app.post('/api/invoices', (req, res) => {
  const { client, amount, invoiceDate, dueDate, clientType } = req.body;
  const id = uuidv4();
  
  db.prepare(`
    INSERT INTO invoices (id, client, amount, invoice_date, due_date, client_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, client, amount, invoiceDate, dueDate, clientType);
  
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  res.json(invoice);
});

app.put('/api/invoices/:id', (req, res) => {
  const { client, amount, invoiceDate, dueDate, stage } = req.body;
  db.prepare(`
    UPDATE invoices SET client = ?, amount = ?, invoice_date = ?, due_date = ?, stage = ?
    WHERE id = ?
  `).run(client, amount, invoiceDate, dueDate, stage, req.params.id);
  
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  res.json(invoice);
});

app.delete('/api/invoices/:id', (req, res) => {
  db.prepare('DELETE FROM reminders WHERE invoice_id = ?').run(req.params.id);
  db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/invoices/:id/send', (req, res) => {
  const { stage } = req.body;
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  
  const template = emailTemplates[stage] || emailTemplates[0];
  const id = uuidv4();
  
  db.prepare(`
    INSERT INTO reminders (id, invoice_id, stage, sent_at, email_content)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
  `).run(id, req.params.id, stage, template.body(invoice));
  
  db.prepare('UPDATE invoices SET stage = ? WHERE id = ?').run(stage, req.params.id);
  
  res.json({
    id,
    invoice_id: req.params.id,
    stage,
    sent_at: new Date().toISOString(),
    email: {
      to: invoice.client,
      subject: template.subject,
      body: template.body(invoice)
    }
  });
});

app.get('/api/invoices/:id/reminders', (req, res) => {
  const reminders = db.prepare('SELECT * FROM reminders WHERE invoice_id = ? ORDER BY sent_at DESC').all(req.params.id);
  res.json(reminders);
});

app.get('/api/stats', (req, res) => {
  const total = db.prepare('SELECT SUM(amount) as total FROM invoices').get().total || 0;
  const count = db.prepare('SELECT COUNT(*) as count FROM invoices').get().count;
  const sent = db.prepare('SELECT COUNT(*) as count FROM reminders').get().count;
  res.json({ totalOutstanding: total, totalInvoices: count, remindersSent: sent });
});

app.get('/api/email-preview', (req, res) => {
  const { stage, client, amount } = req.query;
  const template = emailTemplates[stage] || emailTemplates[0];
  const fakeInvoice = { client: client || 'Client', amount: parseFloat(amount) || 0 };
  res.json({ subject: template.subject, body: template.body(fakeInvoice) });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Invoice Nudger running on http://localhost:${PORT}`));
