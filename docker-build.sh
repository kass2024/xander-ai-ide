#!/bin/bash

# Production Docker Build Script for Xander AI IDE

echo "🚀 Building Production Docker Images for Xander AI IDE"
echo "======================================================"

# Build backend image
echo "📦 Building backend image..."
docker build -f Dockerfile.backend -t xander-ai-ide/backend:latest .
if [ $? -eq 0 ]; then
    echo "✅ Backend image built successfully"
else
    echo "❌ Backend build failed"
    exit 1
fi

# Build web image
echo "📦 Building web image..."
docker build -f Dockerfile.web -t xander-ai-ide/web:latest .
if [ $? -eq 0 ]; then
    echo "✅ Web image built successfully"
else
    echo "❌ Web build failed"
    exit 1
fi

# Tag and push to registry (uncomment and modify as needed)
# echo "📤 Pushing images to registry..."
# docker tag xander-ai-ide/backend:latest your-registry/xander-ai-ide/backend:latest
# docker tag xander-ai-ide/web:latest your-registry/xander-ai-ide/web:latest
# docker push your-registry/xander-ai-ide/backend:latest
# docker push your-registry/xander-ai-ide/web:latest

echo "======================================================"
echo "✅ All Docker images built successfully!"
echo "======================================================"
echo ""
echo "To run with Docker Compose:"
echo "  docker-compose up -d"
echo ""
echo "To run with Kubernetes:"
echo "  kubectl apply -f kubernetes-deployment.yml"
echo ""
echo "Images built:"
echo "  - xander-ai-ide/backend:latest"
echo "  - xander-ai-ide/web:latest"
