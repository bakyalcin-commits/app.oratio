"use client";
import { useState } from "react";

export default function Home() {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("en");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTranslate = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setResult("");
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, target: language }),
      });
      const data = await res.json();
      setResult(data.translatedText);
    } catch (error) {
      setResult("Translation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-gray-200 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <img src="/Oratio.png" alt="Oratio Logo" className="w-28 mb-6" />

      {/* Başlık */}
      <h1 className="text-3xl font-bold text-white mb-2">Oratio App</h1>
      <p className="text-lg text-gray-400 mb-6">Medical Translate</p>

      {/* Çeviri kutusu */}
      <div className="w-full max-w-lg bg-gray-900 p-6 rounded-2xl shadow-xl">
        <label className="block text-sm mb-2 text-gray-300">
          Target Language:
        </label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full p-2 mb-4 rounded bg-gray-800 text-white border border-gray-700"
        >
          <option value="en">English</option>
          <option value="tr">Turkish</option>
          <option value="de">German</option>
          <option value="fr">French</option>
        </select>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter your text here..."
          className="w-full h-32 p-3 rounded bg-gray-800 text-white border border-gray-700 mb-4"
        />

        <button
          onClick={handleTranslate}
          disabled={loading}
          className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition"
        >
          {loading ? "Translating..." : "Translate"}
        </button>

        {result && (
          <div className="mt-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-2">Result</h2>
            <p className="text-gray-200">{result}</p>
          </div>
        )}
      </div>
    </div>
  );
}






