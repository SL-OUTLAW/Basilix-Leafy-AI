import { useEffect, useRef, useState } from "react";
import { loginWithGoogle } from "../../services/authApi";
import styles from "./GoogleLogin.module.css";

function GoogleLogin({ onLogin }) {
  const buttonRef = useRef(null);
  const rememberMeRef = useRef(false);

  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId) {
      setError("Google login is not configured.");
      return;
    }

    function setupGoogleLogin() {
      if (!window.google || !buttonRef.current) {
        return false;
      }

      buttonRef.current.innerHTML = "";

      window.google.accounts.id.initialize({
        client_id: clientId,

        callback: async (response) => {
          try {
            setError("");
            setLoading(true);

            const data = await loginWithGoogle(
              response.credential,
              rememberMeRef.current
            );

            onLogin(data);
          } catch (loginError) {
            setError(loginError.message);
          } finally {
            setLoading(false);
          }
        }
      });

      window.google.accounts.id.renderButton(
        buttonRef.current,
        {
          theme: "outline",
          size: "large"
        }
      );

      return true;
    }

    if (setupGoogleLogin()) {
      return;
    }

    const checkGoogle = setInterval(() => {
      if (setupGoogleLogin()) {
        clearInterval(checkGoogle);
      }
    }, 100);

    return () => {
      clearInterval(checkGoogle);
    };
  }, [onLogin]);

  return (
    <div className={styles.login}>
      <h1>Leafy AI</h1>
      <p>Sign in with Google to access the farm dashboard.</p>

      <label className={styles.remember}>
        <input
          type="checkbox"
          checked={rememberMe}
          disabled={loading}
          onChange={(event) => {
            const checked = event.target.checked;
            setRememberMe(checked);
            rememberMeRef.current = checked;
          }}
        />

        Remember me
      </label>

      <div ref={buttonRef}></div>

      {loading ? <p>Signing in...</p> : null}

      {error ? (
        <p className={styles.error}>{error}</p>
      ) : null}
    </div>
  );
}

export default GoogleLogin;
