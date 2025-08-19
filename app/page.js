"use client";
import { useState } from "react";

export default function Home() {
  const [activeTab, setActiveTab] = useState("text");
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [targetLang, setTargetLang] = useState("en");
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
        body: JSON.stringify({
          text: sourceText,
          targetLang: targetLang,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setTranslatedText(data.translatedText);
      } else {
        setTranslatedText("❌ Error: " + data.error);
      }
    } catch (err) {
      setTranslatedText("❌ Server error: " + err.message);
    }
  };

  const handleFileTranslate = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setDownloadReady(false);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("targetLang", targetLang);

      const res = await fetch("/api/translate-file", {
        method: "POST",
        body: formData,
      });

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
    } catch (err) {
      alert("❌ Server error: " + err.message);
    }

    setLoading(false);
  };

  return (
    <main style={{ maxWidth: "900px", margin: "0 auto", padding: "40px" }}>
      {/* Logo + Title */}
      <header style={{ textAlign: "center", marginBottom: "40px" }}>
        <img
          src="/Oratio.png"
          alt="Oratio Logo"
          style={{ height: "80px", margin: "0 auto 20px" }}
        />
        <h1>Oratio App • Medical Translate</h1>
      </header>

      {/* Tabs */}
      <section style={{ marginBottom: "30px", textAlign: "center" }}>
        <button
          onClick={() => setActiveTab("text")}
          style={{
            padding: "10px 20px",
            marginRight: "10px",
            backgroundColor: activeTab === "text" ? "#4f46e5" : "#888",
            color: "#fff",
          }}
        >
          Translate Text
        </button>
        <button
          onClick={() => setActiveTab("file")}
          style={{
            padding: "10px 20px",
            backgroundColor: activeTab === "file" ? "#4f46e5" : "#888",
            color: "#fff",
          }}
        >
          Translate File
        </button>
      </section>

      {/* Content */}
      {activeTab === "text" && (
        <section>
          <h2>Translate Text</h2>
          <textarea
            rows="5"
            placeholder="Enter text here..."
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "10px",
              borderRadius: "6px",
            }}
          />
          <br />
          <label>Target Language: </label>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            style={{ margin: "10px 0", padding: "5px" }}
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
          <br />
          <button onClick={handleTranslate}>Translate</button>
          <div
            style={{
              marginTop: "20px",
              padding: "15px",
              background: "#f4f4f4",
              borderRadius: "8px",
              minHeight: "100px",
            }}
          >
            {translatedText}
          </div>
        </section>
      )}

      {activeTab === "file" && (
        <section>
          <h2>Translate File (Image/PDF)</h2>
          <div className="upload-box">
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.pdf"
              onChange={(e) => setSelectedFile(e.target.files[0])}
            />
          </div>
          <button onClick={handleFileTranslate} disabled={!selectedFile || loading}>
            {loading ? "Translating..." : "Translate File"}
          </button>
          {downloadReady && (
            <p style={{ marginTop: "15px", color: "green" }}>
              ✅ File processed successfully (download coming soon).
            </p>
          )}
        </section>
      )}
    </main>
  );
}



