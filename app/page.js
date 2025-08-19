"use client";
import { useState } from "react";

export default function Home() {
  const [activeTab, setActiveTab] = useState("text");

  // text
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [targetLang, setTargetLang] = useState("en");

  // file
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloadReady, setDownloadReady] = useState(false);

  const handleTranslate = async () => {
    if (!sourceText.trim()) {
      setTranslatedText("Please enter some text to translate.");
      return;
    }
    try {
      setTranslatedText("⏳ Translating...");
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sourceText, targetLang })
      });
      const data = await res.json();
      if (res.ok) setTranslatedText(data.translatedText || "");
      else setTranslatedText("❌ " + (data.error || "Translation failed"));
    } catch (e) {
      setTranslatedText("❌ Server error: " + e.message);
    }
  };

  const handleFileTranslate = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setDownloadReady(false);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("targetLang", targetLang);

      const res = await fetch("/api/translate-file", { method: "POST", body: fd });
      const data = await res.json();

      if (res.ok) {
        alert(
          "✅ OCR + Translate complete!\n\nOriginal:\n" +
            data.sourceText +
            "\n\nTranslated:\n" +
            data.translatedText
        );
        setDownloadReady(true);
      } else {
        alert("❌ " + (data.error || "Something went wrong"));
      }
    } catch (e) {
      alert("❌ Server error: " + e.message);
    }
    setLoading(false);
  };

  return (
    <div className="container">
      {/* KART */}
      <div className="card">
        {/* Başlık */}
        <div className="app-header">
          <img src="/Oratio.png" alt="Oratio Logo" />
          <div>
            <div className="app-title">Oratio App • Medical Translate</div>
            <div className="app-subtitle">
              Detect language automatically, translate to one of your targets, keep it clean.
            </div>
          </div>
        </div>

        {/* Sekmeler */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === "text" ? "active" : ""}`}
            onClick={() => setActiveTab("text")}
          >
            Translate Text
          </button>
          <button
            className={`tab ${activeTab === "file" ? "active" : ""}`}
            onClick={() => setActiveTab("file")}
          >
            Translate File
          </button>
        </div>

        {/* İçerik */}
        <div className="section">
          {/* Hedef dil */}
          <div style={{ marginBottom: 12 }}>
            <div className="label">Target Language</div>
            <select
              className="select"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              style={{ maxWidth: 240 }}
            >
              <option value="en">English</option>
              <option value="tr">Turkish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="es">Spanish</option>
              <option value="ru">Russian</option>
              <option value="ar">Arabic</option>
              <option value="sr">Serbian</option>
              <option value="zh">Chinese</option>
              <option value="ja">Japanese</option>
            </select>
          </div>

          {activeTab === "text" && (
            <>
              <div style={{ marginBottom: 12 }}>
                <div className="label">Source Text</div>
                <textarea
                  className="textarea"
                  placeholder="Enter your text here..."
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                />
              </div>

              <button className="btn" onClick={handleTranslate}>Translate</button>

              <div className="output">{translatedText}</div>
            </>
          )}

          {activeTab === "file" && (
            <>
              <div className="drop" style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>
                  Upload a file (PNG / JPG / PDF soon)
                </div>
                <input
                  className="input"
                  type="file"
                  accept=".png,.jpg,.jpeg"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  style={{ maxWidth: 420, display: "inline-block" }}
                />
              </div>

              <div className="stepper">
                <div className="step">1. Upload File</div>
                <div className="step">2. OCR</div>
                <div className="step">3. Translate</div>
                <div className="step">4. Download</div>
              </div>

              <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                <button
                  className="btn secondary"
                  onClick={handleFileTranslate}
                  disabled={!selectedFile || loading}
                >
                  {loading ? "Processing…" : "Translate File"}
                </button>
                <button
                  className="btn gray"
                  disabled={!downloadReady}
                  onClick={() => alert("Download flow will attach here.")}
                >
                  Download Result
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="footer">© {new Date().getFullYear()} Oratio. All rights reserved.</div>
    </div>
  );
}





