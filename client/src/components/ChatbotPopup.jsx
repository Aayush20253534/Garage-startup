import { useEffect, useRef, useState } from "react";
import { FiTrash2, FiX, FiSend } from "react-icons/fi";
import api from "@/api/axios";

const welcomeMessage = {
  from: "bot",
  text:
    "Hi, I am Rovauto Assistant. Ask me about booking, location, vehicles, payments, SOS, complaints, or tracking.",
};

export default function ChatbotPopup({ onClose }) {
  const [messages, setMessages] = useState([welcomeMessage]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const scrollRef = useRef(null);

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
            }))
          );
        }
      } catch (error) {
        if (error.response?.status !== 401) {
          setMessages((current) => [
            ...current,
            {
              from: "bot",
              text: "I could not load your previous chat right now, but you can still ask me a new question.",
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

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending, isLoadingHistory]);

  const sendMessage = async () => {
    const question = inputText.trim();
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
        "I could not generate an answer right now. Please try again.";

      setMessages((current) => [...current, { from: "bot", text: reply }]);
    } catch (error) {
      const status = error.response?.status;
      const reply =
        status === 401
          ? "Please login as a customer so I can help with your Rovauto account."
          : error.response?.data?.message ||
            "I am having trouble connecting right now. Please try again in a moment.";

      setMessages((current) => [...current, { from: "bot", text: reply }]);
    } finally {
      setIsSending(false);
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
          text: error.response?.data?.message || "Could not clear chat history right now.",
        },
      ]);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="fixed bottom-28 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] max-w-96 bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
      <div className="bg-[#b9f000] text-[#111] px-5 py-4 flex items-center justify-between">
        <div className="font-semibold text-lg">Rovauto Assistant</div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={clearHistory}
            disabled={isClearing || isSending}
            title="Clear chat history"
            className="hover:bg-black/10 rounded-full p-1 disabled:opacity-50"
          >
            <FiTrash2 className="text-lg" />
          </button>
          <button type="button" onClick={onClose} className="hover:bg-black/10 rounded-full p-1">
            <FiX className="text-xl" />
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="h-80 overflow-y-auto bg-gray-50 p-4 flex flex-col gap-3">
        {isLoadingHistory && (
          <div className="max-w-[80%] p-3 rounded-2xl bg-gray-200 self-start rounded-tl-none text-sm text-muted">
            Loading previous chat...
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
              msg.from === "bot"
                ? "bg-gray-200 self-start rounded-tl-none"
                : "bg-[#b9f000] text-[#111] self-end rounded-tr-none"
            }`}
          >
            {msg.text}
          </div>
        ))}
        {isSending && (
          <div className="max-w-[80%] p-3 rounded-2xl bg-gray-200 self-start rounded-tl-none text-sm text-muted">
            Thinking...
          </div>
        )}
      </div>
      <div className="p-3 bg-white border-t border-gray-200 flex gap-2">
        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask about your service..."
          disabled={isSending}
          className="flex-1 border border-gray-300 rounded-full px-4 py-2 outline-none focus:border-[#b9f000]"
        />
        <button
          type="button"
          onClick={sendMessage}
          disabled={isSending || !inputText.trim()}
          className="w-10 h-10 bg-[#b9f000] rounded-full flex items-center justify-center hover:opacity-90 transition disabled:opacity-50"
        >
          <FiSend className="text-[#111]" />
        </button>
      </div>
    </div>
  );
}
