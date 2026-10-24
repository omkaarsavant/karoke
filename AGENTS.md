<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Karaoke audio logic lives in separate modules under src/lib (lrc, recorder, mixer, mp3, useAudioTimeline); the <audio> element's currentTime is the single source of truth for lyric sync. Why: keeps parser, recording, mixing and encoding reusable and testable.
- Songs are registered in src/lib/songs.ts with files in public/songs/<id>.mp3 + <id>.lrc. Why: one clear place to add real tracks.
