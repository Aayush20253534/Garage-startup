import "./CustomerLoginLoader.css";

export default function CustomerLoginLoader({
  visible,
  eyebrow = "ROVAUTO DRIVE",
  title = "Your drive is ready",
  message = "Signing you in and preparing your service dashboard.",
}) {
  if (!visible) return null;

  return (
    <div
      className="customer-login-loader"
      role="status"
      aria-live="polite"
      aria-label={`${title}. ${message}`}
    >
      <div className="customer-login-loader__glow" aria-hidden="true" />
      <div className="customer-login-loader__content">
        <p className="customer-login-loader__eyebrow">{eyebrow}</p>

        <div className="customer-login-loader__track" aria-hidden="true">
          <div className="customer-login-loader__horizon" />
          <div className="customer-login-loader__runner">
            <span className="customer-login-loader__smoke customer-login-loader__smoke--one" />
            <span className="customer-login-loader__smoke customer-login-loader__smoke--two" />
            <span className="customer-login-loader__smoke customer-login-loader__smoke--three" />
            <span className="customer-login-loader__smoke customer-login-loader__smoke--four" />
            <span className="customer-login-loader__smoke customer-login-loader__smoke--five" />

            <svg
              className="customer-login-loader__car"
              viewBox="0 0 260 124"
              focusable="false"
            >
              <defs>
                <linearGradient id="loginCarPaint" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#d8ff51" />
                  <stop offset="0.58" stopColor="#b9f000" />
                  <stop offset="1" stopColor="#8fbd00" />
                </linearGradient>
                <linearGradient id="loginCarGlass" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#f8fdff" />
                  <stop offset="1" stopColor="#9ed8eb" />
                </linearGradient>
              </defs>
              <ellipse cx="134" cy="108" rx="105" ry="8" fill="#0f172a" opacity="0.14" />
              <path
                d="M27 75h17l22-34c6-9 15-14 26-14h68c13 0 24 5 32 15l21 27 19 5c9 3 15 10 15 20v8H14V90c0-8 5-14 13-15Z"
                fill="url(#loginCarPaint)"
                stroke="#0f172a"
                strokeWidth="5.5"
                strokeLinejoin="round"
              />
              <path
                d="m86 43-17 26h119l-21-26c-4-5-9-7-15-7H99c-5 0-10 2-13 7Z"
                fill="url(#loginCarGlass)"
                stroke="#0f172a"
                strokeWidth="4"
                strokeLinejoin="round"
              />
              <path d="M128 36v33" stroke="#0f172a" strokeWidth="4" />
              <path d="M96 37 83 68" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.75" />
              <path
                d="M218 72h14c9 3 15 10 15 20v10h-22"
                fill="#f8fafc"
                stroke="#0f172a"
                strokeWidth="5.5"
                strokeLinejoin="round"
              />
              <path
                d="M20 82h22"
                stroke="#0f172a"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <path d="M15 95h20" stroke="#0f172a" strokeWidth="5" strokeLinecap="round" />
              <path d="M214 84h25" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" />
              <path d="M213 84h14" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
              <g className="customer-login-loader__wheel customer-login-loader__wheel--rear">
                <circle cx="72" cy="101" r="20" fill="#0f172a" />
                <circle cx="72" cy="101" r="10" fill="#f8fafc" stroke="#64748b" strokeWidth="3" />
                <path d="M72 92v18M63 101h18" stroke="#64748b" strokeWidth="2.5" />
              </g>
              <g className="customer-login-loader__wheel customer-login-loader__wheel--front">
                <circle cx="197" cy="101" r="20" fill="#0f172a" />
                <circle cx="197" cy="101" r="10" fill="#f8fafc" stroke="#64748b" strokeWidth="3" />
                <path d="M197 92v18M188 101h18" stroke="#64748b" strokeWidth="2.5" />
              </g>
              <path
                d="M145 80h20"
                stroke="#0f172a"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <path d="M121 74v23M130 74v23" stroke="#0f172a" strokeWidth="2" opacity="0.22" />
            </svg>
          </div>

          <div className="customer-login-loader__road">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>

        <p className="customer-login-loader__title">{title}</p>
        <p className="customer-login-loader__message">{message}</p>
        <div className="customer-login-loader__progress" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
