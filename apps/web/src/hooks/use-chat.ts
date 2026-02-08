"use client";

import { useState, useCallback, useRef } from "react";
import type {
  ChatMessage,
  ChatStatus,
  ChatAttachment,
  UseChatOptions,
  UseChatReturn,
  MessageContent,
} from "@/components/chat/types";

const REQUEST_TIMEOUT_MS = 30000;

/**
 * Internal system response patterns that should be filtered from chat.
 * These are automated cron/heartbeat responses, not real conversation.
 */
const SYSTEM_MESSAGE_PATTERNS = [
  // Exact matches (case-insensitive) - short system responses
  /^NO_REPLY$/i,
  /^REPLY_SKIP$/i,
  /^HEARTBEAT_OK$/i,
  /^OK$/i,
  // Cron heartbeat instruction (the full cron trigger message)
  /Read HEARTBEAT\.md.*follow it strictly/i,
  /Check for notifications with ['"]clawe check['"]/i,
  /If nothing needs attention.*reply HEARTBEAT_OK/i,
  // System-prefixed messages
  /^System:\s*\[\d{4}-\d{2}-\d{2}/i,
  /^Cron:/i,
  // Heartbeat status reports (contains HEARTBEAT_OK in the message)
  /HEARTBEAT_OK/i,
];

/**
 * Extract text content from a message object.
 */
function extractTextFromMessage(message: unknown): string {
  if (!message || typeof message !== "object") {
    return "";
  }

  const msg = message as { content?: unknown };
  const content = msg.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter(
        (block): block is { type: "text"; text: string } =>
          typeof block === "object" &&
          block !== null &&
          "type" in block &&
          block.type === "text" &&
          "text" in block &&
          typeof block.text === "string",
      )
      .map((block) => block.text)
      .join("");
  }

  return "";
}

/**
 * Check if text content is internal/debug content that should be hidden.
 */
function isInternalContent(text: string): boolean {
  const trimmed = text.trim();

  if (/^Thinking:\s/i.test(trimmed)) {
    return true;
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.status || parsed.tool || parsed.error || parsed.result) {
        return true;
      }
    } catch {
      // Not valid JSON, keep it
    }
  }

  if (
    trimmed.startsWith("# IDENTITY.md") ||
    trimmed.startsWith("# MEMORY.md")
  ) {
    return true;
  }

  // Check against system message patterns (heartbeat/cron)
  for (const pattern of SYSTEM_MESSAGE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  return false;
}

/**
 * Filter content blocks to only include displayable content.
 */
function filterDisplayableContent(content: unknown[]): MessageContent[] {
  return content
    .filter((block): block is MessageContent => {
      if (!block || typeof block !== "object" || !("type" in block)) {
        return false;
      }
      const blockType = (block as { type: string }).type;

      if (blockType !== "text") {
        return false;
      }

      const textBlock = block as { type: "text"; text: string };
      if (
        typeof textBlock.text === "string" &&
        isInternalContent(textBlock.text)
      ) {
        return false;
      }

      return true;
    })
    .map((block) => block as MessageContent);
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Parse raw message from API into ChatMessage format.
 */
function parseHistoryMessage(msg: unknown, index: number): ChatMessage {
  const m = msg as {
    role?: string;
    content?: unknown;
    timestamp?: number;
  };

  let content: MessageContent[];
  if (Array.isArray(m.content)) {
    content = m.content
      .filter((block: unknown) => {
        const b = block as { type?: string };
        return b.type === "text" || b.type === "image";
      })
      .map((block) => block as MessageContent);

    if (content.length === 0) {
      content = [{ type: "text", text: "" }];
    }
  } else {
    content = [{ type: "text", text: String(m.content || "") }];
  }

  const role =
    m.role === "user" || m.role === "assistant" || m.role === "system"
      ? m.role
      : "assistant";

  return {
    id: generateMessageId() + index,
    role,
    content,
    timestamp: m.timestamp || Date.now(),
  };
}

/**
 * Check if text looks like a JSON status/error message that should be hidden.
 */
function isJsonStatusMessage(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      // Filter JSON messages with status, tool, error, or result keys
      if (parsed.status || parsed.tool || parsed.error || parsed.result) {
        return true;
      }
    } catch {
      // Not valid JSON, don't filter
    }
  }
  return false;
}

/**
 * Check if a message is empty (no meaningful content).
 */
function isEmptyMessage(message: ChatMessage): boolean {
  for (const block of message.content) {
    if (block.type === "text" && block.text && block.text.trim().length > 0) {
      return false;
    }
    if (block.type === "image") {
      return false;
    }
  }
  return true;
}

/**
 * Check if a message should be filtered out entirely (heartbeat/cron/system messages).
 */
function isSystemCronMessage(message: ChatMessage): boolean {
  // Filter empty messages
  if (isEmptyMessage(message)) {
    return true;
  }

  // Check all text content in the message
  for (const block of message.content) {
    if (block.type === "text" && block.text) {
      const text = block.text.trim();

      // Filter JSON status/error messages
      if (isJsonStatusMessage(text)) {
        return true;
      }

      // Check against all system message patterns
      for (const pattern of SYSTEM_MESSAGE_PATTERNS) {
        if (pattern.test(text)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Filter out system/cron messages from the message list.
 */
function filterSystemMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter((msg) => !isSystemCronMessage(msg));
}

/**
 * Custom hook for managing chat state and communication.
 */
export function useChat({
  sessionKey,
  onError,
  onFinish,
}: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<Error | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentRunIdRef = useRef<string | null>(null);
  const streamingTextRef = useRef<string>("");
  const activeStreamIdRef = useRef<string | null>(null);

  const loadHistory = useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      const response = await fetch(
        `/api/chat/history?sessionKey=${encodeURIComponent(sessionKey)}&limit=200`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to load history");
      }

      const data = await response.json();

      // Debug: log raw messages from API
      console.log("[chat] Raw messages from API:", data.messages);

      const historyMessages = (data.messages || []).map(parseHistoryMessage);

      // Debug: log filtered messages
      const beforeCount = historyMessages.length;
      const filteredMessages = filterSystemMessages(historyMessages);
      const afterCount = filteredMessages.length;
      if (beforeCount !== afterCount) {
        console.log(
          `[chat] Filtered ${beforeCount - afterCount} system messages`,
          historyMessages.filter((m: ChatMessage) => isSystemCronMessage(m)),
        );
      }

      // Debug: log final messages
      console.log("[chat] Final messages:", filteredMessages);

      setMessages(filteredMessages);
      setStatus("idle");
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
      setStatus("error");
      onError?.(error);
    }
  }, [sessionKey, onError]);

  const handleSSEEvent = useCallback(
    (
      eventType: string,
      data: unknown,
      assistantMessageId: string,
      streamId: string,
    ) => {
      // Ignore events from stale streams
      if (activeStreamIdRef.current !== streamId) {
        return;
      }

      const eventData = data as Record<string, unknown>;

      switch (eventType) {
        case "connected":
          break;

        case "delta": {
          if (eventData.runId) {
            currentRunIdRef.current = eventData.runId as string;
          }

          const message = eventData.message as
            | { content?: unknown[] }
            | undefined;
          const rawContent = message?.content;

          const newText = extractTextFromMessage(eventData.message);
          if (newText && newText.length > streamingTextRef.current.length) {
            streamingTextRef.current = newText;
          }

          const contentBlocks: MessageContent[] = [];

          if (streamingTextRef.current) {
            contentBlocks.push({
              type: "text",
              text: streamingTextRef.current,
            });
          }

          if (Array.isArray(rawContent)) {
            for (const block of rawContent) {
              const b = block as { type?: string };
              if (
                b.type === "tool_use" ||
                b.type === "toolCall" ||
                b.type === "thinking"
              ) {
                contentBlocks.push(block as MessageContent);
              }
            }
          }

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content:
                      contentBlocks.length > 0
                        ? contentBlocks
                        : [{ type: "text", text: "" }],
                  }
                : msg,
            ),
          );
          break;
        }

        case "final": {
          const finalMessage = eventData.message as ChatMessage | undefined;
          const rawContent = finalMessage?.content;
          const filteredContent = Array.isArray(rawContent)
            ? filterDisplayableContent(rawContent)
            : [];

          setMessages((prev) => {
            // Get the current text from the message being finalized
            const currentMsg = prev.find((m) => m.id === assistantMessageId);
            const currentText =
              currentMsg?.content.find((c) => c.type === "text")?.text || "";

            const finalContent =
              filteredContent.length > 0
                ? filteredContent
                : [{ type: "text" as const, text: currentText }];

            return prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: finalContent, isStreaming: false }
                : msg,
            );
          });

          setStatus("idle");
          onFinish?.({
            id: assistantMessageId,
            role: "assistant",
            content: filteredContent,
            timestamp: Date.now(),
          });
          break;
        }

        case "error": {
          const errorMessage =
            (eventData.message as string) || "An error occurred";
          setError(new Error(errorMessage));
          setStatus("error");

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content: [{ type: "text", text: `Error: ${errorMessage}` }],
                    isStreaming: false,
                  }
                : msg,
            ),
          );
          break;
        }

        case "aborted": {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, isStreaming: false }
                : msg,
            ),
          );
          setStatus("idle");
          break;
        }
      }
    },
    [onFinish],
  );

  const sendMessage = useCallback(
    async (text: string, attachments?: ChatAttachment[]) => {
      const trimmedText = text.trim();
      if (!trimmedText && (!attachments || attachments.length === 0)) {
        return;
      }

      // Abort any existing stream before starting a new one
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      activeStreamIdRef.current = null;

      // Mark any existing streaming messages as not streaming
      setMessages((prev) =>
        prev.map((msg) =>
          msg.isStreaming ? { ...msg, isStreaming: false } : msg,
        ),
      );

      const userContent: MessageContent[] = [];
      if (trimmedText) {
        userContent.push({ type: "text", text: trimmedText });
      }
      if (attachments) {
        for (const att of attachments) {
          userContent.push({
            type: "image",
            source: {
              type: "base64",
              media_type: att.mimeType,
              data: att.dataUrl.replace(/^data:[^;]+;base64,/, ""),
            },
          });
        }
      }

      const userMessage: ChatMessage = {
        id: generateMessageId(),
        role: "user",
        content: userContent,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setStatus("loading");
      setError(null);
      streamingTextRef.current = "";

      abortControllerRef.current = new AbortController();

      const timeoutId = setTimeout(() => {
        setError(new Error("Request timed out. Please try again."));
        setStatus("error");
        abortControllerRef.current?.abort();
      }, REQUEST_TIMEOUT_MS);

      try {
        const body = {
          sessionKey,
          message: trimmedText,
          attachments: attachments?.map((att) => ({
            type: "image",
            mimeType: att.mimeType,
            content: att.dataUrl.replace(/^data:[^;]+;base64,/, ""),
          })),
        };

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to send message");
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const assistantMessageId = generateMessageId();
        const streamId = assistantMessageId; // Use same ID to track the stream
        activeStreamIdRef.current = streamId;

        const assistantMessage: ChatMessage = {
          id: assistantMessageId,
          role: "assistant",
          content: [{ type: "text", text: "" }],
          timestamp: Date.now(),
          isStreaming: true,
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setStatus("streaming");
        clearTimeout(timeoutId);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Check if this stream is still active
          if (activeStreamIdRef.current !== streamId) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let eventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7);
            } else if (line.startsWith("data: ") && eventType) {
              try {
                const data = JSON.parse(line.slice(6));
                handleSSEEvent(eventType, data, assistantMessageId, streamId);
              } catch {
                // Ignore parse errors
              }
              eventType = "";
            }
          }
        }
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        setStatus("error");
        onError?.(error);
      } finally {
        clearTimeout(timeoutId);
        abortControllerRef.current = null;
        currentRunIdRef.current = null;
      }
    },
    [sessionKey, onError, handleSSEEvent],
  );

  const abort = useCallback(async () => {
    abortControllerRef.current?.abort();
    activeStreamIdRef.current = null;

    // Mark any streaming messages as not streaming
    setMessages((prev) =>
      prev.map((msg) =>
        msg.isStreaming ? { ...msg, isStreaming: false } : msg,
      ),
    );

    try {
      await fetch("/api/chat/abort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionKey,
          runId: currentRunIdRef.current,
        }),
      });
    } catch {
      // Ignore abort errors
    }

    setStatus("idle");
  }, [sessionKey]);

  return {
    messages,
    input,
    setInput,
    status,
    error,
    sendMessage,
    loadHistory,
    abort,
    isLoading: status === "loading",
    isStreaming: status === "streaming",
  };
}
