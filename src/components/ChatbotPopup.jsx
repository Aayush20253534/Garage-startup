import { useState } from "react";
import { FiX, FiSend } from "react-icons/fi";

export default function ChatbotPopup({ onClose }) {
  const [messages, setMessages] = useState([
    { from: "bot", text: "Hi there! How can I help you today?" }
  ]);
  const [inputText, setInputText] = useState("");

  const sendMessage = () => {
    if (!inputText.trim()) return;

    const newMessages = [...messages, { from: "user", text: inputText.trim() }];
    setMessages(newMessages);
    setInputText("");

    setTimeout(() => {
      let reply = "Thanks for reaching out! Our team will assist you shortly.";
      if (inputText.toLowerCase().includes("sos") || inputText.toLowerCase().includes("emergency")) {
        reply = "Please go to Roadside Assistance in our services to get instant help!";
      } else if (inputText.toLowerCase().includes("service")) {
        reply = "Great! You can book a service from our Services page!";
      }
      setMessages([...newMessages, { from: "bot", text: reply }]);
    }, 800);
  };

  return (
    <div className="fixed bottom-28 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
      <div className="bg-[#b9f000] text-[#111] px-5 py-4 flex items-center justify-between">
        <div className="font-semibold text-lg">Rovauto Assistant</div>
        <button onClick={onClose} className="hover:bg-black/10 rounded-full p-1">
          <FiX className="text-xl" />
        </button>
      </div>
      <div className="h-80 overflow-y-auto bg-gray-50 p-4 flex flex-col gap-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[80%] p-3 rounded-2xl ${
              msg.from === "bot"
                ? "bg-gray-200 self-start rounded-tl-none"
                : "bg-[#b9f000] text-[#111] self-end rounded-tr-none"
            }`}
          >
            {msg.text}
          </div>
        ))}
      </div>
      <div className="p-3 bg-white border-t border-gray-200 flex gap-2">
        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message..."
          className="flex-1 border border-gray-300 rounded-full px-4 py-2 outline-none focus:border-[#b9f000]"
        />
        <button
          onClick={sendMessage}
          className="w-10 h-10 bg-[#b9f000] rounded-full flex items-center justify-center hover:opacity-90 transition"
        >
          <FiSend className="text-[#111]" />
        </button>
      </div>
    </div>
  );
}
