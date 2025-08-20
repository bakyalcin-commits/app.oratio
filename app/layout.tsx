export const metadata = { title: "Oratio – Medical Translator" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0b0b0c", color: "#eaeaea" }}>
        {children}
      </body>
    </html>
  );
}


