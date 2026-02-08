import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatMessage } from "./chat-message";
import type { Message } from "@/hooks/use-chat";

describe("ChatMessage", () => {
  it("renders user message", () => {
    const message: Message = {
      id: "1",
      role: "user",
      content: "Hello",
    };

    render(<ChatMessage message={message} />);

    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders assistant message", () => {
    const message: Message = {
      id: "2",
      role: "assistant",
      content: "Hi there!",
    };

    render(<ChatMessage message={message} />);

    expect(screen.getByText("Hi there!")).toBeInTheDocument();
  });

  it("shows timestamp when createdAt is set", () => {
    const message: Message = {
      id: "1",
      role: "user",
      content: "Hello",
      createdAt: new Date("2024-01-15T10:30:00"),
    };

    render(<ChatMessage message={message} />);

    expect(screen.getByText(/10:30/)).toBeInTheDocument();
  });

  it("hides timestamp when createdAt is not set", () => {
    const message: Message = {
      id: "1",
      role: "assistant",
      content: "Hello",
    };

    render(<ChatMessage message={message} />);

    const timestamps = screen.queryAllByText(/\d{1,2}:\d{2}/);
    expect(timestamps).toHaveLength(0);
  });
});
