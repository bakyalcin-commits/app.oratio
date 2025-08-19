export default function Home() {
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
        <button style={{ padding: "10px 20px", marginRight: "10px" }}>
          Translate Text
        </button>
        <button style={{ padding: "10px 20px" }}>Translate File</button>
      </section>

      {/* Content placeholder */}
      <section style={{ textAlign: "center" }}>
        <p>Select a tab above to start translating.</p>
      </section>
    </main>
  );
}

