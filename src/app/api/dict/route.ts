// src/app/api/dict/route.ts
import { NextResponse } from "next/server";
import { lookupWithOpenAI } from "@/utils/openai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { term, lang } = body;

    if (!term || typeof term !== "string") {
      return NextResponse.json({ error: "Missing or invalid term" }, { status: 400 });
    }

    const result = await lookupWithOpenAI(term, lang || "en");
    return NextResponse.json({ result });
  } catch (err: any) {
    console.error("Dict API error:", err);
    return NextResponse.json({ error: err.message || "Lookup failed" }, { status: 500 });
  }
}
