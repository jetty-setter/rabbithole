/** Grab a few JPEG frames (base64, no data: prefix) spread across a video file,
 *  entirely in the browser, so we can ask the AI for a title before uploading.
 *  Returns [] if the browser can't decode the file (e.g. some HEVC in Chrome) —
 *  callers fall back to the server-side auto-titler. */
export async function extractFrames(file: File, count = 3): Promise<string[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  try {
    await new Promise<void>((resolve, reject) => {
      const to = setTimeout(() => reject(new Error("metadata timeout")), 8000);
      video.onloadedmetadata = () => {
        clearTimeout(to);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(to);
        reject(new Error("decode error"));
      };
    });

    const dur = Number.isFinite(video.duration) ? video.duration : 0;
    const fracs = dur > 0 ? [0.1, 0.45, 0.8].slice(0, count) : [0];
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];

    const frames: string[] = [];
    for (const fr of fracs) {
      const t = dur > 0 ? Math.min(dur - 0.05, Math.max(0, dur * fr)) : 0;
      const ok = await new Promise<boolean>((resolve) => {
        const done = () => {
          video.removeEventListener("seeked", done);
          resolve(true);
        };
        const fail = setTimeout(() => {
          video.removeEventListener("seeked", done);
          resolve(false);
        }, 6000);
        video.addEventListener("seeked", () => {
          clearTimeout(fail);
          done();
        });
        video.currentTime = t;
      });
      if (!ok) continue;

      const w = 512;
      const vw = video.videoWidth || w;
      const vh = video.videoHeight || Math.round((w * 9) / 16);
      canvas.width = w;
      canvas.height = Math.max(1, Math.round((vh / vw) * w));
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const b64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
        if (b64) frames.push(b64);
      } catch {
        /* tainted/undecodable frame — skip */
      }
    }
    return frames;
  } catch {
    return [];
  } finally {
    URL.revokeObjectURL(url);
  }
}
