import "./CustomerLoginLoader.css";

export default function CustomerLoginLoader({ visible }) {
  if (!visible) return null;

  return (
    <div
      className="customer-login-loader"
      role="status"
      aria-live="polite"
      aria-label="Logging in to Rovauto"
    >
      <div className="customer-login-loader__content">
        <div className="customer-login-loader__track" aria-hidden="true">
          <div className="customer-login-loader__runner">
            <span className="customer-login-loader__smoke customer-login-loader__smoke--one" />
            <span className="customer-login-loader__smoke customer-login-loader__smoke--two" />
            <span className="customer-login-loader__smoke customer-login-loader__smoke--three" />

            <svg
              className="customer-login-loader__car"
              viewBox="0 0 240 112"
              focusable="false"
            >
              <path
                d="M34 70h15l19-30c5-8 13-13 23-13h62c12 0 22 5 29 14l19 25 15 4c8 2 13 9 13 17v7H18V84c0-8 7-14 16-14Z"
                fill="#b9f000"
                stroke="#111111"
                strokeWidth="5"
                strokeLinejoin="round"
              />
              <path
                d="m83 42-14 25h104l-19-25H83Z"
                fill="#dff5ff"
                stroke="#111111"
                strokeWidth="4"
                strokeLinejoin="round"
              />
              <path d="M121 42v25" stroke="#111111" strokeWidth="4" />
              <path
                d="M204 70h12c8 2 13 9 13 17v7h-19"
                fill="#f8fafc"
                stroke="#111111"
                strokeWidth="5"
                strokeLinejoin="round"
              />
              <path
                d="M28 76h20"
                stroke="#111111"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <circle cx="70" cy="91" r="18" fill="#111111" />
              <circle cx="70" cy="91" r="8" fill="#f8fafc" />
              <circle cx="185" cy="91" r="18" fill="#111111" />
              <circle cx="185" cy="91" r="8" fill="#f8fafc" />
              <path
                d="M139 77h19"
                stroke="#111111"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="customer-login-loader__road">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>

        <p className="customer-login-loader__title">Starting your drive</p>
        <p className="customer-login-loader__message">
          Getting your Rovauto dashboard ready…
        </p>
      </div>
    </div>
  );
}
