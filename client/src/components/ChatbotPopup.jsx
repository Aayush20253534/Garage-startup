import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  FiChevronRight,
  FiSend,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import api from "@/api/axios";

const welcomeMessage = {
  from: "bot",
  text: "Hi, I’m the Rovauto Assistant. I can help with bookings, vehicles, payments, garage search, service tracking, warranty, SOS, and support. Never share an OTP, password, card detail, or account token here.",
};

const quickPrompts = [
  "How do I book a service?",
  "Where is my booking?",
  "Help with a payment",
];

export default function ChatbotPopup({ onClose }) {
  const [messages, setMessages] = useState([welcomeMessage]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const scrollFrameRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      try {
        const response = await api.get("/chatbot/history");
        const savedMessages = response.data?.data?.messages || [];

        if (isMounted && savedMessages.length) {
          setMessages(
            savedMessages.map((message) => ({
              from: message.from,
              text: message.text,
            })),
          );
        }
      } catch (error) {
        if (error.response?.status !== 401) {
          setMessages((current) => [
            ...current,
            {
              from: "bot",
              text: "I couldn’t load your previous conversation, but you can still start a new one.",
            },
          ]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingHistory(false);
        }
      }
    };

    loadHistory();
    window.setTimeout(() => inputRef.current?.focus(), 120);

    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      isMounted = false;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  useLayoutEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return undefined;

    if (scrollFrameRef.current) {
      window.cancelAnimationFrame(scrollFrameRef.current);
    }

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    });

    return () => {
      if (scrollFrameRef.current) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, [messages, isSending, isLoadingHistory]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const sendMessage = async (presetQuestion) => {
    const question = (presetQuestion ?? inputText).trim();
    if (!question || isSending) return;

    const newMessages = [...messages, { from: "user", text: question }];
    setMessages(newMessages);
    setInputText("");
    setIsSending(true);

    try {
      const history = newMessages.slice(-10).map((message) => ({
        role: message.from === "bot" ? "assistant" : "user",
        content: message.text,
      }));

      const response = await api.post("/chatbot/ask", {
        message: question,
        history,
      });

      const reply =
        response.data?.data?.answer ||
        "I couldn’t generate an answer right now. Please try again.";

      setMessages((current) => [...current, { from: "bot", text: reply }]);
    } catch (error) {
      const status = error.response?.status;
      const reply =
        status === 401
          ? "Please sign in as a customer so I can help with your Rovauto account."
          : error.response?.data?.message ||
            "I’m having trouble connecting right now. Please try again in a moment.";

      setMessages((current) => [...current, { from: "bot", text: reply }]);
    } finally {
      setIsSending(false);
      window.setTimeout(() => inputRef.current?.focus(), 80);
    }
  };

  const clearHistory = async () => {
    if (isClearing || isSending) return;

    setIsClearing(true);
    try {
      await api.delete("/chatbot/history");
      setMessages([welcomeMessage]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          from: "bot",
          text:
            error.response?.data?.message ||
            "I couldn’t clear the conversation right now.",
        },
      ]);
    } finally {
      setIsClearing(false);
    }
  };

  const handleInputKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const showQuickPrompts =
    !isLoadingHistory && messages.length === 1 && !isSending;

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Rovauto Assistant"
      className="fixed inset-0 z-50 flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-white sm:inset-x-auto sm:bottom-6 sm:left-auto sm:right-6 sm:top-auto sm:h-[min(680px,calc(100dvh-3rem))] sm:w-[420px] sm:rounded-[24px] sm:border sm:border-slate-200 sm:shadow-[0_24px_80px_rgba(15,23,42,0.24)]"
    >
      <header className="relative shrink-0 overflow-hidden bg-ink px-3.5 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-white sm:px-5 sm:py-4">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand to-transparent opacity-80" />
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand font-display text-base font-extrabold text-black sm:h-11 sm:w-11 sm:rounded-2xl sm:text-lg">
              R
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-ink bg-emerald-400" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold sm:text-lg">
                Rovauto Assistant
              </h2>
              <p className="mt-0.5 hidden items-center gap-1.5 text-xs text-slate-300 min-[380px]:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Online · Typically replies instantly
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={clearHistory}
              disabled={isClearing || isSending}
              aria-label="Clear conversation"
              title="Clear conversation"
              className="grid h-9 w-9 place-items-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FiTrash2 className="text-base" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close assistant"
              className="grid h-9 w-9 place-items-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <FiX className="text-xl" />
            </button>
          </div>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-slate-50/80 px-3.5 py-4 sm:space-y-4 sm:px-5 sm:py-5 sm:pb-6"
      >
        {isLoadingHistory && (
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand-dark" />
            Loading your conversation…
          </div>
        )}

        {messages.map((message, index) => {
          const isBot = message.from === "bot";

          return (
            <div
              key={`${message.from}-${index}`}
              className={`flex items-end gap-2 ${isBot ? "justify-start" : "justify-end"}`}
            >
              {isBot && (
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-ink text-[11px] font-extrabold text-brand">
                  R
                </div>
              )}
              <div
                className={[
                  "max-w-[86%] break-words whitespace-pre-line px-3 py-2.5 text-[13px] leading-5 shadow-sm sm:max-w-[82%] sm:px-4 sm:py-3 sm:text-sm sm:leading-6",
                  isBot
                    ? "rounded-2xl rounded-bl-md border border-slate-200 bg-white text-slate-700"
                    : "rounded-2xl rounded-br-md bg-ink text-white",
                ].join(" ")}
              >
                {message.text}
              </div>
            </div>
          );
        })}

        {showQuickPrompts && (
          <div className="pl-0 sm:pl-9">
            <p className="mb-2 hidden text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 sm:block">
              Common questions
            </p>
            <div className="grid w-full grid-cols-1 gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:rounded-xl sm:px-3.5"
                >
                  <span>{prompt}</span>
                  <FiChevronRight className="shrink-0 text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {isSending && (
          <div className="flex items-end gap-2">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-ink text-[11px] font-extrabold text-brand">
              R
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
            </div>
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-slate-200 bg-white px-2.5 pb-[calc(env(safe-area-inset-bottom)+0.625rem)] pt-2.5 sm:p-4">
        <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-slate-50 p-1.5 transition focus-within:border-ink focus-within:bg-white focus-within:ring-4 focus-within:ring-slate-100">
          <textarea
            ref={inputRef}
            rows={1}
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Type your question…"
            disabled={isSending}
            className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={() => sendMessage()}
            disabled={isSending || !inputText.trim()}
            aria-label="Send message"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-black shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            <FiSend className="text-base" />
          </button>
        </div>
        <p className="mt-2 hidden text-center text-[10px] leading-4 text-slate-400 sm:block">
          Never share OTPs, passwords, card details, or account tokens. For
          urgent road help, use SOS or Call support.
        </p>
      </footer>
    </section>
  );
}
