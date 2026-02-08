// Chat Types - simplified for Vercel AI SDK

export type ChatStatus = "idle" | "loading" | "streaming" | "error";

export type MessageRole = "user" | "assistant" | "system";

export type ChatAttachment = {
  id: string;
  file: File;
  dataUrl: string;
  mimeType: string;
  name: string;
};

export type ChatConfig = {
  sessionKey: string;
};
