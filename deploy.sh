#!/bin/bash
# ================================
# Janmasethu Clinical OS - Deployment Script
# Run this script after cloning the repository
# ================================

set -e

echo "========================================"
echo "  Janmasethu Clinical OS - Deployment"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed.${NC}"
    echo "Please install Docker first: https://docs.docker.com/engine/install/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed.${NC}"
    echo "Please install Docker Compose first."
    exit 1
fi

# Check for .env file
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: .env file not found.${NC}"
    echo "Creating .env from .env.example..."
    
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${YELLOW}Please edit .env file with your Supabase credentials:${NC}"
        echo "  - SUPABASE_URL"
        echo "  - SUPABASE_SERVICE_ROLE_KEY"
        echo ""
        echo "Then run this script again."
        exit 1
    else
        echo -e "${RED}Error: .env.example not found.${NC}"
        exit 1
    fi
fi

# Validate required environment variables
source .env
if [ -z "$SUPABASE_URL" ] || [ "$SUPABASE_URL" == "https://your-project-id.supabase.co" ]; then
    echo -e "${RED}Error: SUPABASE_URL is not configured in .env${NC}"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ] || [ "$SUPABASE_SERVICE_ROLE_KEY" == "your-service-role-key-here" ]; then
    echo -e "${RED}Error: SUPABASE_SERVICE_ROLE_KEY is not configured in .env${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Environment variables validated${NC}"

# Build and start the application
echo ""
echo "Building Docker image..."
echo "========================================"

# Use docker compose (v2) or docker-compose (v1)
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# Stop existing containers
echo "Stopping existing containers..."
$DOCKER_COMPOSE down 2>/dev/null || true

# Build the image
echo "Building application..."
$DOCKER_COMPOSE build --no-cache

# Start the application
echo ""
echo "Starting application..."
$DOCKER_COMPOSE up -d

# Wait for health check
echo ""
echo "Waiting for application to be healthy..."
sleep 10

# Check if running
if $DOCKER_COMPOSE ps | grep -q "Up"; then
    echo ""
    echo -e "${GREEN}========================================"
    echo "  Deployment Successful!"
    echo "========================================${NC}"
    echo ""
    echo "Application is running at: http://localhost:3000"
    echo ""
    echo "Useful commands:"
    echo "  - View logs:     $DOCKER_COMPOSE logs -f"
    echo "  - Stop app:      $DOCKER_COMPOSE down"
    echo "  - Restart app:   $DOCKER_COMPOSE restart"
    echo "  - Rebuild app:   $DOCKER_COMPOSE up -d --build"
    echo ""
else
    echo -e "${RED}Error: Application failed to start.${NC}"
    echo "Check logs with: $DOCKER_COMPOSE logs"
    exit 1
fi
