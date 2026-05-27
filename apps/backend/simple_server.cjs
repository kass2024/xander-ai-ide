const http = require('http');

const port = process.env.PORT || 3001;

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:3000',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, corsHeaders);
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  const path = req.url?.split('?')[0] || '/';

  if (path === '/') {
    sendJson(res, 200, { message: 'Xander AI IDE Backend API' });
    return;
  }

  if (path === '/api/health') {
    sendJson(res, 200, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'xander-ai-ide-backend',
    });
    return;
  }

  if (path === '/api/health/detailed') {
    sendJson(res, 200, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'xander-ai-ide-backend',
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
    });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(port, () => {
  console.log(`🚀 Backend API running on http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/api/health`);
});
