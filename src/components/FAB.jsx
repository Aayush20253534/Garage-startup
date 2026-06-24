import { useState } from "react";
import { FiX, FiMessageCircle, FiPhone, FiMessageSquare } from "react-icons/fi";
import ChatbotPopup from "./ChatbotPopup";

export default function FAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const handleChat = () => {
    setIsOpen(false);
    setShowChat(true);
  };

  const handleCall = () => {
    window.location.href = "tel:+919000000000";
    setIsOpen(false);
  };

  const handleWhatsApp = () => {
    window.location.href = "https://wa.me/919000000000";
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Options Menu */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 bg-white rounded-2xl shadow-2xl p-4 w-56 flex flex-col gap-3">
          <button onClick={handleChat} className="flex items-center gap-3 p-3 hover:bg-gray-100 rounded-xl transition-all">
            <FiMessageCircle className="text-xl text-gray-700" />
            <span className="font-medium text-gray-800">Chat bot</span>
          </button>
          <button onClick={handleCall} className="flex items-center gap-3 p-3 hover:bg-gray-100 rounded-xl transition-all">
            <FiPhone className="text-xl text-gray-700" />
            <span className="font-medium text-gray-800">Call support</span>
          </button>
          <button onClick={handleWhatsApp} className="flex items-center gap-3 p-3 hover:bg-gray-100 rounded-xl transition-all">
            <FiMessageSquare className="text-xl text-gray-700" />
            <span className="font-medium text-gray-800">WhatsApp</span>
          </button>
        </div>
      )}

      {/* Chatbot Popup */}
      {showChat && <ChatbotPopup onClose={() => setShowChat(false)} />}

      {/* Main Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 rounded-full bg-white border-4 border-[#b9f000] shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
      >
        {isOpen ? <FiX className="text-3xl text-gray-700" /> : <FiMessageCircle className="text-3xl text-gray-700" />}
      </button>
    </div>
  );
}
