import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

const releaseMediaFiles = new Map<string, string>([
  ["aao-milo-chalo.flac", "audio/flac"],
  ["aao-milo-chalo-vocals.flac", "audio/flac"],
  ["aao-milo.mp4", "video/mp4"],
  ["if-you-hold-my-hand.flac", "audio/flac"],
  ["if-you-hold-my-hand-vocals.flac", "audio/flac"],
  ["if-you-hold-my-hand.mp4", "video/mp4"],
  ["aao-naa.flac", "audio/flac"],
  ["aao-naa-vocals.flac", "audio/flac"],
  ["aao-na.mp4", "video/mp4"],
  ["baitikochi-chuste.flac", "audio/flac"],
  ["baitikochi-chuste-vocals.flac", "audio/flac"],
  ["baitikochi-chuste.mp4", "video/mp4"],
  ["bargad.flac", "audio/flac"],
  ["bargad-vocals.flac", "audio/flac"],
  ["bargad.mp4", "video/mp4"],
  ["bol-na-halke-halke.flac", "audio/flac"],
  ["bol-na-halke-halke-vocals.flac", "audio/flac"],
  ["bol-na-halke-halke.mp4", "video/mp4"],
  ["chahun-main-ya-naa.flac", "audio/flac"],
  ["chahun-main-ya-naa-vocals.flac", "audio/flac"],
  ["chahun-main-ya-na.mp4", "video/mp4"],
  ["hey-shona.flac", "audio/flac"],
  ["hey-shona-vocals.flac", "audio/flac"],
  ["hey-shona.mp4", "video/mp4"],
  ["hua-main.flac", "audio/flac"],
  ["hua-main-vocals.flac", "audio/flac"],
  ["hua-main.mp4", "video/mp4"],
  ["hum-tum.flac", "audio/flac"],
  ["hum-tum-vocals.flac", "audio/flac"],
  ["hum-tum.mp4", "video/mp4"],
  ["labon-ko.flac", "audio/flac"],
  ["labon-ko-vocals.flac", "audio/flac"],
  ["labon-ko.mp4", "video/mp4"],
  ["lovers.flac", "audio/flac"],
  ["lovers-vocals.flac", "audio/flac"],
  ["lovers.mp4", "video/mp4"],
  ["mala-ved-laagale.flac", "audio/flac"],
  ["mala-ved-laagale-vocals.flac", "audio/flac"],
  ["mala-ved-lagle.mp4", "video/mp4"],
  ["mann-mera.flac", "audio/flac"],
  ["mann-mera-vocals.flac", "audio/flac"],
  ["mann-mera.mp4", "video/mp4"],
  ["mere-bina.flac", "audio/flac"],
  ["mere-bina-vocals.flac", "audio/flac"],
  ["mere-bina.mp4", "video/mp4"],
  ["othaiyadi-pathayila.flac", "audio/flac"],
  ["othaiyadi-pathayila-vocals.flac", "audio/flac"],
  ["othaiyadi.mp4", "video/mp4"],
  ["reflections.flac", "audio/flac"],
  ["reflections-vocals.flac", "audio/flac"],
  ["reflections.mp4", "video/mp4"],
  ["sajde.flac", "audio/flac"],
  ["sajde-vocals.flac", "audio/flac"],
  ["sajde.mp4", "video/mp4"],
  ["tum-ho.flac", "audio/flac"],
  ["tum-ho-vocals.flac", "audio/flac"],
  ["tum-ho.mp4", "video/mp4"],
  ["tum-mile.flac", "audio/flac"],
  ["tum-mile-vocals.flac", "audio/flac"],
  ["tum-mile.mp4", "video/mp4"],
  ["tum-se-hi.flac", "audio/flac"],
  ["tum-se-hi-vocals.flac", "audio/flac"],
  ["tum-se-hi.mp4", "video/mp4"],
  ["unakkul-naane.flac", "audio/flac"],
  ["unakkul-naane-vocals.flac", "audio/flac"],
  ["unakkul-nanne.mp4", "video/mp4"],
  ["pinnak.flac", "audio/flac"],
  ["kohinoor.flac", "audio/flac"],
]);

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function proxyReleaseMedia(request: Request): Promise<Response | undefined> {
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith("/media/")) return;

  const filename = pathname.slice("/media/".length);
  const contentType = releaseMediaFiles.get(filename);
  if (!contentType) return new Response("Media file not found", { status: 404 });

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  }

  const headers = new Headers();
  const range = request.headers.get("range");
  const ifRange = request.headers.get("if-range");
  if (range) headers.set("range", range);
  if (ifRange) headers.set("if-range", ifRange);

  try {
    const upstreamUrl = `https://github.com/omkaarsavant/karoke/releases/download/media-test/${filename}`;
    const upstream = await fetch(upstreamUrl, { method: request.method, headers });
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set("content-type", contentType);
    responseHeaders.set("content-disposition", `inline; filename="${filename}"`);
    responseHeaders.set("x-content-type-options", "nosniff");

    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("GitHub release media proxy request failed", error);
    return new Response("Media source is temporarily unavailable", { status: 502 });
  }
}

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const mediaResponse = await proxyReleaseMedia(request);
      if (mediaResponse) return mediaResponse;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
