"use client";

import { useState } from "react";
import { speakText } from "@/utils/tts";

type Props = {
  segment: any;
};

export default function LearningControls({ segment }: Props) {
  const [showEasy, setShowEasy] = useState(false);

  async function play(text: string, lang: "en" | "ja") {
    try {
      const url = await speakText(text, lang);
      new Audio(url).play();
    } catch (err) {
      console.error(err);
      alert("TTS playback failed. Check your Azure TTS config.");
    }
  }

  return (
    <div className="flex flex-wrap gap-2 my-4">
      {/* Play English button */}
      <button
        onClick={() =>
          play(segment.variants?.JHS?.en?.body || segment.variants?.HS?.en?.body || "", "en")
        }
        className="px-3 py-1 bg-blue-600 text-white rounded"
      >
        ▶︎ Play EN
      </button>

      {/* Play Japanese button */}
      <button
        onClick={() =>
          play(segment.variants?.JHS?.ja?.body || segment.variants?.HS?.ja?.body || "", "ja")
        }
        className="px-3 py-1 bg-green-600 text-white rounded"
      >
        ▶︎ 再生 (日本語)
      </button>

      {/* Toggle easy mode */}
      <button
        onClick={() => setShowEasy(!showEasy)}
        className="px-3 py-1 bg-gray-200 rounded"
      >
        {showEasy ? "Hide Easy" : "Show Easy"}
      </button>

      {showEasy && (
        <div className="w-full mt-2 p-3 border rounded bg-yellow-50">
          <h4 className="font-semibold text-sm mb-1">Easy Mode</h4>
          <p>{segment.variants?.JHS?.en?.easy?.body}</p>
          <p className="text-gray-700">{segment.variants?.JHS?.ja?.easy?.body}</p>
        </div>
      )}
    </div>
  );
}
