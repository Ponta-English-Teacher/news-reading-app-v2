// src/utils/openai.ts
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // from .env.local
});

export async function lookupWithOpenAI(term: string, lang: "en" | "ja" = "en") {
  try {
    const prompt = `
You are a bilingual learner’s dictionary. 
Define "${term}" in clear, simple English (like Longman Dictionary of Contemporary English). 
Also give a natural Japanese translation (not word-for-word, but natural). 
Format the answer as JSON with:
{
  "headword": "...",
  "pos": "...",
  "def_en": "...",
  "ja": "...",
  "example_en": "...",
  "example_ja": "..."
}
`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: prompt }],
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content?.trim();
    return content;
  } catch (err) {
    console.error("OpenAI lookup failed:", err);
    throw err;
  }
}
