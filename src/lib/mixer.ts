export interface MixOptions {
  instrumentalGain: number; // 0..1.5
  vocalStemGain: number; // 0..1.5
  microphoneGain: number; // 0..1.5
  /** Seconds into the instrumental at which the vocal recording began. */
  vocalOffset: number;
}

async function decode(ctx: BaseAudioContext, data: Blob | string): Promise<AudioBuffer> {
  let buf: ArrayBuffer;
  if (typeof data === "string") {
    const response = await fetch(data);
    if (!response.ok) throw new Error(`Couldn't load audio track (${response.status}).`);
    buf = await response.arrayBuffer();
  } else {
    buf = await data.arrayBuffer();
  }
  return ctx.decodeAudioData(buf);
}

/** Render instrumental, optional original vocal stem, and microphone take into one stereo buffer. */
export async function mixTracks(
  instrumentalUrl: string,
  microphoneTake: Blob,
  opts: MixOptions,
  vocalStemUrl?: string,
): Promise<AudioBuffer> {
  const tmp = new AudioContext();
  let inst: AudioBuffer;
  let mic: AudioBuffer;
  let stem: AudioBuffer | undefined;
  try {
    [inst, mic, stem] = await Promise.all([
      decode(tmp, instrumentalUrl),
      decode(tmp, microphoneTake),
      vocalStemUrl ? decode(tmp, vocalStemUrl) : Promise.resolve(undefined),
    ]);
  } finally {
    await tmp.close();
  }

  const sampleRate = inst.sampleRate;
  const length = Math.ceil(
    Math.max(inst.duration, stem?.duration ?? 0, opts.vocalOffset + mic.duration) * sampleRate,
  );
  const ctx = new OfflineAudioContext(2, length, sampleRate);

  const add = (buffer: AudioBuffer, gain: number, when: number) => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(ctx.destination);
    src.start(Math.max(0, when), Math.max(0, -when));
  };
  add(inst, opts.instrumentalGain, 0);
  if (stem) add(stem, opts.vocalStemGain, 0);
  add(mic, opts.microphoneGain, opts.vocalOffset);

  const out = await ctx.startRendering();
  // soft-limit to avoid clipping
  for (let c = 0; c < out.numberOfChannels; c++) {
    const d = out.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = Math.tanh(d[i]);
  }
  return out;
}
