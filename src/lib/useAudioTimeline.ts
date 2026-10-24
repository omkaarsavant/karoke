import { useCallback, useEffect, useRef, useState } from "react";

/** Single source of truth for playback time: an <audio> element polled via rAF. */
export function useAudioTimeline(src: string, vocalSrc?: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const vocalAudioRef = useRef<HTMLAudioElement | null>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.9);
  const [vocalVolume, setVocalVolumeState] = useState(0);
  const [vocalError, setVocalError] = useState<string | null>(null);

  useEffect(() => {
    const a = new Audio(src);
    a.preload = "auto";
    a.volume = volume;
    audioRef.current = a;
    const vocal = vocalSrc ? new Audio(vocalSrc) : null;
    if (vocal) {
      vocal.preload = "auto";
      vocal.volume = vocalVolume;
      vocalAudioRef.current = vocal;
    }
    setVocalError(null);
    const onMeta = () => setDuration(a.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      vocal?.pause();
    };
    const onVocalError = () =>
      setVocalError("The vocal track couldn't be loaded or played in this browser.");
    vocal?.addEventListener("error", onVocalError);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onPause);
    let raf = 0;
    const tick = () => {
      setTime(a.currentTime);
      if (
        vocal &&
        !a.paused &&
        !vocal.paused &&
        Math.abs(vocal.currentTime - a.currentTime) > 0.12
      ) {
        vocal.currentTime = a.currentTime;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      a.pause();
      a.src = "";
      vocal?.pause();
      if (vocal) {
        vocal.removeEventListener("error", onVocalError);
        vocal.src = "";
      }
      audioRef.current = null;
      vocalAudioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, vocalSrc]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const vocal = vocalAudioRef.current;
    if (vocal) {
      vocal.currentTime = audio.currentTime;
      void vocal
        .play()
        .catch(() =>
          setVocalError("The vocal track couldn't be loaded or played in this browser."),
        );
    }
    return audio.play();
  }, []);
  const pause = useCallback(() => {
    audioRef.current?.pause();
    vocalAudioRef.current?.pause();
  }, []);
  const seek = useCallback((t: number) => {
    if (audioRef.current) audioRef.current.currentTime = t;
    if (vocalAudioRef.current) vocalAudioRef.current.currentTime = t;
  }, []);
  const restart = useCallback(() => seek(0), [seek]);
  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);
  const setVocalVolume = useCallback((v: number) => {
    setVocalVolumeState(v);
    if (vocalAudioRef.current) vocalAudioRef.current.volume = v;
  }, []);

  return {
    audioRef,
    time,
    duration,
    playing,
    volume,
    vocalVolume,
    vocalError,
    play,
    pause,
    seek,
    restart,
    setVolume,
    setVocalVolume,
  };
}
