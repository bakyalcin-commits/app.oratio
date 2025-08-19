export const metadata = { title: "Oratio Minimal Overlay" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ background: "#0b0f1a", color: "#d9e1ff", fontFamily: "Inter, system-ui, Arial" }}>
        <div style={{ maxWidth: 960, margin: "32px auto", padding: 16 }}>{children}</div>
      </body>
    </html>
  );
}
