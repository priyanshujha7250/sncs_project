#!/usr/bin/env bash
set -e

# Navigate to project directory
cd "$(dirname "$0")"

echo "=========================================================="
echo "  Shri Network Courier Services (SNCS) - Ranchi"
echo "  Gandhi Market, Near Basera Hotel Overbridge, 834001"
echo "=========================================================="

# Check if .venv exists
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
    .venv/bin/pip install --upgrade pip
    .venv/bin/pip install flask flask-cors
fi

# Ensure database is initialized
echo "Checking database..."
.venv/bin/python database.py

# Start Server
export PORT=5005
echo ""
echo "🚀 Starting SNCS Web Portal at: http://localhost:${PORT}"
echo "   • Customer Portal: http://localhost:${PORT}"
echo "   • Staff & Owner Admin: http://localhost:${PORT}/admin (User: admin, Pass: admin123)"
echo ""
exec .venv/bin/python app.py
