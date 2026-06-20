const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const db = new Database('seo-brief.db');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS briefs (
    id TEXT PRIMARY KEY,
    keyword TEXT NOT NULL,
    industry TEXT NOT NULL,
    word_count INTEGER,
    competitor_url TEXT,
    notes TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS industries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    problems TEXT NOT NULL,
    keywords TEXT NOT NULL
  );
`);

// Seed industries
const industries = [
  { id: 'dentists', name: 'Dentists / Dental Practices', problems: JSON.stringify(['Low patient conversion', 'Insurance confusion', 'Fear of procedures']), keywords: JSON.stringify(['dental implants', 'teeth whitening', 'invisalign', 'dental crowns']) },
  { id: 'lawyers', name: 'Personal Injury Lawyers', problems: JSON.stringify(['Client intake efficiency', 'Case evaluation', 'Referral generation']), keywords: JSON.stringify(['personal injury lawyer', 'car accident attorney', 'workers comp']) },
  { id: 'realestate', name: 'Real Estate Agents', problems: JSON.stringify(['Lead generation', 'Open house attendance', 'Client follow-up']), keywords: JSON.stringify(['sell my house fast', 'real estate agent near me', 'home value']) },
  { id: 'plumbers', name: 'Plumbing Services', problems: JSON.stringify(['Emergency availability', 'Pricing transparency', 'Reviews management']), keywords: JSON.stringify(['plumber near me', 'emergency plumber', 'water heater installation']) },
  { id: 'hvac', name: 'HVAC Companies', problems: JSON.stringify(['Seasonal demand', 'Service agreements', 'AC repair urgency']), keywords: JSON.stringify(['AC repair', 'HVAC maintenance', 'furnace installation']) },
  { id: 'roofers', name: 'Roofing Contractors', problems: JSON.stringify(['Storm damage claims', 'Free estimates', 'Warranty questions']), keywords: JSON.stringify(['roof repair', 'roof replacement', 'shingle roofing']) },
  { id: 'accountants', name: 'Accountants / CPAs', problems: JSON.stringify(['Tax season overwhelm', 'Client retention', 'Service diversification']), keywords: JSON.stringify(['tax preparation', 'accounting services', 'bookkeeping']) },
  { id: 'restaurants', name: 'Restaurants', problems: JSON.stringify(['Online reviews', 'Food delivery', 'Local SEO']), keywords: JSON.stringify(['catering near me', 'private dining', 'restaurant reservation']) },
  { id: 'gyms', name: 'Gyms / Fitness Centers', problems: JSON.stringify(['Member retention', 'Personal training sales', 'Class bookings']), keywords: JSON.stringify(['personal training', 'gym membership', 'fitness classes']) },
  { id: 'photographers', name: 'Photographers', problems: JSON.stringify(['Portfolio visibility', 'Package pricing', 'Booking automation']), keywords: JSON.stringify(['wedding photographer', 'portrait photography', 'event photographer']) }
];

const insertIndustry = db.prepare('INSERT OR IGNORE INTO industries (id, name, problems, keywords) VALUES (?, ?, ?, ?)');
industries.forEach(ind => insertIndustry.run(ind.id, ind.name, ind.problems, ind.keywords));

// SEO Brief Generation Logic
function generateSEOBrief(industry, keyword, wordCount, competitorUrl, notes) {
  const ind = industries.find(i => i.id === industry) || industries[0];
  const problems = JSON.parse(ind.problems);
  const keywords = JSON.parse(ind.keywords);
  
  const wc = parseInt(wordCount) || 2000;
  const intro = Math.floor(wc * 0.1);
  const whatIs = Math.floor(wc * 0.15);
  const benefits = Math.floor(wc * 0.25);
  const howTo = Math.floor(wc * 0.25);
  const faq = Math.floor(wc * 0.15);
  const conclusion = Math.floor(wc * 0.1);

  return {
    keyword,
    industry: ind.name,
    specifications: {
      wordCount: wc,
      readingLevel: 'Grade 8',
      format: 'Long-form article with FAQ',
      primaryKeyword: keyword
    },
    secondaryKeywords: [
      `${keyword} cost`,
      `${keyword} near me`,
      `best ${keyword}`,
      `${keyword} reviews`,
      keywords[Math.floor(Math.random() * keywords.length)]
    ],
    problems: problems,
    structure: {
      introduction: { percentage: '10%', words: intro, points: ['Hook with statistic', 'Relate to pain point', 'Overview of content'] },
      whatIs: { percentage: '15%', words: whatIs, points: ['Clear definition', 'Common misconceptions', 'Why it matters now'] },
      benefits: { percentage: '25%', words: benefits, points: problems },
      howTo: { percentage: '25%', words: howTo, points: ['Step-by-step', 'Numbered list', 'Pro tips'] },
      faq: { percentage: '15%', words: faq, points: ['6-8 common questions', 'Schema ready', 'Natural language'] },
      conclusion: { percentage: '10%', words: conclusion, points: ['Summary', 'Call to action', 'Next steps'] }
    },
    competitorAnalysis: competitorUrl || 'Not provided',
    notes: notes || 'None',
    metrics: {
      targetTraffic: '500+ organic visits/month',
      conversionRate: '2-3%',
      rankingTime: '3-6 months'
    },
    createdAt: new Date().toISOString()
  };
}

// API Routes
app.get('/api/industries', (req, res) => {
  const rows = db.prepare('SELECT * FROM industries').all();
  const data = rows.map(r => ({ ...r, problems: JSON.parse(r.problems), keywords: JSON.parse(r.keywords) }));
  res.json(data);
});

app.get('/api/briefs', (req, res) => {
  const briefs = db.prepare('SELECT * FROM briefs ORDER BY created_at DESC LIMIT 50').all();
  res.json(briefs);
});

app.get('/api/briefs/:id', (req, res) => {
  const brief = db.prepare('SELECT * FROM briefs WHERE id = ?').get(req.params.id);
  if (brief) {
    brief.content = JSON.parse(brief.content);
  }
  res.json(brief || { error: 'Brief not found' });
});

app.post('/api/briefs', (req, res) => {
  const { keyword, industry, wordCount, competitorUrl, notes } = req.body;
  
  const briefData = generateSEOBrief(industry, keyword, wordCount, competitorUrl, notes);
  const id = uuidv4();
  
  db.prepare(`
    INSERT INTO briefs (id, keyword, industry, word_count, competitor_url, notes, content)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, keyword, industry, wordCount, competitorUrl, notes, JSON.stringify(briefData));
  
  res.json({ id, ...briefData });
});

app.put('/api/briefs/:id', (req, res) => {
  const { keyword, industry, wordCount, competitorUrl, notes } = req.body;
  const briefData = generateSEOBrief(industry, keyword, wordCount, competitorUrl, notes);
  
  db.prepare(`
    UPDATE briefs SET keyword = ?, industry = ?, word_count = ?, competitor_url = ?, notes = ?, content = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(keyword, industry, wordCount, competitorUrl, notes, JSON.stringify(briefData), req.params.id);
  
  res.json({ id: req.params.id, ...briefData });
});

app.delete('/api/briefs/:id', (req, res) => {
  db.prepare('DELETE FROM briefs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/stats', (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as count FROM briefs').get().count;
  const recent = db.prepare('SELECT created_at FROM briefs ORDER BY created_at DESC LIMIT 1').get();
  res.json({ totalBriefs: count, lastCreated: recent?.created_at || null });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`SEO Brief Builder running on http://localhost:${PORT}`));
