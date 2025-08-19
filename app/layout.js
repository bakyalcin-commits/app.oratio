// app/layout.js
export const metadata = {
  title: "Oratio App • Medical Translate",
  description: "Translate text, images, and PDFs while preserving original layout."
};

import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}

