import { useEffect, useRef, useState } from "react";
import { loginWithGoogle } from "../../services/authApi";

import logo from "../../assets/sidebar/leafy-ai-logo.png";
import farmImage from "../../assets/auth/farm-login.jpg";

import styles from "./GoogleLogin.module.css";

function GoogleLogin({ onLogin }) {
  const buttonRef = useRef(null);
  const rememberMeRef = useRef(false);

  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId) {
      setError("Google login is not configured.");
      return;
    }

    let resizeObserver;
    let initialized = false;

    async function handleCredential(response) {
      try {
        setLoading(true);
        setError("");

        const data = await loginWithGoogle(
          response.credential,
          rememberMeRef.current,
        );

        onLogin(data);
      } catch (loginError) {
        setError(loginError.message || "Google login failed.");
      } finally {
        setLoading(false);
      }
    }

    function renderButton() {
      if (!window.google || !buttonRef.current) {
        return;
      }

      const width = Math.min(buttonRef.current.clientWidth, 400);

      if (width <= 0) {
        return;
      }

      buttonRef.current.innerHTML = "";

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: Math.floor(width),
      });
    }

    function initializeGoogle() {
      if (initialized || !window.google || !buttonRef.current) {
        return;
      }

      initialized = true;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
      });

      renderButton();

      resizeObserver = new ResizeObserver(renderButton);
      resizeObserver.observe(buttonRef.current);
    }

    if (window.google) {
      initializeGoogle();
    } else {
      const script = document.querySelector(
        'script[src="https://accounts.google.com/gsi/client"]',
      );

      script?.addEventListener("load", initializeGoogle);
    }

    return () => {
      resizeObserver?.disconnect();

      const script = document.querySelector(
        'script[src="https://accounts.google.com/gsi/client"]',
      );

      script?.removeEventListener("load", initializeGoogle);
    };
  }, [onLogin]);

  function handleRememberMe(event) {
    const checked = event.target.checked;

    setRememberMe(checked);
    rememberMeRef.current = checked;
  }

  return (
    <main className={styles.page}>
      <section className={styles.imagePanel}>
        <img src={farmImage} alt="Indoor basil farm" />

        <div className={styles.imageText}>
          <span>SMART BASIL FARMING</span>
          <h2>Grow smarter with Leafy AI.</h2>
        </div>
      </section>

      <section className={styles.loginPanel}>
        <div className={styles.loginContent}>
          <div className={styles.brand}>
            <img src={logo} alt="Leafy AI logo" />

            <div>
              <h1>Leafy AI</h1>
              <p>BASILIX</p>
            </div>
          </div>

          <div className={styles.heading}>
            <h2>Welcome Back</h2>
            <p>
              Sign in with your approved Google account to access your farm
              dashboard.
            </p>
          </div>

          <div ref={buttonRef} className={styles.googleButton} />

          <label className={styles.remember}>
            <input
              type="checkbox"
              checked={rememberMe}
              disabled={loading}
              onChange={handleRememberMe}
            />
            <span>Remember me</span>
          </label>

          <p className={styles.note}>
            Only approved Leafy AI accounts can access the dashboard.
          </p>

          {loading && (
            <p className={styles.loading} role="status" aria-live="polite">
              Signing in...
            </p>
          )}

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

export default GoogleLogin;
