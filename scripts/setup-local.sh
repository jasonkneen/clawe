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
BOLD='\033[1m'
NC='\033[0m'

echo_info()  { echo -e "${GREEN}==>${NC} $1"; }
echo_warn()  { echo -e "${YELLOW}==>${NC} $1"; }
echo_error() { echo -e "${RED}ERROR:${NC} $1"; }
echo_step()  { echo -e "${CYAN}==>${NC} $1"; }

PROFILE="clawe"
OPENCLAW_DIR="$HOME/.openclaw-${PROFILE}"
LOCAL_DATA_DIR="$ROOT_DIR/.openclaw"
GATEWAY_PORT=18799

echo ""
echo -e "${CYAN}🦞 Clawe Local Setup (no Docker)${NC}"
echo ""

# ─────────────────────────────────────────────────────
# 1. Check prerequisites
# ─────────────────────────────────────────────────────
echo_step "Checking prerequisites..."

if ! command -v openclaw &>/dev/null; then
    echo_error "openclaw CLI not found. Install with: npm install -g openclaw@latest"
    exit 1
fi
echo_info "openclaw $(openclaw --version) found"

if ! command -v pnpm &>/dev/null; then
    echo_error "pnpm not found. Install with: npm install -g pnpm"
    exit 1
fi
echo_info "pnpm $(pnpm --version) found"

if ! command -v node &>/dev/null; then
    echo_error "node not found. Install Node.js 18+."
    exit 1
fi
echo_info "node $(node --version) found"

# ─────────────────────────────────────────────────────
# 2. Install dependencies
# ─────────────────────────────────────────────────────
echo_step "Installing dependencies..."
pnpm install

# ─────────────────────────────────────────────────────
# 3. Build shared packages
# ─────────────────────────────────────────────────────
echo_step "Building shared packages..."
pnpm --filter @clawe/shared build
pnpm --filter @clawe/cli build

# ─────────────────────────────────────────────────────
# 4. Convex setup (interactive)
# ─────────────────────────────────────────────────────
echo ""
echo_step "Setting up Convex backend..."

CONVEX_URL=""

if [ -f "packages/backend/.env.local" ]; then
    echo_info "Convex already configured (packages/backend/.env.local exists)"
    # Extract the URL from the Convex config
    CONVEX_URL=$(grep "^CONVEX_URL=" packages/backend/.env.local 2>/dev/null | head -1 | cut -d= -f2 || true)
    if [ -z "$CONVEX_URL" ]; then
        # Try getting it from CONVEX_DEPLOYMENT
        CONVEX_DEPLOYMENT=$(grep "^CONVEX_DEPLOYMENT=" packages/backend/.env.local 2>/dev/null | head -1 | cut -d= -f2 || true)
        if [ -n "$CONVEX_DEPLOYMENT" ]; then
            if [[ "$CONVEX_DEPLOYMENT" == anonymous:* ]]; then
                # Local deployment - uses localhost
                CONVEX_URL="http://127.0.0.1:3210"
            else
                # Cloud deployment
                CONVEX_URL="https://${CONVEX_DEPLOYMENT}.convex.cloud"
            fi
        fi
    fi
else
    echo ""
    echo -e "${BOLD}Convex needs to be configured.${NC}"
    echo "This will set up a local Convex deployment (no account needed)."
    echo "You can later run 'npx convex login' to link to a cloud account."
    echo ""
    echo -e "Press ${BOLD}Enter${NC} to continue (or Ctrl+C to abort)..."
    read -r

    # Run convex dev --once from the backend package dir (interactive)
    cd packages/backend
    npx convex dev --once
    cd "$ROOT_DIR"

    # Extract URL after setup
    if [ -f "packages/backend/.env.local" ]; then
        CONVEX_URL=$(grep "^CONVEX_URL=" packages/backend/.env.local 2>/dev/null | head -1 | cut -d= -f2 || true)
        if [ -z "$CONVEX_URL" ]; then
            CONVEX_DEPLOYMENT=$(grep "^CONVEX_DEPLOYMENT=" packages/backend/.env.local 2>/dev/null | head -1 | cut -d= -f2 || true)
            if [ -n "$CONVEX_DEPLOYMENT" ]; then
                if [[ "$CONVEX_DEPLOYMENT" == anonymous:* ]]; then
                    CONVEX_URL="http://127.0.0.1:3210"
                else
                    CONVEX_URL="https://${CONVEX_DEPLOYMENT}.convex.cloud"
                fi
            fi
        fi
    fi

    if [ -z "$CONVEX_URL" ]; then
        echo_warn "Could not auto-detect Convex URL."
        echo "Please enter your Convex deployment URL:"
        echo "  Local: http://127.0.0.1:3210"
        echo "  Cloud: https://your-name-123.convex.cloud"
        read -r CONVEX_URL
    fi
fi

if [ -z "$CONVEX_URL" ]; then
    echo_error "Convex URL not configured. Please run 'npx convex dev' in packages/backend/ manually."
    exit 1
fi

echo_info "Convex URL: $CONVEX_URL"

# ─────────────────────────────────────────────────────
# 5. Generate .env
# ─────────────────────────────────────────────────────
echo_step "Configuring environment..."

TOKEN=$(openssl rand -hex 32)

if [ ! -f .env ]; then
    cp .env.example .env
    echo_info "Created .env from template"
fi

# Prompt for Anthropic key if not set
CURRENT_KEY=$(grep "^ANTHROPIC_API_KEY=" .env | cut -d= -f2)
if [ -z "$CURRENT_KEY" ] || [ "$CURRENT_KEY" = "sk-ant-..." ]; then
    echo ""
    echo -e "${BOLD}Anthropic API key required.${NC}"
    echo "Get one from https://console.anthropic.com"
    echo -n "Enter your ANTHROPIC_API_KEY: "
    read -r ANTHROPIC_KEY
    if [ -z "$ANTHROPIC_KEY" ]; then
        echo_warn "No key entered. You can set it later in .env"
        ANTHROPIC_KEY="sk-ant-..."
    fi
else
    ANTHROPIC_KEY="$CURRENT_KEY"
fi

# Write the .env file with proper values
cat > .env << ENVEOF
# Clawe Local Development Environment
# Generated by scripts/setup-local.sh

# =============================================================================
# REQUIRED
# =============================================================================

# Anthropic API key for Claude models
ANTHROPIC_API_KEY=${ANTHROPIC_KEY}

# Convex deployment URL
CONVEX_URL=${CONVEX_URL}
NEXT_PUBLIC_CONVEX_URL=${CONVEX_URL}

# OpenClaw gateway auth token (auto-generated)
OPENCLAW_TOKEN=${TOKEN}

# =============================================================================
# LOCAL DEV
# =============================================================================

ENVIRONMENT=dev
OPENCLAW_URL=http://localhost:${GATEWAY_PORT}
OPENCLAW_STATE_DIR=${OPENCLAW_DIR}
ENVEOF

echo_info "Environment configured"
echo_info "Generated OPENCLAW_TOKEN: ${TOKEN:0:8}..."

# ─────────────────────────────────────────────────────
# 6. Setup OpenClaw profile for Clawe
# ─────────────────────────────────────────────────────
echo_step "Setting up OpenClaw profile '${PROFILE}'..."

if [ -f "${OPENCLAW_DIR}/openclaw.json" ]; then
    echo_info "OpenClaw profile '${PROFILE}' already exists."
else
    echo_info "Running OpenClaw onboarding..."

    # Create workspace directories
    mkdir -p "${LOCAL_DATA_DIR}/workspace/memory"
    mkdir -p "${LOCAL_DATA_DIR}/workspace-inky/memory"
    mkdir -p "${LOCAL_DATA_DIR}/workspace-pixel/memory"
    mkdir -p "${LOCAL_DATA_DIR}/workspace-pixel/assets"
    mkdir -p "${LOCAL_DATA_DIR}/workspace-scout/memory"
    mkdir -p "${LOCAL_DATA_DIR}/workspace-scout/research"
    mkdir -p "${LOCAL_DATA_DIR}/shared"

    ANTHROPIC_API_KEY="${ANTHROPIC_KEY}" \
    openclaw --profile "$PROFILE" onboard \
        --non-interactive \
        --accept-risk \
        --mode local \
        --anthropic-api-key "${ANTHROPIC_KEY}" \
        --gateway-port "$GATEWAY_PORT" \
        --gateway-bind loopback \
        --gateway-auth token \
        --gateway-token "$TOKEN" \
        --workspace "${LOCAL_DATA_DIR}/workspace" \
        --skip-channels \
        --skip-skills \
        --skip-health \
        --skip-ui \
        --skip-daemon \
        --tailscale off

    echo_info "OpenClaw onboarding complete."
fi

# ─────────────────────────────────────────────────────
# 7. Copy workspace templates
# ─────────────────────────────────────────────────────
echo_step "Setting up agent workspaces..."

TEMPLATES_DIR="$ROOT_DIR/docker/openclaw/templates"

if [ -d "$TEMPLATES_DIR/shared" ]; then
    cp -r "$TEMPLATES_DIR/shared/"* "${LOCAL_DATA_DIR}/shared/" 2>/dev/null || true
    echo_info "Shared state initialized"
fi

for agent in clawe inky pixel scout; do
    if [ -d "$TEMPLATES_DIR/workspaces/$agent" ]; then
        DEST="${LOCAL_DATA_DIR}/workspace"
        [ "$agent" != "clawe" ] && DEST="${LOCAL_DATA_DIR}/workspace-${agent}"
        mkdir -p "$DEST"
        cp -r "$TEMPLATES_DIR/workspaces/$agent/"* "$DEST/" 2>/dev/null || true
        ln -sf "${LOCAL_DATA_DIR}/shared" "$DEST/shared" 2>/dev/null || true
        echo_info "$agent workspace → $DEST"
    fi
done

# ─────────────────────────────────────────────────────
# 8. Patch OpenClaw config with Clawe agents
# ─────────────────────────────────────────────────────
echo_step "Configuring OpenClaw with Clawe agents..."

CONFIG_FILE="${OPENCLAW_DIR}/openclaw.json"

python3 -c "
import json, os

template_path = '${TEMPLATES_DIR}/config.template.json'
config_path = '${CONFIG_FILE}'
ws_base = '${LOCAL_DATA_DIR}'
port = int('${GATEWAY_PORT}')
token = '${TOKEN}'
convex_url = '${CONVEX_URL}'

with open(template_path) as f:
    content = f.read()

content = content.replace('\${OPENCLAW_PORT}', str(port))
content = content.replace('\${OPENCLAW_TOKEN}', token)
content = content.replace('\${CONVEX_URL}', convex_url)

config = json.loads(content)

# Fix workspace paths: /data/... → local paths
for agent in config.get('agents', {}).get('list', []):
    ws = agent.get('workspace', '')
    if ws.startswith('/data/'):
        agent['workspace'] = os.path.join(ws_base, ws.replace('/data/', ''))

defaults = config.get('agents', {}).get('defaults', {})
if defaults.get('workspace', '').startswith('/data/'):
    defaults['workspace'] = os.path.join(ws_base, defaults['workspace'].replace('/data/', ''))

config.setdefault('gateway', {})['bind'] = 'loopback'

# Merge with existing config to preserve onboarding state
try:
    with open(config_path) as f:
        existing = json.load(f)
    existing['agents'] = config['agents']
    existing['gateway'] = config['gateway']
    existing['tools'] = config.get('tools', existing.get('tools', {}))
    existing['hooks'] = config.get('hooks', existing.get('hooks', {}))
    existing['commands'] = config.get('commands', existing.get('commands', {}))
    if convex_url:
        existing.setdefault('env', {})['CONVEX_URL'] = convex_url
    config = existing
except (FileNotFoundError, json.JSONDecodeError):
    pass

with open(config_path, 'w') as f:
    json.dump(config, f, indent=2)

print('Config written to', config_path)
"

echo_info "OpenClaw config updated."

# ─────────────────────────────────────────────────────
# 9. Copy Clawe CLI
# ─────────────────────────────────────────────────────
if [ -f "packages/cli/dist/clawe.js" ]; then
    mkdir -p "${LOCAL_DATA_DIR}/bin"
    cp packages/cli/dist/clawe.js "${LOCAL_DATA_DIR}/bin/clawe"
    chmod +x "${LOCAL_DATA_DIR}/bin/clawe"
    echo_info "Clawe CLI → ${LOCAL_DATA_DIR}/bin/clawe"
fi

# ─────────────────────────────────────────────────────
# Done!
# ─────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Start development with:"
echo -e "  ${CYAN}pnpm dev:local${NC}"
echo ""
echo "Services:"
echo "  🌐 Web app            → http://localhost:3000"
echo "  🦞 OpenClaw dashboard → http://localhost:${GATEWAY_PORT}/?token=${TOKEN}"
echo "  📦 Convex dashboard   → http://127.0.0.1:6790"
echo "  👀 Watcher            → notification polling"
echo ""
