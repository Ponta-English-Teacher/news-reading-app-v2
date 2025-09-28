// Client-side TTS helper that calls our API route
export async function speakText(text: string, lang: "en" | "ja") {
  const resp = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, lang }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`TTS API error ${resp.status}: ${t}`);
  }

  const blob = await resp.blob();
  return URL.createObjectURL(blob);
}
