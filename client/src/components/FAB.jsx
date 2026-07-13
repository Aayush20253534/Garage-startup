import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  FiHeadphones,
  FiMessageCircle,
  FiMessageSquare,
  FiPhone,
  FiX,
} from "react-icons/fi";

const ChatbotPopup = lazy(() => import("./ChatbotPopup"));

const SUPPORT_PHONE = "8619955850";
const SUPPORT_PHONE_WITH_COUNTRY = `+91${SUPPORT_PHONE}`;

const supportOptions = [
  {
    label: "Chat with Rovauto",
    description: "Instant answers and booking help",
    icon: FiMessageCircle,
    action: "chat",
  },
  {
    label: "Call support",
    description: "Speak directly with our team",
    icon: FiPhone,
    action: "call",
  },
  {
    label: "WhatsApp",
    description: "Continue the conversation there",
    icon: FiMessageSquare,
    action: "whatsapp",
  },
];

export default function FAB() {
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const hasMobileBookingBar = pathname === "/booking/services";
  const hideOnGarageRequestFlow =
    pathname === "/garage/login" ||
    pathname.startsWith("/garage/magic/") ||
    pathname.startsWith("/garage/requests/");

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  const handleAction = (action) => {
    setIsOpen(false);

    if (action === "chat") {
      setShowChat(true);
      return;
    }

    if (action === "call") {
      window.location.href = `tel:${SUPPORT_PHONE_WITH_COUNTRY}`;
      return;
    }

    window.open(
      `https://wa.me/91${SUPPORT_PHONE}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  if (hideOnGarageRequestFlow) return null;

  return (
    <>
      {showChat && (
        <Suspense fallback={null}>
          <ChatbotPopup onClose={() => setShowChat(false)} />
        </Suspense>
      )}

      {!showChat && (
        <div
          className={`fixed right-4 sm:bottom-6 sm:right-6 sm:z-40 ${
            hasMobileBookingBar
              ? "bottom-[calc(env(safe-area-inset-bottom)+6.75rem)] z-20"
              : "bottom-5 z-40"
          }`}
        >
          {isOpen && (
            <>
              <button
                type="button"
                aria-label="Close support menu"
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 z-[-1] cursor-default bg-black/10 backdrop-blur-[1px]"
              />

              <div className="absolute bottom-[68px] right-0 w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.2)]">
                <div className="border-b border-slate-100 px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-ink">
                      <FiHeadphones />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-ink">Need help?</p>
                      <p className="text-xs text-slate-500">
                        Choose how you’d like to reach us.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-2">
                  {supportOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.action}
                        type="button"
                        onClick={() => handleAction(option.action)}
                        className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50"
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition group-hover:border-brand-dark group-hover:bg-brand/15 group-hover:text-ink">
                          <Icon className="text-lg" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-slate-800">
                            {option.label}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {option.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <button
            type="button"
            aria-label={isOpen ? "Close support options" : "Open support options"}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((current) => !current)}
            className="relative grid h-14 w-14 place-items-center rounded-2xl border border-white/20 bg-ink text-white shadow-[0_12px_32px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 hover:bg-ink-soft focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
          >
            <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-ink bg-brand" />
            {isOpen ? (
              <FiX className="text-2xl" />
            ) : (
              <FiMessageCircle className="text-2xl" />
            )}
          </button>
        </div>
      )}
    </>
  );
}
