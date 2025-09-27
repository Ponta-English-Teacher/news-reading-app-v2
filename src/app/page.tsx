import Link from "next/link";

type Article = {
  id: string;
  category?: string;
  source?: string;
  publishedAt?: string;
  title?: string;
  summary?: string;
  segments: Array<{ id: string; headline_en?: string; headline_ja?: string }>;
};

async function fetchArticles(): Promise<Article[]> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/articles.json`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    if (!Array.isArray(raw)) throw new Error("Root is not an array");

    return raw
      .filter(
        (a: any) =>
          a &&
          a.id &&
          Array.isArray(a.segments) &&
          a.segments.length > 0
      )
      .map((a: any) => ({
        id: String(a.id),
        category: a.category,
        source: a.source,
        publishedAt: a.publishedAt || a.date || "",
        title: a.title || a.segments[0]?.headline_en || "", // prefer explicit title
        summary: a.summary || a.segments[0]?.headline_ja || "", // fallback to JP headline
        segments: a.segments.map((s: any) => ({
          id: String(s.id),
          headline_en: s.headline_en,
          headline_ja: s.headline_ja,
        })),
      })) as Article[];
  } catch {
    return [];
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const articles = await fetchArticles();

  return (
    <main className="page-wrap py-8">
      <div className="news-frame p-6 space-y-6">
        <h1 className="text-xl font-semibold">News Reading App</h1>

        {articles.length === 0 ? (
          <div className="text-sm text-red-600">
            Could not load <code>public/articles.json</code> or it’s empty/invalid.
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {articles.map((a) => {
              const firstSeg = a.segments[0]?.id ?? "seg-1";
              return (
                <li
                  key={a.id}
                  className="border rounded p-4 bg-white flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span className="badge">{a.category || "General"}</span>
                    <span>{a.publishedAt || "No date"}</span>
                  </div>
                  <div className="text-lg font-semibold">
                    {a.title || `Article ${a.id}`}
                  </div>
                  {a.summary && (
                    <p className="text-sm text-gray-700">{a.summary}</p>
                  )}
                  <div className="mt-2">
                    <Link
                      href={`/article/${a.id}/${firstSeg}`}
                      className="btn btn-primary"
                    >
                      Open {a.id}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
