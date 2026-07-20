import { FiRotateCcw, FiSmartphone } from "react-icons/fi";

export default function MobilePortraitGuard() {
  return (
    <aside
      className="mobile-portrait-guard"
      role="alert"
      aria-labelledby="mobile-portrait-guard-title"
      aria-describedby="mobile-portrait-guard-message"
    >
      <div className="mobile-portrait-guard__card">
        <div className="mobile-portrait-guard__visual" aria-hidden="true">
          <span className="mobile-portrait-guard__phone">
            <FiSmartphone />
          </span>
          <FiRotateCcw className="mobile-portrait-guard__rotate" />
        </div>
        <p className="mobile-portrait-guard__eyebrow">ROVAUTO MOBILE</p>
        <h1 id="mobile-portrait-guard-title">Rotate to portrait</h1>
        <p id="mobile-portrait-guard-message">
          Rovauto is designed for portrait use on your phone. Rotate your
          device to continue.
        </p>
      </div>
    </aside>
  );
}
