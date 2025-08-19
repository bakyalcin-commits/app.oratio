"use client";

import React from "react";

// ISO dil kodları
const LANGS = [
  { label: "English", value: "en" },
  { label: "Turkish", value: "tr" },
  { label: "French", value: "fr" },
  { label: "German", value: "de" },
  { label: "Italian", value: "it" },
  { label: "Spanish", value: "es" },
  { label: "Russian", value: "ru" },
  { label: "Arabic", value: "ar" },
  { label: "Serbian", value: "sr" },
  { label: "Chinese", value: "zh" },
  { label: "Japanese", value: "ja" },
];

export default function Page() {
  const [mode, setMode] = React.useState("file"); // "text" | "file"

  // shared
  const [targetLang, setTargetLang] = React.useState("en");
  const [loading, setLoading] = React.useState(false);

  // text
  const [inputText, setInputText] = React.useState("");
  const [outputText, setOutputText] = React.useState("");

  // file
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [lastResult, setLastResult] = React.useState(null); // { sourceText, translatedText, detectedLang }
  const [downloadReady, setDownloadReady] = React.useState(false);

  async function handleTranslateText() {
    if (!inputText.trim()) {
      alert("Please enter some text.");
      return;
    }
    setLoading(true);
    setOutputText("");
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, target: targetLang }),
      });
      const data = await res.json();
      if (res.ok) {
        setOutputText(data.result || "");
        alert("✅ Translation complete!");
      } else {
        alert("❌ " + (data.error || "Translate failed"));
      }
    } catch (e) {
      alert("❌ Server error: " + e.message);
    }
    setLoading(false);
  }

  async function handleFileTranslate() {
    if (!selectedFile) {
      alert("Please choose a PNG/JPG file.");
      return;
    }
    setLoading(true);
    setDownloadReady(false);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("targetLang", targetLang);

      const res = await fetch("/api/translate-file", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();

      if (res.ok) {
        setLastResult({
          sourceText: data.sourceText || "",
          translatedText: data.translatedText || "",
          detectedLang: data.detectedLang || "",
        });
        setDownloadReady(true);
        alert(
          `✅ OCR + Translate complete!\n\nDetected: ${
            data.detectedLang || "auto"
          }\n\nOriginal:\n${(data.sourceText || "").slice(0, 1000)}\n\nTranslated:\n${
            (data.translatedText || "").slice(0, 1000)
          }`
        );
      } else {
        alert("❌ " + (data.error || "Something went wrong"));
      }
    } catch (e) {
      alert("❌ Server error: " + e.message);
    }
    setLoading(false);
  }

  function handleDownload() {
    if (!lastResult) {
      alert("Nothing to download yet.");
      return;
    }
    const txt =
      `Detected language: ${lastResult.detectedLang || "auto"}\n\n` +
      `--- Original ---\n${lastResult.sourceText}\n\n` +
      `--- Translated (${targetLang}) ---\n${lastResult.translatedText}\n`;

    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const base = (selectedFile?.name || "result").replace(/\.[^.]+$/, "");
    a.href = url;
    a.download = `${base}-${targetLang}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const styles = {
    page: {
      minHeight: "100vh",
      background: "#0b1220",
      color: "#eef1f7",
      fontFamily:
        "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,Ubuntu,Inter,sans-serif",
    },
    container: { maxWidth: 980, margin: "0 auto", padding: "28px 20px 64px" },
    top: { display: "flex", alignItems: "center", gap: 14, marginBottom: 10 },
    logo: { height: 36 },
    h1: { fontSize: 24, fontWeight: 800, letterSpacing: 0.2 },
    sub: { color: "#93a0b8", marginTop: 2, marginBottom: 14, fontSize: 14 },
    tabs: { display: "flex", gap: 8, marginBottom: 18 },
    tab: (active) => ({
      padding: "10px 14px",
      borderRadius: 10,
      border: "1px solid rgba(255,255,255,0.08)",
      background: active ? "#5b6bff" : "transparent",
      color: active ? "white" : "#c9d4e6",
      cursor: "pointer",
      fontWeight: 700,
    }),
    card: {
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16,
      padding: 20,
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.015))",
    },
    row: { display: "flex", alignItems: "center", gap: 12, marginBottom: 12 },
    select: {
      background: "#0f1729",
      color: "#eef1f7",
      border: "1px solid rgba(255,255,255,0.12)",
      padding: "8px 10px",
      borderRadius: 10,
      outline: "none",
    },
    textarea: {
      width: "100%",
      minHeight: 160,
      background: "#0f1729",
      color: "#eef1f7",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 12,
      padding: 12,
      outline: "none",
      resize: "vertical",
    },
    input: {
      background: "#0f1729",
      color: "#eef1f7",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 10,
      padding: 10,
    },
    primary: {
      background: "#5b6bff",
      color: "white",
      border: "none",
      borderRadius: 12,
      padding: "10px 14px",
      fontWeight: 800,
      cursor: "pointer",
    },
    ghost: {
      background: "transparent",
      color: "#c9d4e6",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 12,
      padding: "10px 14px",
      fontWeight: 700,
      cursor: "pointer",
    },
    footer: {
      marginTop: 36,
      textAlign: "center",
      color: "#7d8aa6",
      fontSize: 12,
      opacity: 0.8,
    },
  };

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.top}>
          <img src="/Oratio.png" alt="Oratio Logo" style={styles.logo} />
          <div>
            <div style={styles.h1}>Oratio App • Medical Translate</div>
            <div style={styles.sub}>Auto-detect source language</div>
          </div>
        </div>

        <div style={styles.tabs}>
          <button
            style={styles.tab(mode === "text")}
            onClick={() => setMode("text")}
          >
            Translate Text
          </button>
          <button
            style={styles.tab(mode === "file")}
            onClick={() => setMode("file")}
          >
            Translate File
          </button>
        </div>

        <div style={styles.card}>
          <div style={styles.row}>
            <div style={{ fontWeight: 700 }}>Target Language</div>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              style={styles.select}
            >
              {LANGS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          {mode === "text" ? (
            <>
              <textarea
                style={styles.textarea}
                placeholder="Enter your text here..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button style={styles.primary} onClick={handleTranslateText}>
                  {loading ? "Processing..." : "Translate"}
                </button>
                {outputText && (
                  <button
                    style={styles.ghost}
                    onClick={() => navigator.clipboard.writeText(outputText)}
                  >
                    Copy Result
                  </button>
                )}
              </div>
              {outputText ? (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Result</div>
                  <textarea
                    style={{ ...styles.textarea, minHeight: 140 }}
                    readOnly
                    value={outputText}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>
                Upload a file (PNG / JPG)
              </div>
              <div style={styles.row}>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg"
                  onChange={(e) =>
                    setSelectedFile(e.target.files?.[0] || null)
                  }
                  style={styles.input}
                />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  style={styles.primary}
                  onClick={handleFileTranslate}
                  disabled={loading}
                >
                  {loading ? "Processing..." : "Translate File"}
                </button>
                <button
                  style={styles.ghost}
                  onClick={handleDownload}
                  disabled={!downloadReady || !lastResult}
                >
                  Download Result
                </button>
              </div>

              {lastResult ? (
                <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      Original (detected: {lastResult.detectedLang || "auto"})
                    </div>
                    <textarea
                      style={{
                        ...styles.textarea,
                        minHeight: 140,
                      }}
                      readOnly
                      value={lastResult.sourceText}
                    />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      Translated → {targetLang.toUpperCase()}
                    </div>
                    <textarea
                      style={{
                        ...styles.textarea,
                        minHeight: 160,
                      }}
                      readOnly
                      value={lastResult.translatedText}
                    />
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div style={styles.footer}>© 2025 Oratio. All rights reserved.</div>
      </div>
    </main>
  );
}



