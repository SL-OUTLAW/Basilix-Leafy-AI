import { useEffect, useState } from "react";

function App() {
  const [backendStatus, setBackendStatus] = useState("Checking...");

  useEffect(() => {
    fetch("/api")
      .then((response) => response.json())
      .then((data) => {
        if (data.status === "ok") {
          setBackendStatus("Connected");
        }
      })
      .catch(() => {
        setBackendStatus("Not connected");
      });
  }, []);

  return (
    <main>
      <h1>Leafy AI</h1>
      <p>Frontend is running.</p>
      <p>Backend: {backendStatus}</p>
    </main>
  );
}

export default App;