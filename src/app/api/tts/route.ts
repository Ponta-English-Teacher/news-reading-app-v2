import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { text, lang } = await req.json();

    if (!text || !lang) {
      return NextResponse.json({ error: "Missing text or lang" }, { status: 400 });
    }

    const region = process.env.AZURE_TTS_REGION!;
    const key = process.env.AZURE_TTS_KEY!;
    if (!region || !key) {
      return NextResponse.json({ error: "Missing Azure credentials" }, { status: 500 });
    }

    const voice = lang === "ja" ? "ja-JP-NanamiNeural" : "en-US-JennyNeural";
    const xmlLang = lang === "ja" ? "ja-JP" : "en-US";
    const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

    const ssml = `<speak version="1.0" xml:lang="${xmlLang}">
      <voice name="${voice}">${text}</voice>
    </speak>`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      },
      body: ssml,
    });

    if (!resp.ok) {
      const err = await resp.text();
      return NextResponse.json({ error: `Azure error ${resp.status}: ${err}` }, { status: 500 });
    }

    const buf = Buffer.from(await resp.arrayBuffer());
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 });
  }
}
