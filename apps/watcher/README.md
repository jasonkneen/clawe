# @clawe/watcher

Notification watcher for Clawe multi-agent coordination.

## What It Does

The watcher continuously polls Convex for undelivered notifications and delivers them to agent sessions via OpenClaw's `sessions_send` API.

This enables near-instant notification delivery without agents having to wait for their heartbeat.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CONVEX_URL` | Yes | Convex deployment URL |
| `OPENCLAW_URL` | Yes | OpenClaw gateway URL |
| `OPENCLAW_TOKEN` | Yes | OpenClaw authentication token |

## Running

```bash
# Development (with hot reload)
pnpm dev

# Production
pnpm build
pnpm start
```

## How It Works

1. Every 2 seconds, the watcher:
   - Fetches all registered agents from Convex
   - For each agent, queries for undelivered notifications
   - Attempts to deliver each notification via `sessions_send`
   - If successful, marks the notification as delivered

2. If an agent is "asleep" (between heartbeats), the delivery fails gracefully and the notification remains queued for the next attempt.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    WATCHER                                │
│                                                          │
│   ┌─────────────┐        ┌─────────────────────────┐   │
│   │ Poll Loop   │───────>│ convex.query(           │   │
│   │ (every 2s)  │        │   notifications.        │   │
│   └──────┬──────┘        │   getUndelivered)       │   │
│          │               └─────────────────────────┘   │
│          │                                              │
│          │               ┌─────────────────────────┐   │
│          └──────────────>│ openclaw.sessionsSend() │   │
│                          └─────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
            │                           │
            ▼                           ▼
     ┌───────────┐              ┌───────────────┐
     │  CONVEX   │              │   OPENCLAW    │
     │  (data)   │              │  (delivery)   │
     └───────────┘              └───────────────┘
```
