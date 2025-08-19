// src/lib/downloadOverlay.js
export async function downloadOverlayPNG({
  imageBase64,
  boxes,
  width,
  height,
  fontPx = 22,
  lineWrap = 30,
  filename = "translated-overlay.png",
}) {
  const res = await fetch("/api/overlay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64, boxes, width, height, fontPx, lineWrap }),
  });

  if (!res.ok) {
    let msg = "Overlay generation failed";
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
