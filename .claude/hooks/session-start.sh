#!/bin/bash
set -euo pipefail

# Only run in remote Claude Code on the web environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd "$CLAUDE_PROJECT_DIR/frontend"
npm install --legacy-peer-deps

# Install backend dependencies
echo "Installing backend dependencies..."
cd "$CLAUDE_PROJECT_DIR/backend"
npm install

# Install AI service dependencies
echo "Installing AI service Python dependencies..."
cd "$CLAUDE_PROJECT_DIR/ai-service"
pip install -r requirements.txt

echo "All dependencies installed."

# Set up PostgreSQL database
echo "Setting up PostgreSQL database..."
service postgresql start || true
sleep 2

# Create user and database if they don't exist
su -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='ONCONAV'\" | grep -q 1 || psql -c \"CREATE USER \\\"ONCONAV\\\" WITH PASSWORD 'ONCONAV_dev' CREATEDB;\"" postgres
su -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='ONCONAV_development'\" | grep -q 1 || psql -c \"CREATE DATABASE \\\"ONCONAV_development\\\" OWNER \\\"ONCONAV\\\";\"" postgres

# Ensure ONCONAV user has CREATEDB (needed for prisma shadow database)
su -c "psql -c \"ALTER USER \\\"ONCONAV\\\" CREATEDB;\"" postgres

# Create backend .env if missing
if [ ! -f "$CLAUDE_PROJECT_DIR/backend/.env" ]; then
  sed 's/:5433/:5432/' "$CLAUDE_PROJECT_DIR/.env.example" > "$CLAUDE_PROJECT_DIR/backend/.env"
fi

# Run migrations
echo "Running database migrations..."
cd "$CLAUDE_PROJECT_DIR/backend"
npx prisma migrate deploy

echo "Database setup complete."
