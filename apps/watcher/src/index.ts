/**
 * Clawe Notification Watcher
 *
 * Polls Convex for undelivered notifications and delivers them to agent sessions
 * via OpenClaw's sessions_send API.
 *
 * Environment variables:
 *   CONVEX_URL        - Convex deployment URL
 *   OPENCLAW_URL      - OpenClaw gateway URL
 *   OPENCLAW_TOKEN    - OpenClaw authentication token
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@clawe/backend";
import { sessionsSend } from "@clawe/shared/openclaw";
import { validateEnv, config, POLL_INTERVAL_MS } from "./config.js";

// Validate environment on startup
validateEnv();

const convex = new ConvexHttpClient(config.convexUrl);

/**
 * Format a notification for delivery to an agent
 */
function formatNotification(notification: {
  content: string;
  sourceAgent?: { name: string } | null;
  task?: { title: string; status: string } | null;
}): string {
  const parts: string[] = [];

  if (notification.sourceAgent?.name) {
    parts.push(`📨 From ${notification.sourceAgent.name}:`);
  } else {
    parts.push("📨 Notification:");
  }

  parts.push(notification.content);

  if (notification.task) {
    parts.push(`\n📋 Task: ${notification.task.title} (${notification.task.status})`);
  }

  return parts.join("\n");
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Deliver notifications to a single agent
 */
async function deliverToAgent(sessionKey: string): Promise<void> {
  try {
    // Get undelivered notifications for this agent
    const notifications = await convex.query(api.notifications.getUndelivered, {
      sessionKey,
    });

    if (notifications.length === 0) {
      return;
    }

    console.log(`[watcher] 📬 ${sessionKey} has ${notifications.length} pending notification(s)`);

    for (const notification of notifications) {
      try {
        // Format the notification message
        const message = formatNotification(notification);

        // Try to deliver to agent session
        const result = await sessionsSend(sessionKey, message, 10);

        if (result.ok) {
          // Mark as delivered in Convex
          await convex.mutation(api.notifications.markDelivered, {
            notificationIds: [notification._id],
          });

          console.log(
            `[watcher] ✅ Delivered to ${sessionKey}: ${notification.content.slice(0, 50)}...`
          );
        } else {
          // Agent might be asleep or session unavailable
          console.log(
            `[watcher] 💤 ${sessionKey} unavailable: ${result.error?.message ?? "unknown error"}`
          );
        }
      } catch (err) {
        // Network error or agent asleep
        console.log(
          `[watcher] 💤 ${sessionKey} error: ${err instanceof Error ? err.message : "unknown"}`
        );
      }
    }
  } catch (err) {
    console.error(`[watcher] Error checking ${sessionKey}:`, err instanceof Error ? err.message : err);
  }
}

/**
 * Main delivery loop
 */
async function deliveryLoop(): Promise<void> {
  // Get all registered agents from Convex
  const agents = await convex.query(api.agents.list, {});

  for (const agent of agents) {
    if (agent.sessionKey) {
      await deliverToAgent(agent.sessionKey);
    }
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log("[watcher] 🦞 Clawe Notification Watcher starting...");
  console.log(`[watcher] Convex: ${config.convexUrl}`);
  console.log(`[watcher] OpenClaw: ${config.openclawUrl}`);
  console.log(`[watcher] Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log("[watcher] Starting delivery loop...\n");

  // Main loop
  while (true) {
    try {
      await deliveryLoop();
    } catch (err) {
      console.error("[watcher] Loop error:", err instanceof Error ? err.message : err);
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

// Start the watcher
main().catch((err) => {
  console.error("[watcher] Fatal error:", err);
  process.exit(1);
});
