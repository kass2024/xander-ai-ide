import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return { 
      message: 'Xander AI IDE Backend API',
      version: '1.0.0',
      status: 'running'
    };
  }

  @Get('api/health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'xander-ai-ide-backend',
      uptime: process.uptime(),
    };
  }
}
