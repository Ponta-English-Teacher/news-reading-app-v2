import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const uiLang = (searchParams.get("uiLang") || "en") as "en" | "ja";

  if (!q) {
    return NextResponse.json({ error: "MISSING_QUERY" }, { status: 400 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "NO_OPENAI_KEY" }, { status: 500 });
  }

  const system = `
You are a bilingual learner's dictionary. Keep entries short, natural, and classroom-friendly.

Return balanced information for the headword/phrase.
Style:
- English definition (1 concise sentence, CEFR B1-B2, no repetition of the headword).
- Japanese meaning should be natural and succinct (use common news words like 速報 / 発表 / 概要 when appropriate).
- Include at most one natural English example sentence using the term normally (not duplicated).
- Include a fluent Japanese translation of the example.
- If a multi-word phrase is given, treat it as a set phrase.

Format the JSON EXACTLY like:
{
  "headword": "...",
  "pos": "noun|verb|adj|adv|phrase|idiom|proper-noun|number|symbol|other",
  "ipa": "",
  "def_en": "...",
  "ja": "...",
  "exampleEn": "...",
  "exampleJa": "..."
}
`;

  const prompt = `
TERM: ${q}

Notes:
- If the term is a newsy phrase like "quick update", consider translations like "速報" when natural.
- Keep "def_en" and "ja" each to one sentence.
- Leave "ipa" empty if unsure.`;

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    const json = await r.json();
    if (!r.ok) {
      return NextResponse.json(
        { error: json?.error?.message || "OPENAI_ERROR" },
        { status: 500 }
      );
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(json.choices?.[0]?.message?.content || "{}");
    } catch {
      parsed = {};
    }

    const payload = {
      headword: parsed.headword || q,
      pos: parsed.pos || "phrase",
      ipa: parsed.ipa || "",
      def_en: parsed.def_en || "",
      ja: parsed.ja || "",
      exampleEn: parsed.exampleEn || "",
      exampleJa: parsed.exampleJa || "",
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}