import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicWatchlistView from "@/components/share/PublicWatchlistView";
import { getPublicWatchlist } from "@/lib/publicWatchlist";

type PageProps = { params: Promise<{ slug: string }> };

/**
 * Public share page — deliberately outside the `(app)` group and absent from
 * `middleware.ts`'s matcher, so it renders for visitors with no session.
 */
export default async function SharePage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getPublicWatchlist(slug);
  if (!data) notFound();

  return <PublicWatchlistView data={data} />;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicWatchlist(slug);
  if (!data) return { title: "Watchlist not found · Lumière" };

  const owner = data.owner.name?.trim() || "Someone";
  const title = data.label?.trim() || `${owner}'s watchlist`;
  const description = `${data.total} ${data.total === 1 ? "title" : "titles"} on Lumière.`;

  return {
    title: `${title} · Lumière`,
    description,
    // A shared link is pasted into chats far more often than it is typed, so
    // the unfurl is part of the feature.
    openGraph: { title, description, type: "profile" },
    twitter: { card: "summary", title, description },
    // Public but not worth indexing: these are personal pages handed to
    // specific people, not content anyone searched for.
    robots: { index: false, follow: false },
  };
}
