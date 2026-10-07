import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { askVideo, type AskAnswer } from "../api";

export function VideoQuestion({ videoId, title, onSeek }: { videoId: string; title: string; onSeek: (seconds: number) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const alive = useRef(true);
  const headingId = useId();
  const inputId = useId();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!question.trim() || asking) return;
    setAsking(true);
    setError(null);
    setAnswer(null);
    try {
      const found = await askVideo(videoId, question.trim());
      if (alive.current) setAnswer(found);
    } catch (err) {
      if (alive.current) setError(err instanceof Error ? err.message : "Couldn't get an answer. Try again.");
    } finally {
      if (alive.current) setAsking(false);
    }
  }

  return <>
    <button type="button" className="btn-ghost" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>Ask about this video</button>
    <dialog ref={dialog} className="video-question" aria-labelledby={headingId}>
      <header className="video-question-head">
        <h2 id={headingId}>Ask about this video</h2>
        <button type="button" className="video-question-close" aria-label="Close question panel" onClick={() => dialog.current?.close()}>×</button>
      </header>
      <p className="video-question-title">{title}</p>
      <p className="ask-hint">AI answers drawn from this video's transcript.</p>
      <form className="ask-form" onSubmit={submit}>
        <label htmlFor={inputId}>What caught your attention?</label>
        <textarea id={inputId} className="ask-input" placeholder="Ask about something mentioned in the video…" value={question} onChange={e => setQuestion(e.target.value)} maxLength={500} rows={3} disabled={asking} />
        <button className="btn-primary ask-btn" type="submit" disabled={asking || !question.trim()}>{asking ? "Asking…" : "Ask"}</button>
      </form>
      {asking && <p className="ask-note" role="status"><span className="proc-spinner sm" /> Reading the transcript…</p>}
      {error && <p className="ask-error" role="alert">{error}</p>}
      {answer && <section className="ask-answer" aria-label="Answer" aria-live="polite">
        <p className="ask-answer-text">{answer.answer}</p>
        {answer.citations.length > 0 && <>
          <p className="ask-hint">Go to the source</p>
          <div className="ask-citations">{answer.citations.map(c => <button key={c.start} type="button" className="ask-citation" title={c.text} onClick={() => { dialog.current?.close(); onSeek(c.start); }}>
            Watch from {Math.floor(c.start / 60)}:{String(Math.floor(c.start % 60)).padStart(2, "0")}
          </button>)}</div>
        </>}
      </section>}
    </dialog>
  </>;
}
