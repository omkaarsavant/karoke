export interface MixOptions {
  instrumentalGain: number; // 0..1.5
  vocalGain: number; // 0..1.5
  /** Seconds into the instrumental at which the vocal recording began. */
  vocalOffset: number;
}

async function decode(ctx: BaseAudioContext, data: Blob | string): Promise<AudioBuffer> {
  const buf = typeof data === "string" ? await (await fetch(data)).arrayBuffer() : await data.arrayBuffer();
  return ctx.decodeAudioData(buf);
}

/** Render instrumental + vocal into a single stereo AudioBuffer, preserving relative timing. */
export async function mixTracks(instrumentalUrl: string, vocal: Blob, opts: MixOptions): Promise<AudioBuffer> {
  const tmp = new AudioContext();
  const [inst, voc] = await Promise.all([decode(tmp, instrumentalUrl), decode(tmp, vocal)]);
  await tmp.close();
  const sampleRate = inst.sampleRate;
  const length = Math.ceil(Math.max(inst.duration, opts.vocalOffset + voc.duration) * sampleRate);
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
  add(voc, opts.vocalGain, opts.vocalOffset);

  const out = await ctx.startRendering();
  // soft-limit to avoid clipping
  for (let c = 0; c < out.numberOfChannels; c++) {
    const d = out.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = Math.tanh(d[i]);
  }
  return out;
}
