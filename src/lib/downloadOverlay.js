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
  if (!imageBase64 || !width || !height) {
    throw new Error("Image or dimensions missing on client");
  }
  if (!Array.isArray(boxes)) {
    throw new Error("Boxes must be an array");
  }

  const payload = { imageBase64, boxes, width, height, fontPx, lineWrap };

  console.debug("[overlay] sending to /api/overlay", {
    hasImage: !!imageBase64,
    width,
    height,
    boxesCount: boxes.length,
  });

  const res = await fetch("/api/overlay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = "Overlay generation failed";
    try {
      const j = await res.json();
      if (j?.error) msg = j.error + (j?.detail ? ` (${j.detail})` : "");
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


