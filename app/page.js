"use client";
import { useState } from "react";

export default function Home() {
  const [activeTab, setActiveTab] = useState("text");

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
            ></textarea>
          </div>

          <button style={{ padding: "12px 24px" }}>TRANSLATE</button>
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
            <input type="file" accept=".png,.jpg,.jpeg,.pdf" />
          </div>

          {/* Process Steps */}
          <ol style={{ marginBottom: "20px" }}>
            <li>Upload File</li>
            <li>Detect & OCR</li>
            <li>Translate</li>
            <li>Download Result</li>
          </ol>

          <button style={{ padding: "12px 24px" }}>TRANSLATE FILE</button>
        </section>
      )}
    </main>
  );
}




