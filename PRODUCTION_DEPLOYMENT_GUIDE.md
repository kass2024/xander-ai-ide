# 🚀 Production Deployment Guide - Xander AI IDE

## 📋 Overview

This guide provides comprehensive instructions for deploying the Xander AI IDE to production environments.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Portal    │    │   Backend API   │    │   Desktop App   │
│   (Next.js)     │    │   (NestJS)      │    │   (Electron)    │
│   Port: 3000    │    │   Port: 3001    │    │   Standalone    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
         ┌─────────────────┬─────────────────┬─────────────────┐
         │   PostgreSQL    │      Redis      │     Qdrant      │
         │   (Database)    │    (Cache)      │  (Vector DB)    │
         │   Port: 5432    │   Port: 6379    │  Port: 6333     │
         └─────────────────┴─────────────────┴─────────────────┘
```

## 🐳 Docker Deployment

### Prerequisites
- Docker and Docker Compose installed
- Production environment variables configured
- Domain names configured for SSL

### Quick Start

1. **Setup Environment Variables**
   ```bash
   cp production.env .env
   # Edit .env with your actual values
   ```

2. **Start Services**
   ```bash
   docker-compose up -d
   ```

3. **Build Applications**
   ```bash
   chmod +x docker-build.sh
   ./docker-build.sh
   ```

4. **Verify Deployment**
   ```bash
   curl http://localhost:3000  # Web Portal
   curl http://localhost:3001/api/health  # Backend API
   ```

## ☸️ Kubernetes Deployment

### Prerequisites
- Kubernetes cluster (v1.20+)
- kubectl configured
- Ingress controller installed
- Cert-manager for SSL

### Deployment Steps

1. **Create Secrets**
   ```bash
   kubectl create secret generic xander-secrets \
     --from-literal=database-url="postgresql://..." \
     --from-literal=redis-url="redis://..." \
     --from-literal=qdrant-url="http://..." \
     --from-literal=openai-api-key="sk-..." \
     --from-literal=jwt-secret="..." \
     --from-literal=stripe-secret-key="sk_..."
   ```

2. **Deploy Applications**
   ```bash
   kubectl apply -f kubernetes-deployment.yml
   ```

3. **Check Deployment Status**
   ```bash
   kubectl get pods
   kubectl get services
   kubectl get ingress
   ```

## 🔧 Environment Configuration

### Required Environment Variables

```bash
# Application
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Cache
REDIS_URL=redis://host:6379

# Vector Database
QDRANT_URL=http://host:6333

# AI Services
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL_GPT_5_1=gpt-5.1
OPENAI_MODEL_GPT_5_1_MINI=gpt-5.1-mini
OPENAI_MODEL_EMBEDDING=text-embedding-3-small

# Authentication
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=7d

# Payment Processing
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# URLs
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://api.yourdomain.com
```

## 🌐 Domain Setup

### DNS Configuration

1. **Main Domain**: `yourdomain.com` → Web Portal
2. **API Domain**: `api.yourdomain.com` → Backend API
3. **Desktop**: Downloadable executable

### SSL/TLS Setup

1. **Let's Encrypt** (Recommended)
   ```bash
   certbot --nginx -d yourdomain.com -d api.yourdomain.com
   ```

2. **Cloudflare SSL** (Alternative)
   - Enable Cloudflare proxy
   - Set SSL/TLS to "Full (Strict)"

## 📊 Monitoring & Logging

### Application Monitoring

1. **Health Checks**
   ```bash
   # Backend Health
   curl https://api.yourdomain.com/api/health
   
   # Web Health
   curl https://yourdomain.com
   ```

2. **Logging**
   ```bash
   # Docker logs
   docker-compose logs -f backend
   docker-compose logs -f web
   
   # Kubernetes logs
   kubectl logs -f deployment/xander-backend
   kubectl logs -f deployment/xander-web
   ```

3. **Metrics Collection**
   - Prometheus + Grafana
   - Application-specific metrics
   - Error tracking (Sentry)

## 🔒 Security Considerations

### Network Security
- Firewall rules (only allow necessary ports)
- VPN access for admin interfaces
- Rate limiting on API endpoints

### Application Security
- Environment variables properly secured
- Database encryption at rest
- API key rotation policies
- Regular security updates

### Data Protection
- User data encryption
- Backup strategies
- GDPR compliance
- Data retention policies

## 🚀 CI/CD Pipeline

### GitHub Actions Setup

1. **Create Workflow**
   ```bash
   mkdir .github/workflows
   cp CI_CD_PIPELINE.yml .github/workflows/deploy.yml
   ```

2. **Configure Secrets**
   - `DATABASE_URL`
   - `OPENAI_API_KEY`
   - `STRIPE_SECRET_KEY`
   - Docker registry credentials

3. **Enable Automated Deployments**
   - Push to main branch triggers deployment
   - Pull requests run tests
   - Automated image building

## 📱 Desktop App Distribution

### Build for Production

```bash
cd apps/desktop
npm run build
npm run package
```

### Distribution Channels

1. **Direct Download**
   - Host on your domain
   - Auto-updater enabled

2. **Microsoft Store** (Optional)
   - Windows Store submission
   - Code signing required

3. **Mac App Store** (Optional)
   - macOS distribution
   - Apple Developer account

## 🔧 Maintenance

### Regular Tasks

1. **Database Maintenance**
   ```bash
   # Backup database
   pg_dump xander_ai_ide > backup.sql
   
   # Optimize database
   psql -c "VACUUM ANALYZE;"
   ```

2. **Cache Management**
   ```bash
   # Clear Redis cache
   redis-cli FLUSHALL
   
   # Monitor Redis usage
   redis-cli INFO memory
   ```

3. **Log Rotation**
   ```bash
   # Rotate application logs
   logrotate -f /etc/logrotate.d/xander-ai-ide
   ```

### Scaling Considerations

1. **Horizontal Scaling**
   - Load balancer configuration
   - Database connection pooling
   - Redis clustering

2. **Performance Optimization**
   - CDN for static assets
   - Database indexing
   - Caching strategies

## 🆘 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check DATABASE_URL format
   - Verify database is running
   - Check network connectivity

2. **API Not Responding**
   - Check application logs
   - Verify port availability
   - Check resource usage

3. **High Memory Usage**
   - Monitor Node.js processes
   - Check for memory leaks
   - Optimize database queries

### Debug Commands

```bash
# Check system resources
docker stats
kubectl top pods

# Database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Cache connectivity
redis-cli ping

# API health check
curl -f https://api.yourdomain.com/api/health || exit 1
```

## 📞 Support

For production deployment issues:
1. Check this guide first
2. Review application logs
3. Monitor system resources
4. Contact support team

---

**🎉 Congratulations! Your Xander AI IDE is now production-ready!**
