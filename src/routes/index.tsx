import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Mic2, Play } from "lucide-react";
import { songs } from "@/lib/songs";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Karaoke Studio — Pick a song and sing" },
      { name: "description", content: "Browse the song library, sing with synced lyrics, record your vocals and export an MP3." },
      { property: "og:title", content: "Karaoke Studio" },
      { property: "og:description", content: "Sing with synced lyrics, record and export MP3s in your browser." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Library,
});

function Library() {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return songs.filter((x) => !s || `${x.title} ${x.artist} ${x.genre}`.toLowerCase().includes(s));
  }, [q]);

  return (
    <div className="min-h-screen bg-stage">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-6 pt-8">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand shadow-glow">
          <Mic2 className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="font-display text-lg font-bold tracking-tight">Karaoke Studio</span>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-20">
        <section className="py-14 md:py-20">
          <h1 className="font-display text-4xl font-bold leading-tight md:text-6xl">
            Take the <span className="text-brand">stage</span>.
          </h1>
          <p className="mt-4 max-w-lg text-muted-foreground">
            Pick a track, follow the glowing lyrics, record your voice and take home an MP3.
          </p>
          <label className="mt-8 flex max-w-md items-center gap-3 rounded-full border border-input bg-card/70 px-5 py-3 backdrop-blur focus-within:ring-2 focus-within:ring-ring">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="sr-only">Search songs</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search songs, artists, genres"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
        </section>

        {list.length === 0 ? (
          <p className="text-muted-foreground">No songs match “{q}”.</p>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((s) => (
              <li key={s.id}>
                <Link
                  to="/sing/$songId"
                  params={{ songId: s.id }}
                  className="group block overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-1 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="relative aspect-square overflow-hidden">
                    <img src={s.cover} alt="" width={816} height={816} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    <span className="absolute bottom-4 right-4 grid h-12 w-12 place-items-center rounded-full bg-brand opacity-0 shadow-glow transition group-hover:opacity-100 group-focus-visible:opacity-100">
                      <Play className="h-5 w-5 fill-current text-primary-foreground" />
                    </span>
                  </div>
                  <div className="flex items-end justify-between p-5">
                    <div>
                      <h2 className="font-display text-lg font-semibold">{s.title}</h2>
                      <p className="text-sm text-muted-foreground">{s.artist}</p>
                    </div>
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">{s.genre}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
