from pathlib import Path
p = Path(__file__).with_name("src") / "pages" / "app" / "VideoAnalysisWorkspace.tsx"
text = p.read_text(encoding="utf-8")
start = text.find('  if (stage === "identify") {')
end = text.find('  if (stage === "review") {')
if start < 0 or end < 0 or start >= end:
    raise SystemExit(f"markers not found {start} {end}")
new = """  if (stage === "identify") {
    return (
      <IdentifyStage
        tracks={tracks}
        streamUrl={streamUrl}
        streamCors={streamCors}
        onBack={() => setStage("setup")}
        onTracks={next => { tracksRef.current = next; setTracks(next) }}
        onReview={() => setStage("review")}
      />
    )
  }

"""
p.write_text(text[:start] + new + text[end:], encoding="utf-8")
print("ok", end - start)
