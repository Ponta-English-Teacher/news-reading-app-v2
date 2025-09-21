import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs"; // ensure Node runtime for fetch of binary

export async function POST(req: NextRequest) {
  try {
    const region = process.env.AZURE_SPEECH_REGION;
    const key = process.env.AZURE_SPEECH_KEY;
    if (!region || !key) {
      return NextResponse.json({ error: "Missing AZURE_SPEECH_* env" }, { status: 500 });
    }

    const lang = (req.nextUrl.searchParams.get("lang") || "en") as "en" | "ja";

    // Accept raw audio bytes from the client
    const contentType = req.headers.get("content-type") || "application/octet-stream";
    const body = await req.arrayBuffer();

    // Azure short-audio REST endpoint (conversation mode)
    // Docs pattern:
    // https://{region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US
    const azureLang = lang === "en" ? "en-US" : "ja-JP";
    const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(azureLang)}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": contentType, // e.g., audio/webm;codecs=opus or audio/mp4
        "Accept": "application/json;text/xml",
      },
      body,
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: `Azure STT ${resp.status} ${resp.statusText}`, detail: text }, { status: 502 });
    }

    // Example response has fields like: { RecognitionStatus, DisplayText, Duration, Offset }
    const json = await resp.json();

    // Normalize to { transcript: string }
    const transcript: string =
      json?.DisplayText ??
      json?.NBest?.[0]?.Display ?? // some variants
      json?.Text ?? "";


    return NextResponse.json({ transcript });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
