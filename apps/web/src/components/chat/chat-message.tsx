"use client";

import { Bot, User, Info } from "lucide-react";
import { cn } from "@clawe/ui/lib/utils";
import type { Message } from "@/hooks/use-chat";

/**
 * Context message patterns - messages injected by OpenClaw for context.
 */
const CONTEXT_MESSAGE_PATTERNS = [
  /^\[Chat messages since your last reply/i,
  /\[Current message - respond to this\]/i,
];

const isContextMessage = (content: string): boolean => {
  return CONTEXT_MESSAGE_PATTERNS.some((pattern) => pattern.test(content));
};

export type ChatMessageProps = {
  message: Message;
  className?: string;
};

export const ChatMessage = ({ message, className }: ChatMessageProps) => {
  const isUser = message.role === "user";
  const isContext = isContextMessage(message.content);

  // Context/System messages - centered, subtle design
  if (isContext) {
    return (
      <div className={cn("flex justify-center px-4 py-2", className)}>
        <div className="border-border/50 bg-muted/30 flex max-w-[90%] items-start gap-2 rounded-lg border border-dashed px-4 py-3">
          <Info className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase">
              Context
            </span>
            <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
        className,
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          "flex max-w-[80%] flex-col gap-1",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-2",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground",
          )}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Timestamp */}
        {message.createdAt && (
          <span className="text-muted-foreground px-1 text-xs">
            {formatTime(message.createdAt)}
          </span>
        )}
      </div>
    </div>
  );
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};
