require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname)));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasApiKey: Boolean(API_KEY) });
});

app.post('/api/chat', async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.'
    });
  }

  const { model, max_tokens, messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: max_tokens || 4000,
        messages
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || data.message || 'Anthropic API error'
      });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log('');
  console.log('  YouTube Script Analyser');
  console.log('  -----------------------');
  console.log(`  Open: http://localhost:${PORT}/script-analyser.html`);
  if (!API_KEY) {
    console.log('');
    console.log('  WARNING: ANTHROPIC_API_KEY not set.');
    console.log('  Copy .env.example to .env and add your key, then restart.');
  } else {
    console.log('  API key: loaded');
  }
  console.log('');
});
