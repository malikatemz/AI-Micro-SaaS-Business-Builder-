const express = require('express');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const db = new Database('payments.db');

app.use(express.json());
app.use(express.static('public'));

db.exec(`
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT,
    plan TEXT,
    amount REAL,
    attempt INTEGER,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    payment_id TEXT,
    stage INTEGER,
    sent_at DATETIME,
    content TEXT
  );
`);

const templates = {
  1: { subject: "We noticed your payment didn't go through 💳", header: 'First Attempt', recovery: 40, body: (d) => `Hi ${d.name},\n\nWe tried to charge your card for ${d.plan} (${d.amount}) but the payment failed.\n\nThis can happen due to insufficient funds, expired card, or bank holds.\n\nPlease update your payment method:\n\n[Update Payment Method]\n\nYour account will not be interrupted for 5 days.\n\nNeed help? Just reply to this email.\n\nThe Team` },
  2: { subject: "⚠️ Action Required: Payment failed again", header: 'Second Attempt', recovery: 15, body: (d) => `Hi ${d.name},\n\nWe tried again to process your ${d.plan} payment, but it still failed.\n\nYour account is now at risk of service interruption.\n\n[Update Payment Now]\n\nIf not received within 3 days, your subscription will be paused.\n\nThe Team` },
  3: { subject: "🚨 Final Warning: Account will be suspended", header: 'Final Attempt', recovery: 5, body: (d) => `Hi ${d.name},\n\nThis is your FINAL notice.\n\nWe've tried multiple times to collect your ${d.plan} payment without success.\n\n[SAVE MY ACCOUNT - Update Payment]\n\nAccount will be suspended in 24 hours.\n\nYou will lose: data, premium features, support.\n\nThe Team` }
};

const plans = { starter: '$29/mo', pro: '$79/mo', business: '$149/mo', enterprise: '$299/mo' };

app.get('/api/payments', (req, res) => res.json(db.prepare('SELECT * FROM payments ORDER BY created_at DESC').all()));
app.get('/api/payments/:id', (req, res) => res.json(db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id)));
app.post('/api/payments', (req, res) => {
  const { email, name, plan, attempt, reason } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO payments (id, email, name, plan, amount, attempt, reason) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, email, name, plan, plans[plan] || '$0', attempt || 1, reason || 'unknown');
  res.json(db.prepare('SELECT * FROM payments WHERE id = ?').get(id));
});
app.post('/api/payments/:id/send', (req, res) => {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Not found' });
  const template = templates[payment.attempt] || templates[1];
  const emailId = uuidv4();
  db.prepare('INSERT INTO emails (id, payment_id, stage, sent_at, content) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)').run(emailId, req.params.id, payment.attempt, template.body(payment));
  res.json({ id: emailId, subject: template.subject, body: template.body(payment), recovery: template.recovery });
});
app.get('/api/email-preview', (req, res) => {
  const { attempt, name, plan } = req.query;
  const template = templates[attempt] || templates[1];
  const data = { name: name || 'Customer', plan: plans[plan] || '$29/mo', amount: plans[plan] || '$29/mo' };
  res.json({ subject: template.subject, body: template.body(data), recovery: template.recovery });
});
app.get('/api/stats', (req, res) => {
  const pending = db.prepare('SELECT COUNT(*) as c FROM payments WHERE status="pending"').get().c;
  const sent = db.prepare('SELECT COUNT(*) as c FROM emails').get().c;
  res.json({ pendingPayments: pending, emailsSent: sent, avgRecovery: 85 });
});
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
const PORT = process.env.PORT || 3004;
app.listen(PORT, () => console.log(`Payment Recovery running on http://localhost:${PORT}`));
