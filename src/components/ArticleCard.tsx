import Link from "next/link";

export type Article = {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  summary: string;
};

export default function ArticleCard({ a }: { a: Article }) {
  const d = new Date(a.publishedAt);
  return (
    <article className="rounded-2xl border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">
        <Link href={`/article/${a.id}`} className="hover:underline">
          {a.title}
        </Link>
      </h2>
      <div className="mt-1 text-sm text-gray-500">
        {a.source} · {d.toLocaleString()}
      </div>
      <p className="mt-2 text-sm leading-6 text-gray-700">{a.summary}</p>
    </article>
  );
}
