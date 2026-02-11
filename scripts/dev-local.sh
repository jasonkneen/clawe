#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo_info()  { echo -e "${GREEN}==>${NC} $1"; }
echo_warn()  { echo -e "${YELLOW}==>${NC} $1"; }
echo_error() { echo -e "${RED}ERROR:${NC} $1"; }

PROFILE="clawe"
GATEWAY_PORT=18799
PIDS=()

# ─────────────────────────────────────────────────────
# Pre-flight checks
# ─────────────────────────────────────────────────────
if [ ! -f .env ]; then
    echo_error ".env not found. Run setup first:"
    echo "  pnpm setup:local"
    exit 1
fi

# Load .env
set -a
source .env
set +a

OPENCLAW_DIR="$HOME/.openclaw-${PROFILE}"
if [ ! -f "${OPENCLAW_DIR}/openclaw.json" ]; then
    echo_error "OpenClaw profile '${PROFILE}' not found. Run setup first:"
    echo "  pnpm setup:local"
    exit 1
fi

if [ -z "$CONVEX_URL" ] || [ "$CONVEX_URL" = "https://your-deployment.convex.cloud" ]; then
    echo_error "CONVEX_URL not set in .env. Run setup first:"
    echo "  pnpm setup:local"
    exit 1
fi

# ─────────────────────────────────────────────────────
# Cleanup on exit
# ─────────────────────────────────────────────────────
cleanup() {
    echo ""
    echo_info "Shutting down all services..."
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
        fi
    done
    # Kill process groups
    jobs -p | xargs -r kill 2>/dev/null || true
    wait 2>/dev/null || true
    echo_info "All services stopped."
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# ─────────────────────────────────────────────────────
# Export env for all child processes
# ─────────────────────────────────────────────────────
export NEXT_PUBLIC_CONVEX_URL="${CONVEX_URL}"
export OPENCLAW_URL="http://localhost:${GATEWAY_PORT}"
export OPENCLAW_TOKEN="${OPENCLAW_TOKEN}"
export CONVEX_URL="${CONVEX_URL}"
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}"

# ─────────────────────────────────────────────────────
# 1. Start OpenClaw gateway
# ─────────────────────────────────────────────────────
GATEWAY_RUNNING=false

if lsof -i ":${GATEWAY_PORT}" &>/dev/null; then
    if curl -sf "http://localhost:${GATEWAY_PORT}/health" &>/dev/null; then
        echo_info "OpenClaw gateway already running on port ${GATEWAY_PORT}"
        GATEWAY_RUNNING=true
    else
        echo_error "Port ${GATEWAY_PORT} in use but gateway unhealthy. Kill it:"
        echo "  lsof -ti :${GATEWAY_PORT} | xargs kill"
        exit 1
    fi
fi

if [ "$GATEWAY_RUNNING" = false ]; then
    echo_info "Starting OpenClaw gateway (profile: ${PROFILE})..."

    ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" \
    openclaw --profile "$PROFILE" gateway \
        --port "$GATEWAY_PORT" \
        --bind loopback \
        --token "${OPENCLAW_TOKEN}" \
        2>&1 | sed 's/^/  [openclaw] /' &
    PIDS+=($!)

    # Wait for healthy
    for i in $(seq 1 30); do
        if curl -sf "http://localhost:${GATEWAY_PORT}/health" &>/dev/null; then
            echo_info "✅ OpenClaw gateway ready"
            break
        fi
        if [ $i -eq 30 ]; then
            echo_error "OpenClaw gateway failed to start after 30s"
            exit 1
        fi
        sleep 1
    done
fi

# ─────────────────────────────────────────────────────
# 2. Start Convex dev server
# ─────────────────────────────────────────────────────
CONVEX_PORT=3210

if curl -sf "http://127.0.0.1:${CONVEX_PORT}" &>/dev/null; then
    echo_info "Convex local backend already running on port ${CONVEX_PORT}"
    # Still need convex dev for file watching/pushing
    (cd packages/backend && npx convex dev 2>&1 | sed 's/^/  [convex] /') &
    PIDS+=($!)
    sleep 2
else
    echo_info "Starting Convex dev server..."
    (cd packages/backend && npx convex dev 2>&1 | sed 's/^/  [convex] /') &
    PIDS+=($!)
    # Wait for Convex to be ready
    for i in $(seq 1 30); do
        if curl -sf "http://127.0.0.1:${CONVEX_PORT}" &>/dev/null; then
            echo_info "✅ Convex ready"
            break
        fi
        sleep 1
    done
fi

# ─────────────────────────────────────────────────────
# 3. Start shared package watcher
# ─────────────────────────────────────────────────────
echo_info "Starting shared package watcher..."

(cd packages/shared && pnpm dev 2>&1 | sed 's/^/  [shared] /') &
PIDS+=($!)

# ─────────────────────────────────────────────────────
# 4. Start Next.js web app
# ─────────────────────────────────────────────────────
echo_info "Starting Next.js web app..."

(cd apps/web && \
    NEXT_PUBLIC_CONVEX_URL="${CONVEX_URL}" \
    OPENCLAW_URL="http://localhost:${GATEWAY_PORT}" \
    OPENCLAW_TOKEN="${OPENCLAW_TOKEN}" \
    npx next dev --port 3000 2>&1 | sed 's/^/  [web] /') &
PIDS+=($!)

sleep 2

# ─────────────────────────────────────────────────────
# 5. Start watcher (notification delivery)
# ─────────────────────────────────────────────────────
echo_info "Starting notification watcher..."

(cd apps/watcher && \
    CONVEX_URL="${CONVEX_URL}" \
    OPENCLAW_URL="http://localhost:${GATEWAY_PORT}" \
    OPENCLAW_TOKEN="${OPENCLAW_TOKEN}" \
    npx tsx watch src/index.ts 2>&1 | sed 's/^/  [watcher] /') &
PIDS+=($!)

# ─────────────────────────────────────────────────────
# Running!
# ─────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}🦞 Clawe is running!${NC}"
echo ""
echo "  🌐 Web app           → http://localhost:3000"
echo "  🦞 OpenClaw dashboard → http://localhost:${GATEWAY_PORT}/?token=${OPENCLAW_TOKEN}"
echo "  📦 Convex dashboard   → http://127.0.0.1:6790"
echo "  👀 Watcher            → active"
echo ""
echo -e "Press ${CYAN}Ctrl+C${NC} to stop all services."
echo ""

# Wait for any child to exit
wait
