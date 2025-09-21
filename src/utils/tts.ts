// Client-side Azure TTS helper (returns a blob URL you can play)
const REGION = process.env.NEXT_PUBLIC_AZURE_TTS_REGION!;
const KEY = process.env.NEXT_PUBLIC_AZURE_TTS_KEY!;

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function speakText(text: string, lang: "en" | "ja") {
  if (!REGION || !KEY) throw new Error("Missing NEXT_PUBLIC_AZURE_TTS_* env");
  const voice = lang === "ja" ? "ja-JP-NanamiNeural" : "en-US-JennyNeural";
  const xmlLang = lang === "ja" ? "ja-JP" : "en-US";
  const url = `https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;

  const ssml = `<speak version="1.0" xml:lang="${xmlLang}">
    <voice name="${voice}">${escapeXml(text)}</voice>
  </speak>`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3"
    },
    body: ssml
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Azure TTS error ${resp.status}: ${t}`);
  }

  const blob = await resp.blob();
  return URL.createObjectURL(blob);
}