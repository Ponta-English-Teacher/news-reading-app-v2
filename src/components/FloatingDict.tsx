"use client";

import { useEffect, useRef, useState } from "react";
import { speakText } from "@/utils/tts";

type Vocab = {
  word?: string;
  headword?: string;
  pos?: string;
  ipa?: string;
  en?: string;
  ja?: string;
  def_en?: string;
  example_en?: string;
  example_ja?: string;
};

type LookupResult = {
  term: string;
  pos?: string;
  ipa?: string;
  def_en?: string;
  ja?: string;
  exampleEn?: string;
  exampleJa?: string;
  source: "json" | "openai";
};

type Props = {
  open: boolean;
  onClose: () => void;
  query: string; // prefilled from selection
  uiLang: "en" | "ja";
  vocabList: Vocab[];
  onSaveGlossary: (item: { term: string; def_en?: string; ja?: string; source: "json" | "openai" }) => void;
};

export default function FloatingDict({
  open,
  onClose,
  query,
  uiLang,
  vocabList,
  onSaveGlossary,
}: Props) {
  // ---------- UI state ----------
  const [term, setTerm] = useState(query || "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [isPlayingSel, setIsPlayingSel] = useState(false);
  const [isPlayingDef, setIsPlayingDef] = useState(false);

  // position (start centered; draggable)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const dragging = useRef<{
    startX: number;
    startY: number;
    startTop: number;
    startLeft: number;
    active: boolean;
  } | null>(null);

  // Keep input synced with new selection from page
  useEffect(() => {
    setTerm(query || "");
  }, [query]);

  // Center on first open
  useEffect(() => {
    if (!open) return;
    if (!pos) {
      const top = Math.round(window.innerHeight * 0.18);
      const left = Math.round(window.innerWidth / 2);
      setPos({ top, left });
    }
  }, [open, pos]);

  // ---------- Drag handlers ----------
  function onDragStart(e: React.MouseEvent) {
    if (!pos) return;
    dragging.current = {
      startX: e.clientX,
      startY: e.clientY,
      startTop: pos.top,
      startLeft: pos.left,
      active: true,
    };
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
  }
  function onDragMove(e: MouseEvent) {
    if (!dragging.current?.active) return;
    const dx = e.clientX - dragging.current.startX;
    const dy = e.clientY - dragging.current.startY;
    setPos({
      top: Math.max(8, dragging.current.startTop + dy),
      left: dragging.current.startLeft + dx,
    });
  }
  function onDragEnd() {
    if (dragging.current) dragging.current.active = false;
    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", onDragEnd);
  }

  // ---------- Lookup helpers ----------
  function normalize(s: string) {
    return (s || "")
      .trim()
      .toLowerCase()
      .replace(/[.,!?;:"“”‘’()［］\[\]{}…]/g, "");
  }

  function lookupLocal(q: string): LookupResult | null {
    const n = normalize(q);
    // Exact headword/word match; then partial (any word in phrase matches a headword)
    let best: Vocab | undefined =
      vocabList.find(
        (v) => normalize(v.headword || "") === n || normalize(v.word || "") === n
      ) ||
      vocabList.find((v) =>
        n.split(/\s+/).includes(normalize(v.headword || "")),
      );

    if (!best) return null;

    return {
      term: q,
      pos: best.pos || "",
      ipa: best.ipa || "",
      def_en: best.def_en || best.en || "",
      ja: best.ja || "",
      exampleEn: best.example_en || "",
      exampleJa: best.example_ja || "",
      source: "json",
    };
  }

  async function lookupRemote(q: string): Promise<LookupResult> {
    const res = await fetch(`/api/lookup?q=${encodeURIComponent(q)}&ui=${uiLang}`, { method: "GET" });
    if (!res.ok) {
      const msg = (await res.json().catch(() => ({} as any)))?.error || "LOOKUP_FAILED";
      throw new Error(msg);
    }
    const json = await res.json();
    return {
      term: q,
      pos: json.pos || "",
      ipa: json.ipa || "",
      def_en: json.def_en || "",
      ja: json.ja || "",
      exampleEn: json.exampleEn || "",
      exampleJa: json.exampleJa || "",
      source: (json.source as "json" | "openai") || "openai",
    };
  }

  async function handleLookup() {
    const q = (term || "").trim();
    if (!q) return;
    setErr(null);
    setLoading(true);
    try {
      // local-first, then OpenAI
      const local = lookupLocal(q);
      if (local) {
        setResult(local);
      } else {
        const remote = await lookupRemote(q);
        setResult(remote);
      }
    } catch (e: any) {
      setErr(e?.message || "Lookup failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  // ---------- TTS ----------
  async function handlePlaySelection() {
    const toSpeak =
      (term || "").trim() ||
      (result?.term || "").trim() ||
      (query || "").trim();
    if (!toSpeak) return;

    try {
      setIsPlayingSel(true);
      const url = await speakText(toSpeak, uiLang);
      const audio = new Audio(url);
      audio.play();
      audio.onended = () => setIsPlayingSel(false);
      audio.onerror = () => setIsPlayingSel(false);
    } catch {
      setIsPlayingSel(false);
    }
  }

  async function handlePlayDefinition() {
    // Prefer definition in UI language; fall back to the other, then to term
    let toSpeak = "";
    if (uiLang === "ja") {
      toSpeak = (result?.ja || result?.def_en || term || query || "").trim();
    } else {
      toSpeak = (result?.def_en || result?.ja || term || query || "").trim();
    }
    if (!toSpeak) return;

    try {
      setIsPlayingDef(true);
      const url = await speakText(toSpeak, uiLang);
      const audio = new Audio(url);
      audio.play();
      audio.onended = () => setIsPlayingDef(false);
      audio.onerror = () => setIsPlayingDef(false);
    } catch {
      setIsPlayingDef(false);
    }
  }

  function handleSave() {
    if (!result) return;
    onSaveGlossary({
      term: result.term,
      def_en: result.def_en,
      ja: result.ja,
      source: result.source,
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {/* Outer window */}
      <div
        className="pointer-events-auto shadow-2xl ring-1 ring-black/10 bg-white rounded-xl"
        style={{
          position: "absolute",
          top: pos ? pos.top : 120,
          left: pos ? pos.left : window.innerWidth / 2,
          transform: "translate(-50%, 0)",
          // Flexible width that can stretch, with a sane max
          width: "min(96vw, 900px)",
          maxHeight: "80vh",
          // Allow manual horizontal resize
          resize: "horizontal",
          overflow: "hidden",
          // Keep header, body, footer laid out vertically
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Title bar (draggable) */}
        <div
          className="fd-titlebar flex items-center justify-between px-4 py-2 cursor-move select-none rounded-t-xl bg-slate-900 text-white"
          onMouseDown={onDragStart}
        >
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500"></span>
            <span className="text-sm font-semibold">Dictionary</span>
          </div>
          <button
            onClick={onClose}
            className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
          >
            Close ✕
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="p-4 space-y-3 overflow-y-auto" style={{ flex: 1, minHeight: 0 }}>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Type or paste a word / phrase / sentence…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLookup();
              }}
            />
            <button className="btn" onClick={handleLookup} disabled={loading}>
              {loading ? "Looking…" : "Look up"}
            </button>
            {query && (
              <button
                className="btn"
                onClick={() => setTerm(query)}
                title="Use the currently selected text"
              >
                Use selection
              </button>
            )}
          </div>

          {err && <div className="text-sm text-rose-600">{err}</div>}

          {result ? (
            <div className="mt-2 space-y-2">
              <div className="text-[13px] text-slate-500">
                {result.source === "json" ? "Local vocab" : "OpenAI"} • {result.pos || "—"}{" "}
                {result.ipa && <span className="ml-2">{result.ipa}</span>}
              </div>

              {/* English definition */}
              {result.def_en && (
                <div className="bg-slate-50 border rounded p-3">
                  <div className="text-xs font-semibold text-slate-600 mb-1">EN</div>
                  <div className="text-sm leading-6">{result.def_en}</div>
                </div>
              )}
              {/* Japanese gloss */}
              {result.ja && (
                <div className="bg-slate-50 border rounded p-3">
                  <div className="text-xs font-semibold text-slate-600 mb-1">JA</div>
                  <div className="text-sm leading-6">{result.ja}</div>
                </div>
              )}
              {/* Examples */}
              {(result.exampleEn || result.exampleJa) && (
                <div className="bg-white border rounded p-3">
                  <div className="text-xs font-semibold text-slate-600 mb-1">Examples</div>
                  {result.exampleEn && <div className="text-sm leading-6">EN: {result.exampleEn}</div>}
                  {result.exampleJa && <div className="text-sm leading-6">JA: {result.exampleJa}</div>}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-slate-500">Enter a term and press “Look up”.</div>
          )}
        </div>

        {/* Footer: actions (always visible) */}
        <div className="px-4 py-3 border-t bg-white rounded-b-xl">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn-primary px-3 py-2"
              onClick={handlePlaySelection}
              disabled={isPlayingSel}
              title="Read the selected/typed text"
            >
              {isPlayingSel ? "Playing…" : "🔊 Play Selection"}
            </button>

            <button
              className="btn px-3 py-2"
              onClick={handlePlayDefinition}
              disabled={isPlayingDef || (!result?.def_en && !result?.ja)}
              title="Read the definition"
            >
              {isPlayingDef ? "Playing…" : "📖 Play Definition"}
            </button>

            <button className="btn px-3 py-2" onClick={handleSave} disabled={!result}>
              + Save to Glossary
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
