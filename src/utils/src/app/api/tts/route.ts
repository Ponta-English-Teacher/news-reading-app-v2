import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { text, lang } = await req.json();

  const REGION = process.env.AZURE_TTS_REGION!;
  const KEY = process.env.AZURE_TTS_KEY!;

  if (!REGION || !KEY) {
    return NextResponse.json({ error: "Missing Azure TTS env vars" }, { status: 500 });
  }

  const voice = lang === "ja" ? "ja-JP-NanamiNeural" : "en-US-JennyNeural";
  const xmlLang = lang === "ja" ? "ja-JP" : "en-US";
  const url = `https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;

  const ssml = `<speak version="1.0" xml:lang="${xmlLang}">
    <voice name="${voice}">${text}</voice>
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
    return NextResponse.json({ error: `Azure TTS error ${resp.status}: ${t}` }, { status: resp.status });
  }

  const buffer = Buffer.from(await resp.arrayBuffer());
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": buffer.length.toString(),
    },
  });
}
