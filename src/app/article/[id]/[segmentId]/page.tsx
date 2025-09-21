"use client";

import { useEffect, useRef, useState } from "react";
import { notFound } from "next/navigation";
import data from "@/data/articles.json";
import { speakText } from "@/utils/tts";
import FloatingDict from "@/components/FloatingDict";

export default function ArticlePage({
  params,
}: {
  params: { id: string; segmentId: string };
}) {
  // ---data---
  const articles = data as any[];
  const article = articles.find((a) => a.id === params.id);
  if (!article) return notFound();
  const segment = article.segments.find((s: any) => s.id === params.segmentId);
  if (!segment) return notFound();

  // ---toggles---
  const [level, setLevel] = useState<"JHS" | "HS">("JHS");
  const [lang, setLang] = useState<"en" | "ja">("en");
  const [showEasy, setShowEasy] = useState(true);

  const variant = segment.variants?.[level]?.[lang];

  // ---Model TTS---
  const [isTtsLoading, setIsTtsLoading] = useState(false);
  const [ttsUrl, setTtsUrl] = useState<string | null>(null);
  async function handlePlayModelSpeech() {
    clearSelection();
    if (!variant) return;
    const text = [variant.greeting, variant.lead, variant.summary, variant.body, variant.signoff]
      .filter(Boolean)
      .join(" ");
    try {
      setIsTtsLoading(true);
      const url = await speakText(text, lang);
      setTtsUrl(url);
      new Audio(url).play();
    } catch (e) {
      console.error(e);
      alert("Azure TTS failed. Check your key/region in .env.local.");
    } finally {
      setIsTtsLoading(false);
    }
  }

  // ---Recording (pause/resume, progress, selection-safe)---
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [myUrl, setMyUrl] = useState<string | null>(null);
  const [fileExt, setFileExt] = useState<"webm" | "mp4">("webm");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);

  function clearSelection() {
    try {
      // prevent dictionary popup from button clicks
      const sel = window.getSelection?.();
      if (sel && sel.rangeCount) sel.removeAllRanges();
    } catch {}
  }

  function pickBestMime(): { mime: string; ext: "webm" | "mp4" } {
    const webm = "audio/webm;codecs=opus";
    const mp4 = "audio/mp4";
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(webm)) {
      return { mime: webm, ext: "webm" };
    }
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mp4)) {
      return { mime: mp4, ext: "mp4" };
    }
    return { mime: "", ext: "webm" };
  }

  async function startRecording() {
    clearSelection();
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { mime, ext } = pickBestMime();
      setFileExt(ext);
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recordedChunksRef.current = [];
      setMyUrl(null);
      setDurationSec(null);

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: mr.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        setMyUrl(url);
        if (startedAt) setDurationSec((Date.now() - startedAt) / 1000);
        setIsPaused(false);
      };

      mediaRecorderRef.current = mr;
      setStartedAt(Date.now());
      mr.start();
      setIsRecording(true);
      setIsPaused(false);
    } catch (e) {
      console.error(e);
      alert("Microphone not available. Please allow mic permission.");
    }
  }

  function pauseRecording() {
    clearSelection();
    const mr = mediaRecorderRef.current;
    if (!mr || !isRecording || isPaused) return;
    try {
      mr.pause();
      setIsPaused(true);
    } catch (e) {
      console.error(e);
    }
  }

  function resumeRecording() {
    clearSelection();
    const mr = mediaRecorderRef.current;
    if (!mr || !isRecording || !isPaused) return;
    try {
      mr.resume();
      setIsPaused(false);
    } catch (e) {
      console.error(e);
    }
  }

  function stopRecording() {
    clearSelection();
    const mr = mediaRecorderRef.current;
    if (mr && isRecording) {
      mr.stop();
      setIsRecording(false);
      setIsPaused(false);
    }
  }

  function playMyRecording() {
    clearSelection();
    if (!myUrl) return;
    new Audio(myUrl).play();
  }

  function downloadMyRecording() {
    clearSelection();
    if (!myUrl) return;
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "");
    const fname = `NewsToday_${article.id}_${segment.id}_${lang}_${level}_${stamp}.${fileExt}`;
    a.href = myUrl;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ---Dictionary (floating) + glossary---
  const [floatOpen, setFloatOpen] = useState(false);
  const [dictQuery, setDictQuery] = useState("");
  const [glossary, setGlossary] = useState<
    { term: string; def_en?: string; ja?: string; source: "json" | "openai" }[]
  >([]);

  // Autofill on text selection → open popup (ignore selections inside the popup titlebar)
  useEffect(() => {
    function onMouseUp() {
      const text = (window.getSelection?.()?.toString() || "").trim();
      if (!text) return;
      const anchor = (window.getSelection?.()?.anchorNode as Node | null)?.parentElement;
      if (anchor && anchor.closest(".fd-titlebar")) return;
      setDictQuery(text);
      setFloatOpen(true);
    }
    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, []);

  // load/save glossary
  useEffect(() => {
    try {
      const raw = localStorage.getItem("nt_glossary");
      if (raw) setGlossary(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("nt_glossary", JSON.stringify(glossary));
    } catch {}
  }, [glossary]);

  function handleSaveGlossary(item: { term: string; def_en?: string; ja?: string; source: "json" | "openai" }) {
    setGlossary((prev) => {
      if (prev.some((p) => p.term === item.term)) return prev;
      return [item, ...prev];
    });
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-[var(--nt-bg)] text-white">
        <div className="mx-auto max-w-4xl px-6">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-sm bg-[var(--nt-accent)]"></div>
              <h1 className="text-lg sm:text-xl font-semibold tracking-wide">News Today</h1>
              <span className="badge ml-2">Learning Edition</span>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-xs text-gray-300">
              <span>EN / JA</span>
              <span>•</span>
              <span>JHS / HS</span>
            </div>
          </div>
        </div>
      </header>

      <main className="page-wrap py-8 space-y-6">
        {/* --- Article metadata card --- */}
        <section className="news-frame p-6 space-y-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">
            {segment.kicker || "News"} · {new Date(article.publishedAt).toLocaleString()}
          </p>
          <h2 className="text-3xl font-extrabold leading-tight">{segment[`headline_${lang}`]}</h2>
          <p className="text-sm text-gray-600">Source: {article.source || "—"}</p>
        </section>

        {/* --- Toggles --- */}
        <section className="card p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Level</label>
            <select
              className="rounded-md border px-2 py-1 bg-white"
              value={level}
              onChange={(e) => {
                clearSelection();
                setLevel(e.target.value as "JHS" | "HS");
              }}
            >
              <option value="JHS">Junior High</option>
              <option value="HS">High School</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Language</label>
            <select
              className="rounded-md border px-2 py-1 bg-white"
              value={lang}
              onChange={(e) => {
                clearSelection();
                setLang(e.target.value as "en" | "ja");
              }}
            >
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
          </div>
          <label className="ml-auto inline-flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={showEasy}
              onChange={(e) => {
                clearSelection();
                setShowEasy(e.target.checked);
              }}
            />
            Easy Mode
          </label>
        </section>

        {/* --- Main article --- */}
        <article className="card p-6 prose prose-news max-w-none select-text">
          {variant?.greeting && <p className="font-semibold">{variant.greeting}</p>}
          {variant?.lead && <p>{variant.lead}</p>}
          {variant?.summary && <p className="italic">{variant.summary}</p>}
          {variant?.body && <p>{variant.body}</p>}
          {variant?.signoff && <p className="text-gray-700">{variant.signoff}</p>}
        </article>

        {/* --- Easy version --- */}
        {showEasy && variant?.easy && (
          <section className="card p-4 border-l-4 border-l-blue-400 bg-blue-50">
            <h3 className="text-lg font-semibold mb-2">Easy Version</h3>
            {variant.easy.summary && <p className="mb-1 italic">{variant.easy.summary}</p>}
            <div>{variant.easy.withFurigana || variant.easy.body}</div>
          </section>
        )}

        {/* --- Model Speech --- */}
        <section className="card p-4 space-y-3">
          <h3 className="text-base font-semibold">Model Speech</h3>
          <button onClick={handlePlayModelSpeech} disabled={isTtsLoading} className="btn btn-primary px-4 py-2">
            {isTtsLoading ? "Loading..." : "▶︎ Play Model Speech"}
          </button>
          {ttsUrl && <audio controls src={ttsUrl} className="mt-2 w-full" />}
        </section>

        {/* --- My Reading --- */}
        <section className="card p-4 space-y-3">
          <h3 className="text-base font-semibold">My Reading</h3>
          <div className="text-sm">Status: {isRecording ? (isPaused ? "Paused" : "Recording") : "Idle"}</div>

          <div className="flex flex-wrap gap-2">
            <button onClick={startRecording} disabled={isRecording} className="btn">🎙️ Record</button>
            <button onClick={pauseRecording} disabled={!isRecording || isPaused} className="btn">⏸️ Pause</button>
            <button onClick={resumeRecording} disabled={!isRecording || !isPaused} className="btn">▶️ Resume</button>
            <button onClick={stopRecording} disabled={!isRecording} className="btn">⏹️ Stop</button>
            <button onClick={playMyRecording} disabled={!myUrl} className="btn">🔊 Play</button>
            <button onClick={downloadMyRecording} disabled={!myUrl} className="btn">⬇️ Download</button>
          </div>

          <div className="text-sm mt-2 space-y-1">
            {durationSec != null && <div>Duration: {durationSec.toFixed(1)} sec</div>}
          </div>
        </section>

        {/* --- Glossary preview --- */}
        <section className="card p-4 space-y-2">
          <h3 className="text-base font-semibold">My Glossary ({glossary.length})</h3>
          {glossary.length === 0 ? (
            <div className="text-sm text-gray-600">No saved words yet.</div>
          ) : (
            <ul className="text-sm list-disc pl-5">
              {glossary.map((g) => (
                <li key={g.term}>
                  <span className="font-medium">{g.term}</span>
                  {g.def_en ? <> — <span className="text-gray-700">{g.def_en}</span></> : null}
                  {g.ja ? <> （{g.ja}）</> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="pt-2 text-center text-gray-600 text-sm">
          This app was made by Hitoshi Eguchi @ Hokusei Gakuen University
        </footer>
      </main>

      {/* --- Floating Dictionary Popup --- */}
      <FloatingDict
        open={floatOpen}
        onClose={() => setFloatOpen(false)}
        query={dictQuery}
        uiLang={lang}
        vocabList={(segment.vocab || []).map((v: any) => ({
          word: v.word || v.headword || v.id || "",
          headword: v.headword || v.word || "",
          pos: v.pos || "",
          ipa: v.ipa || "",
          en: v.en || v.def_en || "",
          ja: v.ja || "",
          def_en: v.def_en || v.en || "",
          example_en: v.example_en || "",
          example_ja: v.example_ja || "",
        })) || []}
        onSaveGlossary={handleSaveGlossary}
      />
    </div>
  );
}
