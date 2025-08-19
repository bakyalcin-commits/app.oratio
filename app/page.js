"use client";
import { useState } from "react";

export default function Home() {
  const [activeTab, setActiveTab] = useState("text");

  // text translate
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [targetLang, setTargetLang] = useState("en");

  // file translate
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
      else setTranslatedText("❌ Error: " + (data.error || "Translation failed"));
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
        alert("❌ Error: " + (data.error || "Something went wrong"));
      }
    } catch (e) {
      alert("❌ Server error: " + e.message);
    }
    setLoading(false);
  };

  return (
    <main>
      {/* Logo + Title */}
      <header style={{ textAlign: "center", marginBottom: "40px" }}>
        <img src="/Oratio.png" alt="Oratio Logo" style={{ height: 80, margin: "0 auto 20px" }} />
        <h1>Oratio App • Medical Translate</h1>
      </header>

      {/* Tabs */}
      <section style={{ textAlign: "center", marginBottom: 30 }}>
        <button
          onClick={() => setActiveTab("text")}
          style={{ marginRight: 10, background: activeTab === "text" ? "#4f46e5" : "#888" }}
        >
          Translate Text
        </button>
        <button
          onClick={() => setActiveTab("file")}
          style={{ background: activeTab === "file" ? "#4f46e5" : "#888" }}
        >
          Translate File
        </button>
      </section>

      {/* Translate Text */}
      {activeTab === "text" && (
        <section>
          <h2>Translate Text</h2>
          <div style={{ margin: "10px 0" }}>
            <label>Target Language: </label>
            <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} style={{ marginLeft: 6 }}>
              <option value="en">English</option><option value="tr">Turkish</option>
              <option value="fr">French</option><option value="de">German</option>
              <option value="it">Italian</option><option value="es">Spanish</option>
              <option value="ru">Russian</option><option value="ar">Arabic</option>
              <option value="sr">Serbian</option><option value="zh">Chinese</option>
              <option value="ja">Japanese</option>
            </select>
          </div>

          <textarea rows={6} placeholder="Enter your text here..." value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 6 }} />

          <div style={{ marginTop: 12 }}>
            <button onClick={handleTranslate}>Translate</button>
          </div>

          <div style={{ marginTop: 20, padding: 15, background: "#f4f4f4", borderRadius: 8, minHeight: 100 }}>
            {translatedText}
          </div>
        </section>
      )}

      {/* Translate File */}
      {activeTab === "file" && (
        <section>
          <h2>Translate File (Image/PDF)</h2>

          <div className="upload-box">
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.pdf"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <label>Target Language:</label>
            <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
              <option value="en">English</option><option value="tr">Turkish</option>
              <option value="fr">French</option><option value="de">German</option>
              <option value="it">Italian</option><option value="es">Spanish</option>
              <option value="ru">Russian</option><option value="ar">Arabic</option>
              <option value="sr">Serbian</option><option value="zh">Chinese</option>
              <option value="ja">Japanese</option>
            </select>
          </div>

          <div style={{ marginTop: 12 }}>
            <button onClick={handleFileTranslate} disabled={!selectedFile || loading}>
              {loading ? "Translating..." : "Translate File"}
            </button>
          </div>

          {downloadReady && (
            <p style={{ marginTop: 12, color: "green" }}>
              ✅ File processed successfully (download coming soon).
            </p>
          )}
        </section>
      )}
    </main>
  );
}




