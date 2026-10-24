/** Encode an AudioBuffer into a real MP3 Blob using LAME (client-side, lamejs). */
export async function encodeMp3(buffer: AudioBuffer, kbps = 192, onProgress?: (p: number) => void): Promise<Blob> {
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const channels = Math.min(2, buffer.numberOfChannels);
  const enc = new Mp3Encoder(channels, buffer.sampleRate, kbps);
  const toInt16 = (f: Float32Array) => {
    const o = new Int16Array(f.length);
    for (let i = 0; i < f.length; i++) {
      const s = Math.max(-1, Math.min(1, f[i]));
      o[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return o;
  };
  const left = toInt16(buffer.getChannelData(0));
  const right = channels > 1 ? toInt16(buffer.getChannelData(1)) : left;
  const parts: BlobPart[] = [];
  const block = 1152 * 20;
  for (let i = 0; i < left.length; i += block) {
    const l = left.subarray(i, i + block);
    const chunk = channels > 1 ? enc.encodeBuffer(l, right.subarray(i, i + block)) : enc.encodeBuffer(l);
    if (chunk.length) parts.push(new Uint8Array(chunk));
    if (i % (block * 20) === 0) {
      onProgress?.(i / left.length);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  const end = enc.flush();
  if (end.length) parts.push(new Uint8Array(end));
  onProgress?.(1);
  return new Blob(parts, { type: "audio/mpeg" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
