import Link from "next/link";
import data from "@/data/articles.json";

export default function HomePage() {
  const articles = data as any[];

  return (
    <main className="page-wrap py-8">
      <div className="news-frame p-6 space-y-6">
        <h1 className="text-3xl font-extrabold">Latest Articles</h1>

        <ul className="space-y-4">
          {articles.map((article) =>
            article.segments.map((seg: any) => (
              <li key={`${article.id}-${seg.id}`} className="card p-4">
                <Link
                  href={`/article/${article.id}/${seg.id}`}
                  className="text-xl text-blue-600 hover:underline"
                >
                  {seg.headline_en}
                </Link>
                <p className="text-gray-500 text-sm">
                  {new Date(article.publishedAt).toLocaleString()}
                </p>
              </li>
            ))
          )}
        </ul>

        <footer className="pt-2 text-center text-gray-600 text-sm">
          This app was made by Hitoshi Eguchi @ Hokusei Gakuen University
        </footer>
      </div>
    </main>
  );
}
