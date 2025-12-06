const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Sessions storage
const sessions = {};

// Get all sessions
app.get('/sessions', (req, res) => {
  const sessionList = Object.entries(sessions).map(([id, data]) => ({
    id,
    status: data.status || 'disconnected',
    createdAt: data.createdAt
  }));
  res.json(sessionList);
});

// Create session
app.post('/sessions', (req, res) => {
  const { id } = req.body;
  sessions[id] = { status: 'pending', createdAt: new Date().toISOString() };
  res.json({ id, status: 'pending' });
});

// Delete session
app.delete('/sessions/:id', (req, res) => {
  delete sessions[req.params.id];
  res.json({ success: true });
});

// Get session status
app.get('/sessions/:id/status', (req, res) => {
  const session = sessions[req.params.id];
  res.json({ status: session?.status || 'disconnected' });
});

// QR code endpoint
app.get('/qr/:sessionId', (req, res) => {
  res.json({ qr: null, message: 'QR generation pending' });
});

// Send message
app.post('/send/text', (req, res) => {
  const { sessionId, to, message } = req.body;
  res.json({ success: true, messageId: Date.now().toString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
