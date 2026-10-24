import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  Mic,
  Square,
  Download,
  Maximize,
  Headphones,
  Loader2,
} from "lucide-react";
import { getSong } from "@/lib/songs";
import { parseLrc, activeLineIndex, formatTime, type LyricLine } from "@/lib/lrc";
import { useAudioTimeline } from "@/lib/useAudioTimeline";
import { useMicRecorder, isRecordingSupported } from "@/lib/recorder";
import { mixTracks } from "@/lib/mixer";
import { encodeMp3, downloadBlob } from "@/lib/mp3";

export const Route = createFileRoute("/sing/$songId")({
  loader: ({ params }) => {
    const song = getSong(params.songId);
    if (!song) throw notFound();
    return { song };
  },
  head: ({ loaderData }) => {
    const t = loaderData
      ? `${loaderData.song.title} — Karaoke Studio`
      : "Song unavailable — Karaoke Studio";
    const d = loaderData
      ? `Sing ${loaderData.song.title} by ${loaderData.song.artist} with synced lyrics.`
      : "Song not found.";
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
        { property: "og:type", content: "music.song" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: Sing,
});

const btn =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
const btnPrimary = `${btn} bg-brand text-primary-foreground shadow-glow hover:brightness-110`;
const btnGhost = `${btn} bg-secondary text-secondary-foreground hover:bg-muted`;

function Sing() {
  const { song } = Route.useLoaderData();
  const tl = useAudioTimeline(song.audioUrl, song.vocalUrl);
  const rec = useMicRecorder();
  const [lines, setLines] = useState<LyricLine[]>([]);
  const [supported, setSupported] = useState(true);
  const [backgroundVideoError, setBackgroundVideoError] = useState(false);
  const recStartRef = useRef<{ offset: number; at: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const backgroundVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => setSupported(isRecordingSupported()), []);
  useEffect(() => {
    const video = backgroundVideoRef.current;
    if (!video) return;

    if (!tl.playing) {
      video.pause();
      return;
    }

    void video.play().then(
      () => setBackgroundVideoError(false),
      () => setBackgroundVideoError(true),
    );
  }, [tl.playing, song.backgroundVideo]);
  useEffect(() => {
    const video = backgroundVideoRef.current;
    if (
      !video ||
      video.readyState < HTMLMediaElement.HAVE_METADATA ||
      !Number.isFinite(video.duration) ||
      video.duration <= 0
    )
      return;

    const targetTime = tl.time % video.duration;
    const drift = Math.abs(video.currentTime - targetTime);
    if (drift > (tl.playing ? 0.5 : 0.05)) video.currentTime = targetTime;
  }, [tl.time, tl.playing]);
  useEffect(() => {
    fetch(song.lrcUrl)
      .then((r) => r.text())
      .then((t) => setLines(parseLrc(t)));
  }, [song.lrcUrl]);

  const active = activeLineIndex(lines, tl.time);
  const lineRefs = useRef<(HTMLLIElement | null)[]>([]);
  useEffect(() => {
    lineRefs.current[Math.max(0, active)]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [active]);

  // Stop recording when the song ends
  useEffect(() => {
    if (!tl.playing && rec.status === "recording" && tl.duration && tl.time >= tl.duration - 0.05)
      rec.stop();
  }, [tl.playing, tl.time, tl.duration, rec]);

  const startRecording = () =>
    rec.start(() => {
      recStartRef.current = {
        offset: tl.audioRef.current?.currentTime ?? 0,
        at: performance.now(),
      };
      tl.play();
    });
  const stopRecording = () => {
    rec.stop();
    tl.pause();
  };

  const recElapsed =
    rec.status === "recording" && recStartRef.current
      ? (performance.now() - recStartRef.current.at) / 1000
      : 0;
  const recording = rec.status === "recording";

  return (
    <div ref={stageRef} className="flex min-h-screen flex-col bg-background bg-stage">
      <header className="flex items-center justify-between gap-4 px-4 py-4 md:px-8">
        <Link to="/" className={btnGhost} aria-label="Back to library">
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Library</span>
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={song.cover}
            alt=""
            width={48}
            height={48}
            className="h-11 w-11 rounded-lg object-cover"
          />
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold">{song.title}</p>
            <p className="truncate text-xs text-muted-foreground">{song.artist}</p>
          </div>
        </div>
        <button
          className={btnGhost}
          aria-label="Full screen"
          onClick={() =>
            document.fullscreenElement
              ? document.exitFullscreen()
              : stageRef.current?.requestFullscreen()
          }
        >
          <Maximize className="h-4 w-4" />
        </button>
      </header>

      <main className="relative flex-1 overflow-hidden">
        {song.backgroundVideo && (
          <video
            ref={backgroundVideoRef}
            className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover opacity-30"
            src={song.backgroundVideo}
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
            onError={() => setBackgroundVideoError(true)}
          />
        )}
        <ul
          className="relative z-10 h-[52vh] overflow-y-auto px-6 py-[22vh] text-center [scrollbar-width:none] md:h-[58vh]"
          aria-live="polite"
        >
          {lines.map((l, i) => (
            <li
              key={i}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              onClick={() => tl.seek(l.time)}
              className={`cursor-pointer py-3 font-display text-2xl font-semibold transition-all duration-300 md:text-4xl ${
                i === active
                  ? "lyric-active"
                  : i === active + 1
                    ? "text-muted-foreground"
                    : "text-muted-foreground/40"
              }`}
            >
              {l.text || "♪"}
            </li>
          ))}
        </ul>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-24 bg-gradient-to-b from-background to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 bg-gradient-to-t from-background to-transparent" />
      </main>

      {backgroundVideoError && (
        <p role="status" className="text-center text-sm text-destructive">
          The background video couldn&apos;t be played.
        </p>
      )}

      <section className="mx-auto w-full max-w-4xl space-y-5 px-4 pb-8 md:px-8">
        <div className="flex items-center gap-3 text-xs tabular-nums text-muted-foreground">
          <span>{formatTime(tl.time)}</span>
          <input
            type="range"
            aria-label="Seek"
            min={0}
            max={tl.duration || 0}
            step={0.1}
            value={tl.time}
            disabled={recording}
            onChange={(e) => tl.seek(Number(e.target.value))}
            className="flex-1"
          />
          <span>{formatTime(tl.duration)}</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            className={btnGhost}
            onClick={tl.restart}
            disabled={recording}
            aria-label="Restart"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            className={`${btnPrimary} h-14 w-14 px-0`}
            onClick={tl.playing ? tl.pause : tl.play}
            disabled={recording}
            aria-label={tl.playing ? "Pause" : "Play"}
          >
            {tl.playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 fill-current" />}
          </button>
          <label className="flex items-center gap-2 text-muted-foreground">
            <Volume2 className="h-4 w-4" />
            <span className="sr-only">Volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={tl.volume}
              onChange={(e) => tl.setVolume(Number(e.target.value))}
              className="w-24"
            />
          </label>
          {song.vocalUrl && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mic className="h-4 w-4" />
              <span>Vocals · {Math.round(tl.vocalVolume * 100)}%</span>
              <input
                type="range"
                aria-label="Vocal volume"
                min={0}
                max={1}
                step={0.01}
                value={tl.vocalVolume}
                onChange={(e) => tl.setVocalVolume(Number(e.target.value))}
                className="w-24"
              />
            </label>
          )}

          {!recording ? (
            <button
              className={`${btn} bg-destructive text-destructive-foreground hover:brightness-110`}
              onClick={startRecording}
              disabled={!supported || rec.status === "requesting"}
            >
              {rec.status === "requesting" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mic className="h-4 w-4" />
              )}{" "}
              Start Recording
            </button>
          ) : (
            <button
              className={`${btn} bg-destructive text-destructive-foreground`}
              onClick={stopRecording}
            >
              <Square className="h-4 w-4 fill-current" /> Stop Recording
              <span className="ml-1 flex items-center gap-1.5 tabular-nums">
                <span className="h-2 w-2 animate-pulse rounded-full bg-destructive-foreground" />{" "}
                {formatTime(recElapsed)}
              </span>
            </button>
          )}
        </div>

        {tl.vocalError && (
          <p role="status" className="text-center text-sm text-destructive">
            {tl.vocalError}
          </p>
        )}
        <StatusNote status={rec.status} supported={supported} error={rec.error} />

        {rec.status === "stopped" && rec.blob && recStartRef.current && (
          <ExportPanel
            instrumentalUrl={song.audioUrl}
            vocal={rec.blob}
            offset={recStartRef.current.offset}
            title={song.title}
            onDiscard={rec.reset}
          />
        )}

        <p className="text-center text-xs text-muted-foreground">
          <Headphones className="mr-1 inline h-3 w-3" /> Use headphones while recording so the
          backing track isn't captured by your mic.
        </p>
      </section>
    </div>
  );
}

function StatusNote({
  status,
  supported,
  error,
}: {
  status: string;
  supported: boolean;
  error: string | null;
}) {
  let msg: string | null = null;
  if (!supported || status === "unsupported")
    msg = "Recording isn't supported in this browser. You can still sing along.";
  else if (status === "denied")
    msg = "Microphone access was blocked. Allow it in your browser's site settings and try again.";
  else if (status === "error") msg = `Couldn't start recording: ${error}`;
  else if (status === "requesting") msg = "Waiting for microphone permission…";
  if (!msg) return null;
  return (
    <p
      role="status"
      className="rounded-xl border border-border bg-card px-4 py-3 text-center text-sm text-muted-foreground"
    >
      {msg}
    </p>
  );
}

function ExportPanel({
  instrumentalUrl,
  vocal,
  offset,
  title,
  onDiscard,
}: {
  instrumentalUrl: string;
  vocal: Blob;
  offset: number;
  title: string;
  onDiscard: () => void;
}) {
  const [instGain, setInstGain] = useState(0.8);
  const [vocGain, setVocGain] = useState(1);
  const [previewing, setPreviewing] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const vocalUrl = useRef("");
  const pair = useRef<{ i: HTMLAudioElement; v: HTMLAudioElement } | null>(null);

  if (!vocalUrl.current) vocalUrl.current = URL.createObjectURL(vocal);
  useEffect(
    () => () => {
      pair.current?.i.pause();
      pair.current?.v.pause();
      URL.revokeObjectURL(vocalUrl.current);
    },
    [],
  );
  useEffect(() => {
    if (pair.current) {
      pair.current.i.volume = Math.min(1, instGain);
      pair.current.v.volume = Math.min(1, vocGain);
    }
  }, [instGain, vocGain]);

  const togglePreview = async () => {
    if (pair.current) {
      pair.current.i.pause();
      pair.current.v.pause();
      pair.current = null;
      return setPreviewing(false);
    }
    const i = new Audio(instrumentalUrl);
    const v = new Audio(vocalUrl.current);
    i.volume = Math.min(1, instGain);
    v.volume = Math.min(1, vocGain);
    i.currentTime = offset;
    v.onended = () => {
      i.pause();
      pair.current = null;
      setPreviewing(false);
    };
    pair.current = { i, v };
    setPreviewing(true);
    await Promise.all([i.play(), v.play()]);
  };

  const exportMp3 = async () => {
    setErr(null);
    setProgress(0);
    try {
      const mixed = await mixTracks(instrumentalUrl, vocal, {
        instrumentalGain: instGain,
        vocalGain: vocGain,
        vocalOffset: offset,
      });
      const mp3 = await encodeMp3(mixed, 192, setProgress);
      downloadBlob(mp3, `${title.replace(/\s+/g, "-").toLowerCase()}-karaoke.mp3`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold">Your take</h2>
        <audio
          controls
          src={vocalUrl.current}
          className="h-9 max-w-full"
          aria-label="Raw vocal recording"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-muted-foreground">
          Backing track · {Math.round(instGain * 100)}%
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.05}
            value={instGain}
            onChange={(e) => setInstGain(Number(e.target.value))}
            className="mt-2 w-full"
          />
        </label>
        <label className="text-sm text-muted-foreground">
          Vocals · {Math.round(vocGain * 100)}%
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.05}
            value={vocGain}
            onChange={(e) => setVocGain(Number(e.target.value))}
            className="mt-2 w-full"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        <button className={btnGhost} onClick={togglePreview}>
          {previewing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{" "}
          {previewing ? "Stop preview" : "Preview mix"}
        </button>
        <button className={btnPrimary} onClick={exportMp3} disabled={progress !== null}>
          {progress !== null ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {progress !== null ? `Encoding ${Math.round(progress * 100)}%` : "Export MP3"}
        </button>
        <button className={btnGhost} onClick={onDiscard}>
          Discard
        </button>
      </div>
      {err && <p className="text-sm text-destructive">Export failed: {err}</p>}
    </div>
  );
}
