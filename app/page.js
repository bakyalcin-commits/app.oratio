"use client";
import { useState } from "react";

export default function Home() {
  const [activeTab, setActiveTab] = useState("text");
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [downloadReady, setDownloadReady] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleTranslate = () => {
    if (!sourceText.trim()) {
      setTranslatedText("Please enter some text to translate.");
      return;
    }
    setTranslatedText("🔄 " + sourceText.split("").reverse().join(""));
  };

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setDownloadReady(false);
      setLoading(false);

      if (file.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleFakeFileTranslate = () => {
    if (!selectedFile) return;
    setLoading(true);
    setDownloadReady(false);

    setTimeout(() => {
      setLoading(false);
      setDownloadReady(true);
    }, 2000);
  };

  return (
    <main>
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
      <section style={{ textAlign: "center", marginBottom: "30px" }}>
        <button
          onClick={() => setActiveTab("text")}
          style={{
            padding: "10px 20px",
            marginRight: "10px",
            background: activeTab === "text" ? "#4f46e5" : "#e5e7eb",
            color: activeTab === "text" ? "#fff" : "#000",
            borderRadius: "6px",
            border: "none",
          }}
        >
          Translate Text
        </button>
        <button
          onClick={() => setActiveTab("file")}
          style={{
            padding: "10px 20px",
            background: activeTab === "file" ? "#4f46e5" : "#e5e7eb",
            color: activeTab === "file" ? "#fff" : "#000",
            borderRadius: "6px",
            border: "none",
          }}
        >
          Translate File
        </button>
      </section>

      {/* Content */}
      {activeTab === "text" && (
        <section style={{ marginBottom: "60px" }}>
          <h2 style={{ marginBottom: "20px" }}>Translate Text</h2>

          {/* Target Language */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "6px" }}>
              Target Language
            </label>
            <select style={{ padding: "10px", width: "200px" }}>
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

          {/* Source Text */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "6px" }}>
              Source Text
            </label>
            <textarea
              placeholder="Enter your text here..."
              style={{ width: "100%", height: "150px", padding: "10px" }}
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
            ></textarea>
          </div>

          {/* Output */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "6px" }}>
              Translated Text
            </label>
            <textarea
              readOnly
              placeholder="Translation will appear here..."
              style={{
                width: "100%",
                height: "150px",
                padding: "10px",
                background: "#f0f0f0",
              }}
              value={translatedText}
            ></textarea>
          </div>

          <button style={{ padding: "12px 24px" }} onClick={handleTranslate}>
            TRANSLATE
          </button>
        </section>
      )}

      {activeTab === "file" && (
        <section>
          <h2 style={{ marginBottom: "20px" }}>
            Translate File (PNG, JPG, PDF)
          </h2>

          {/* Upload Zone */}
          <div
            style={{
              border: "2px dashed #ccc",
              borderRadius: "8px",
              padding: "40px",
              textAlign: "center",
              marginBottom: "20px",
            }}
          >
            <p>Drag & drop your file here or click to upload</p>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.pdf"
              onChange={handleFileChange}
            />
          </div>

          {selectedFile && (
            <div style={{ marginBottom: "20px" }}>
              <p>
                ✅ Selected file: <strong>{selectedFile.name}</strong>
              </p>
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Preview"
                  style={{
                    maxWidth: "300px",
                    maxHeight: "200px",
                    border: "1px solid #ccc",
                    borderRadius: "6px",
                    marginTop: "10px",
                  }}
                />
              )}
            </div>
          )}

          {/* Process Steps */}
          <ol style={{ marginBottom: "20px" }}>
            <li>Upload File</li>
            <li>Detect & OCR</li>
            <li>Translate</li>
            <li>Download Result</li>
          </ol>

          {!loading && !downloadReady && (
            <button style={{ padding: "12px 24px" }} onClick={handleFakeFileTranslate}>
              TRANSLATE FILE
            </button>
          )}

          {loading && (
            <div style={{ marginTop: "20px" }}>
              <p>⏳ Processing your file...</p>
              <div
                style={{
                  margin: "10px auto",
                  border: "4px solid #f3f3f3",
                  borderTop: "4px solid #4f46e5",
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  animation: "spin 1s linear infinite",
                }}
              />
              <style jsx>{`
                @keyframes spin {
                  0% {
                    transform: rotate(0deg);
                  }
                  100% {
                    transform: rotate(360deg);
                  }
                }
              `}</style>
            </div>
          )}

          {downloadReady && (
            <div style={{ marginTop: "20px" }}>
              <a
                href="#"
                style={{
                  display: "inline-block",
                  padding: "12px 24px",
                  background: "#22c55e",
                  color: "#fff",
                  borderRadius: "6px",
                  textDecoration: "none",
                }}
              >
                ⬇ Download Translated File
              </a>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

