#!/bin/sh
set -e

# Clawe Agent Initialization Script
# This script initializes agent workspaces and shared state on first run

TEMPLATES_DIR="/opt/clawe/templates"
DATA_DIR="/data"

echo "🦞 Initializing Clawe agents..."

# Create shared directory
if [ ! -d "$DATA_DIR/shared" ]; then
    echo "  → Creating shared directory..."
    mkdir -p "$DATA_DIR/shared"
    cp -r "$TEMPLATES_DIR/shared/"* "$DATA_DIR/shared/"
    echo "  ✓ Shared state initialized"
else
    echo "  → Shared directory exists, skipping"
fi

# Initialize Clawe (lead) workspace
if [ ! -d "$DATA_DIR/workspace" ]; then
    echo "  → Creating Clawe workspace..."
    mkdir -p "$DATA_DIR/workspace/memory"
    cp -r "$TEMPLATES_DIR/workspaces/clawe/"* "$DATA_DIR/workspace/"
    ln -sf "$DATA_DIR/shared" "$DATA_DIR/workspace/shared"
    echo "  ✓ Clawe workspace initialized"
else
    echo "  → Clawe workspace exists, skipping"
fi

# Initialize Inky (writer) workspace
if [ ! -d "$DATA_DIR/workspace-inky" ]; then
    echo "  → Creating Inky workspace..."
    mkdir -p "$DATA_DIR/workspace-inky/memory"
    cp -r "$TEMPLATES_DIR/workspaces/inky/"* "$DATA_DIR/workspace-inky/"
    ln -sf "$DATA_DIR/shared" "$DATA_DIR/workspace-inky/shared"
    echo "  ✓ Inky workspace initialized"
else
    echo "  → Inky workspace exists, skipping"
fi

# Initialize Pixel (designer) workspace
if [ ! -d "$DATA_DIR/workspace-pixel" ]; then
    echo "  → Creating Pixel workspace..."
    mkdir -p "$DATA_DIR/workspace-pixel/memory"
    mkdir -p "$DATA_DIR/workspace-pixel/assets"
    cp -r "$TEMPLATES_DIR/workspaces/pixel/"* "$DATA_DIR/workspace-pixel/"
    ln -sf "$DATA_DIR/shared" "$DATA_DIR/workspace-pixel/shared"
    echo "  ✓ Pixel workspace initialized"
else
    echo "  → Pixel workspace exists, skipping"
fi

# Initialize Scout (SEO) workspace
if [ ! -d "$DATA_DIR/workspace-scout" ]; then
    echo "  → Creating Scout workspace..."
    mkdir -p "$DATA_DIR/workspace-scout/memory"
    mkdir -p "$DATA_DIR/workspace-scout/research"
    cp -r "$TEMPLATES_DIR/workspaces/scout/"* "$DATA_DIR/workspace-scout/"
    ln -sf "$DATA_DIR/shared" "$DATA_DIR/workspace-scout/shared"
    echo "  ✓ Scout workspace initialized"
else
    echo "  → Scout workspace exists, skipping"
fi

echo "✅ Agent initialization complete!"
echo ""
echo "Squad:"
echo "  🦞 Clawe (Lead)      → $DATA_DIR/workspace"
echo "  ✍️ Inky (Writer)     → $DATA_DIR/workspace-inky"
echo "  🎨 Pixel (Designer)  → $DATA_DIR/workspace-pixel"
echo "  🔍 Scout (SEO)       → $DATA_DIR/workspace-scout"
echo ""
