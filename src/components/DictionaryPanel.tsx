"use client";

import { useEffect, useState } from "react";
import { speakText } from "@/utils/tts";

type VocabItem = {
  word: string;
  headword?: string;
  pos?: string;
  ipa?: string;
  en?: string;     // short English definition
  ja?: string;     // short Japanese gloss
  def_en?: string; // longer English definition
  example_en?: string;
  example_ja?: string;
};

type Props = {
  isOpen?: boolean;
  onClose?: () => void;
  initialQuery?: string | null;
  vocabList?: VocabItem[];
  uiLang?: "en" | "ja";
};

export default function DictionaryPanel({
  isOpen = true,
  onClose,
  initialQuery = "",
  vocabList = [],
  uiLang = "en",
}: Props) {
  const [query, setQuery] = useState(initialQuery || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Result can be either a vocab match or AI JSON
  const [localHit, setLocalHit] = useState<VocabItem | null>(null);
  const [aiJson, setAiJson] = useState<any | null>(null);
  const [aiRaw, setAiRaw] = useState<string | null>(null);

  useEffect(() => {
    setQuery(initialQuery || "");
    setLocalHit(null);
    setAiJson(null);
    setAiRaw(null);
    setError(null);
  }, [initialQuery]);

  if (!isOpen) return null;

  // --- helpers ---
  function normalize(s: string) {
    return (s || "").trim().toLowerCase();
  }

  function lookupLocal(q: string) {
    const nq = normalize(q);
    if (!nq) return null;

    // exact by word/headword
    let hit =
      vocabList.find(
        (v) =>
          normalize(v.word || v.headword || "") === nq
      ) ||
      null;

    // fallback: case-insensitive contains (single word)
    if (!hit && !/\s/.test(nq)) {
      hit =
        vocabList.find((v) =>
          normalize(v.word || v.headword || "").includes(nq)
        ) || null;
    }
    return hit || null;
  }

  async function handleLookup() {
    const q = query.trim();
    if (!q) return;

    setError(null);
    setLocalHit(null);
    setAiJson(null);
    setAiRaw(null);

    // 1) try local
    const hit = lookupLocal(q);
    if (hit) {
      setLocalHit(hit);
      return;
    }

    // 2) fallback to OpenAI via /api/dict
    try {
      setLoading(true);
      const res = await fetch("/api/dict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: q, lang: uiLang }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Lookup failed");

      // Our /api/dict returns { result } where result is a string (JSON text)
      const txt = (json?.result || "").toString().trim();
      setAiRaw(txt);
      try {
        const parsed = JSON.parse(txt);
        setAiJson(parsed);
      } catch {
        // leave as raw if it isn't clean JSON
      }
    } catch (e: any) {
      setError(e?.message || "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  async function play(text: string, lang: "en" | "ja") {
    try {
      const url = await speakText(text, lang);
      new Audio(url).play();
    } catch (e) {
      console.error(e);
      alert("TTS failed. Check Azure TTS key/region.");
    }
  }

  // --- render helpers ---
  function renderLocal(hit: VocabItem) {
    const head = hit.headword || hit.word;
    const defShort = hit.def_en || hit.en || "";
    const ja = hit.ja || "";
    return (
      <div className="space-y-2">
        <div className="text-lg font-semibold">
          {head} {hit.pos ? <span className="text-gray-500 text-sm">· {hit.pos}</span> : null}
          {hit.ipa ? <span className="ml-2 text-gray-500">{hit.ipa}</span> : null}
        </div>
        {defShort && <div className="text-gray-800">{defShort}</div>}
        {ja && <div className="text-gray-700">JA: {ja}</div>}
        {(hit.example_en || hit.example_ja) && (
          <div className="border rounded p-2 bg-white">
            {hit.example_en && <div className="italic">“{hit.example_en}”</div>}
            {hit.example_ja && <div className="text-gray-700">（{hit.example_ja}）</div>}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          {defShort && (
            <button
              className="text-sm border rounded px-2 py-1"
              onClick={() => play(`${head}. ${defShort}`, "en")}
            >
              ▶︎ Play EN
            </button>
          )}
          {ja && (
            <button
              className="text-sm border rounded px-2 py-1"
              onClick={() => play(`${head}。${ja}`, "ja")}
            >
              ▶︎ 再生(日本語)
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderAI() {
    if (aiJson) {
      const h = aiJson.headword || query;
      return (
        <div className="space-y-2">
          <div className="text-lg font-semibold">
            {h} {aiJson.pos ? <span className="text-gray-500 text-sm">· {aiJson.pos}</span> : null}
          </div>
          {aiJson.def_en && <div className="text-gray-800">{aiJson.def_en}</div>}
          {aiJson.ja && <div className="text-gray-700">JA: {aiJson.ja}</div>}
          {(aiJson.example_en || aiJson.example_ja) && (
            <div className="border rounded p-2 bg-white">
              {aiJson.example_en && <div className="italic">“{aiJson.example_en}”</div>}
              {aiJson.example_ja && <div className="text-gray-700">（{aiJson.example_ja}）</div>}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            {aiJson.def_en && (
              <button
                className="text-sm border rounded px-2 py-1"
                onClick={() => play(`${h}. ${aiJson.def_en}`, "en")}
              >
                ▶︎ Play EN
              </button>
            )}
            {aiJson.ja && (
              <button
                className="text-sm border rounded px-2 py-1"
                onClick={() => play(`${h}。${aiJson.ja}`, "ja")}
              >
                ▶︎ 再生(日本語)
              </button>
            )}
          </div>
        </div>
      );
    }

    // raw fallback when parsing failed
    if (aiRaw) {
      return (
        <pre className="whitespace-pre-wrap text-sm bg-white border rounded p-2">
          {aiRaw}
        </pre>
      );
    }

    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-50 border-t shadow-lg p-4 max-h-80 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">Dictionary</h2>
        <div className="flex items-center gap-2">
          <button
            className="text-sm border rounded px-2 py-1"
            onClick={() => {
              setQuery("");
              setLocalHit(null);
              setAiJson(null);
              setAiRaw(null);
              setError(null);
            }}
          >
            Clear
          </button>
          <button
            className="text-sm text-gray-500 hover:underline"
            onClick={() => onClose?.()}
          >
            ✕ Close
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          className="border rounded px-2 py-1 flex-1"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type or select text…"
        />
        <button
          onClick={handleLookup}
          disabled={loading || !query.trim()}
          className="bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50"
        >
          {loading ? "Looking up…" : "Lookup"}
        </button>
      </div>

      {error && <div className="text-red-600 mb-2">{error}</div>}

      {/* Local first, then AI */}
      {localHit ? (
        <div className="bg-blue-50 border-l-4 border-blue-400 rounded p-3">
          {renderLocal(localHit)}
          <div className="mt-3 text-xs text-blue-900">
            Source: Article Vocab
          </div>
        </div>
      ) : aiJson || aiRaw ? (
        <div className="bg-white border rounded p-3">{renderAI()}</div>
      ) : (
        <div className="text-sm text-gray-600">
          Type a word/phrase, or select text in the article to auto-fill here.
        </div>
      )}
    </div>
  );
}
