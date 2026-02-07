import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutoScroll } from "./use-auto-scroll";

describe("useAutoScroll", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a real DOM element for testing
    container = document.createElement("div");
    Object.defineProperties(container, {
      scrollHeight: { value: 1000, configurable: true },
      clientHeight: { value: 500, configurable: true },
      scrollTop: { value: 0, writable: true, configurable: true },
    });
    container.scrollTo = vi.fn();
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe("initial state", () => {
    it("returns correct initial values", () => {
      const { result } = renderHook(() => useAutoScroll());

      expect(result.current.scrollRef.current).toBeNull();
      expect(result.current.isAtBottom).toBe(true);
      expect(result.current.showScrollButton).toBe(false);
      expect(typeof result.current.scrollToBottom).toBe("function");
    });
  });

  describe("scrollToBottom", () => {
    it("calls scrollTo with smooth behavior by default", () => {
      const { result } = renderHook(() => useAutoScroll());

      // Assign the real DOM element to the ref
      Object.defineProperty(result.current.scrollRef, "current", {
        value: container,
        writable: true,
      });

      act(() => {
        result.current.scrollToBottom();
      });

      expect(container.scrollTo).toHaveBeenCalledWith({
        top: 1000,
        behavior: "smooth",
      });
    });

    it("accepts custom behavior parameter", () => {
      const { result } = renderHook(() => useAutoScroll());

      Object.defineProperty(result.current.scrollRef, "current", {
        value: container,
        writable: true,
      });

      act(() => {
        result.current.scrollToBottom("instant");
      });

      expect(container.scrollTo).toHaveBeenCalledWith({
        top: 1000,
        behavior: "instant",
      });
    });
  });

  describe("options", () => {
    it("accepts custom threshold", () => {
      const { result } = renderHook(() => useAutoScroll({ threshold: 50 }));

      expect(result.current.isAtBottom).toBe(true);
    });

    it("can be disabled", () => {
      const { result } = renderHook(() => useAutoScroll({ enabled: false }));

      expect(result.current.isAtBottom).toBe(true);
    });
  });
});
