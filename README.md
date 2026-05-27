# Xander AI IDE

A Cursor-like AI-powered coding IDE with SaaS subscription management, built with Electron, Next.js, NestJS, and AI integration.

## 🚀 Features

### Desktop IDE
- **Full Project Support**: Open and browse complete project folders
- **Intelligent File Explorer**: Recursive file browsing with smart filtering
- **Monaco Editor**: Professional code editor with syntax highlighting
- **AI-Powered Chat**: Contextual AI assistance for coding questions
- **Smart Autocomplete**: AI-driven code completion
- **Git Integration**: Complete Git workflow with AI commit messages
- **Multi-file Editing**: AI Composer for batch file changes
- **Integrated Terminal**: Run commands with approval system
- **Real-time File Watching**: Automatic UI updates on file changes

### Web Portal
- **Landing Page**: Modern marketing site with feature highlights
- **User Authentication**: Secure login/registration system
- **Dashboard**: Usage monitoring and subscription management
- **Billing Integration**: Stripe-powered payment processing
- **Usage Analytics**: Real-time token and cost tracking
- **Settings Management**: User preferences and account settings

### Backend API
- **RESTful API**: Complete CRUD operations for all entities
- **WebSocket Support**: Real-time chat and streaming responses
- **AI Integration**: OpenAI API integration with smart routing
- **Quota Management**: Usage limits and credit system
- **Organization Support**: Team-based subscriptions
- **Security**: JWT authentication and role-based access

## 🏗️ Architecture

```
xander-ai-ide/
├── apps/
│   ├── desktop/          # Electron desktop IDE
│   ├── backend/          # NestJS API server
│   └── web/              # Next.js SaaS portal
├── packages/
│   ├── ai-engine/        # AI processing logic
│   ├── repo-indexer/     # Repository indexing
│   ├── shared/           # Shared utilities
│   └── ui-components/    # Reusable UI components
└── infrastructure/
    ├── PostgreSQL/       # Main database
    ├── Redis/           # Caching and sessions
    └── Qdrant/          # Vector storage for embeddings
```

## 🛠️ Tech Stack

### Frontend
- **Electron**: Desktop application framework
- **Next.js**: React framework for web portal
- **React**: UI library
- **Monaco Editor**: Code editing capabilities
- **TailwindCSS**: Styling framework
- **Zustand**: State management
- **Socket.io**: Real-time communication

### Backend
- **NestJS**: Node.js framework
- **Prisma**: ORM and database management
- **PostgreSQL**: Primary database
- **Redis**: Caching and session storage
- **Qdrant**: Vector database for embeddings
- **OpenAI**: AI model integration
- **Stripe**: Payment processing
- **Socket.io**: WebSocket support

### DevOps
- **Turbo**: Monorepo management
- **pnpm**: Package manager
- **TypeScript**: Type safety
- **Docker**: Containerization

## 📋 Prerequisites

- Node.js 18+ 
- pnpm 8+
- PostgreSQL 14+
- Redis 6+
- Qdrant 1.0+

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd xander-ai-ide
pnpm install
```

### 2. Environment Setup

Copy the environment file and configure your services:

```bash
cp .env.example .env
```

Configure the following variables:
```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/xander_ai_ide"

# Services
REDIS_URL=redis://localhost:6379
QDRANT_URL=http://localhost:6333

# OpenAI
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL_AGENT=gpt-5.1
OPENAI_MODEL_FAST=gpt-5.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Security
JWT_SECRET=your_jwt_secret

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

### 3. Database Setup

```bash
# Generate Prisma client
pnpm --filter backend prisma:generate

# Run migrations
pnpm --filter backend prisma:migrate

# (Optional) Seed database
pnpm --filter backend prisma:seed
```

### 4. Start Development

Start all services in development mode:

```bash
# Start all apps
pnpm dev

# Or start individually:
pnpm dev:backend    # API server on :3001
pnpm dev:web        # Web portal on :3000  
pnpm dev:desktop    # Desktop app
```

## 📦 Build & Deploy

### Backend

```bash
cd apps/backend
pnpm build
pnpm start
```

### Web Portal

```bash
cd apps/web
pnpm build
pnpm start
```

### Desktop App

```bash
cd apps/desktop
pnpm build
pnpm package
```

## 💾 Database Schema

The application uses a comprehensive database schema with the following key entities:

- **Users**: Authentication and profile management
- **Organizations**: Team and workspace management  
- **Subscriptions**: Plan and billing information
- **Projects**: User projects and repositories
- **Conversations**: AI chat history
- **UsageLogs**: Token usage and cost tracking
- **QuotaUsage**: Subscription limits and monitoring

See `apps/backend/prisma/schema.prisma` for the complete schema.

## 🔧 Configuration

### Subscription Plans

The system supports multiple subscription tiers:

- **Free**: Limited daily quota, basic features
- **Pro**: Higher quotas, AI Composer, autocomplete
- **Team**: Shared quotas, team management
- **Enterprise**: Custom limits, priority support

### AI Model Configuration

Configure AI models in your environment:

```env
OPENAI_MODEL_AGENT=gpt-5.1          # Main chat/agent model
OPENAI_MODEL_FAST=gpt-5.1-mini       # Fast autocomplete
OPENAI_EMBEDDING_MODEL=text-embedding-3-small  # Embeddings
```

## 🔐 Security

- JWT-based authentication
- Role-based access control
- Secure IPC communication
- Input validation and sanitization
- Rate limiting and quota enforcement
- Environment variable protection

## 📊 Usage Monitoring

The system tracks:
- Token usage per user/organization
- API request costs
- Daily/weekly/monthly quotas
- Feature-specific usage patterns
- Real-time quota enforcement

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support:
- Create an issue in the repository
- Contact support@xander-ai.com
- Check the documentation at docs.xander-ai.com

## 🗺️ Roadmap

- [ ] VS Code extensions
- [ ] Mobile companion app
- [ ] Advanced AI agent mode
- [ ] Code review automation
- [ ] Performance profiling
- [ ] Multi-language support

## 🌟 Acknowledgments

- Built with inspiration from Cursor IDE
- Powered by OpenAI's language models
- UI components from Radix UI and TailwindCSS
- Icons from Lucide React
