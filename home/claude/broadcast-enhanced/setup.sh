#!/bin/bash
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Broadcast Platform — Enterprise Edition Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Backend ──────────────────────────────────────────
echo ""
echo "[1/3] Installing backend dependencies..."
cd backend
npm install
# Create all upload directories
mkdir -p uploads/avatars uploads/files uploads/kb uploads/leadership
cd ..
echo "[1/3] Backend ready."

# ── Frontend ─────────────────────────────────────────
echo ""
echo "[2/3] Installing frontend dependencies..."
cd frontend
npm install
cd ..
echo "[2/3] Frontend ready."

# ── Config check ─────────────────────────────────────
echo ""
echo "[3/3] Checking configuration..."
if grep -q "CHANGE_THIS" backend/.env 2>/dev/null; then
  echo "  ⚠️  Set MONGO_URI and JWT_SECRET in backend/.env"
fi
if grep -q "your_email" backend/.env 2>/dev/null; then
  echo "  ⚠️  Set EMAIL_USER and EMAIL_PASS in backend/.env (needed for OTP/password reset)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Setup complete!"
echo ""
echo "  Terminal 1:  cd backend && npm run dev"
echo "  Terminal 2:  cd frontend && npm run dev"
echo ""
echo "  App → http://localhost:5173"
echo "  API → http://localhost:5000/api"
echo ""
echo "  Enterprise routes:"
echo "    /announcements   Announcement Center"
echo "    /knowledge-base  Company Library"
echo "    /tasks           Task Assignment"
echo "    /leadership      CEO / Leadership Corner"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
