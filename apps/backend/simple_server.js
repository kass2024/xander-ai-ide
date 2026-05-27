const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Xander AI IDE Backend API' });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'xander-ai-ide-backend',
  });
});

app.get('/api/health/detailed', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'xander-ai-ide-backend',
    version: '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Backend API running on http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/api/health`);
});
