// Video export — §9.3.
//
// The current app records in real time with MediaRecorder: a 7.5 s clip takes 7.5 s plus
// overhead, frames drop if the tab is backgrounded, the codec depends on the browser and
// the bitrate is uncontrolled (§1.2 E2). This replaces it with frame-accurate OFFLINE
// encoding via WebCodecs, and keeps MediaRecorder only as a fallback.

import { ArrayBufferTarget, Muxer } from "mp4-muxer";

export interface VideoExportOptions {
  width: number;
  height: number;
  fps: number;
  /** Seconds. */
  duration: number;
  /** Draws one frame at time t (seconds) into the supplied context. */
  drawFrame: (ctx: CanvasRenderingContext2D, t: number) => void;
  onProgress?: (done: number, total: number) => void;
  /** Bitrate in bits per second. §9.3 asks for 10 Mbps at 1080x1920. */
  bitrate?: number;
}

export interface VideoResult {
  blob: Blob;
  ext: "mp4" | "webm";
  /** How the file was produced, so the UI can be honest about it. */
  path: "webcodecs" | "mediarecorder";
  frames: number;
}

const H264_1080 = "avc1.640028"; // High profile, level 4.0

/** Is frame-accurate encoding available in this browser? §9.3 primary path. */
export async function canUseWebCodecs(width: number, height: number): Promise<boolean> {
  if (typeof VideoEncoder === "undefined") return false;
  try {
    const support = await VideoEncoder.isConfigSupported({
      codec: H264_1080,
      width,
      height,
      bitrate: 10_000_000,
      framerate: 30,
    });
    return support.supported === true;
  } catch {
    return false;
  }
}

/**
 * Renders and encodes every frame offline. Progress is exact, because the work is counted
 * rather than timed.
 */
export async function encodeWithWebCodecs(options: VideoExportOptions): Promise<VideoResult> {
  const { width, height, fps, duration, drawFrame, onProgress, bitrate = 10_000_000 } = options;
  const totalFrames = Math.max(1, Math.round(duration * fps));

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width, height },
    // "in-memory" writes the moov atom up front, which is what makes the file seekable
    // immediately when shared to Instagram rather than needing a full download first.
    fastStart: "in-memory",
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => {
      throw err;
    },
  });

  encoder.configure({
    codec: H264_1080,
    width,
    height,
    bitrate,
    framerate: fps,
    // §9.3: a keyframe every two seconds keeps seeking sane without bloating the file.
    latencyMode: "quality",
  });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context for video export");

  const microsPerFrame = 1_000_000 / fps;

  for (let i = 0; i < totalFrames; i++) {
    const t = i / fps;
    ctx.clearRect(0, 0, width, height);
    drawFrame(ctx, t);

    const frame = new VideoFrame(canvas, {
      timestamp: Math.round(i * microsPerFrame),
      duration: Math.round(microsPerFrame),
    });
    encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();

    onProgress?.(i + 1, totalFrames);

    // Let the encoder drain so a long export does not balloon memory.
    if (encoder.encodeQueueSize > 8) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  await encoder.flush();
  encoder.close();
  muxer.finalize();

  return {
    blob: new Blob([target.buffer as ArrayBuffer], { type: "video/mp4" }),
    ext: "mp4",
    path: "webcodecs",
    frames: totalFrames,
  };
}

/**
 * Real-time fallback — §9.3. Used only when VideoEncoder is missing or the codec probe
 * fails. The caller must tell the user it is recording in real time and the screen has to
 * stay in front, because that is the truth and it takes as long as the video.
 */
export async function encodeWithMediaRecorder(options: VideoExportOptions): Promise<VideoResult> {
  const { width, height, fps, duration, drawFrame, onProgress } = options;
  if (typeof MediaRecorder === "undefined") throw new Error("this browser cannot record video");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context for video export");

  // Manual frame capture is far more reliable than automatic capture while decoding.
  // CanvasCaptureMediaStreamTrack.requestFrame is not in the DOM lib, hence the cast.
  type FrameTrack = MediaStreamTrack & { requestFrame?: () => void };
  let stream = canvas.captureStream(0);
  let track = stream.getVideoTracks()[0] as FrameTrack | undefined;
  const manual = typeof track?.requestFrame === "function";
  if (!manual) {
    stream = canvas.captureStream(fps);
    track = stream.getVideoTracks()[0] as FrameTrack | undefined;
  }

  const mime =
    ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find((m) =>
      MediaRecorder.isTypeSupported(m),
    ) ?? "";

  const recorder = new MediaRecorder(
    stream,
    mime ? { mimeType: mime, videoBitsPerSecond: 10_000_000 } : undefined,
  );
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  const totalFrames = Math.max(1, Math.round(duration * fps));
  recorder.start(250);

  const started = performance.now();
  for (let i = 0; i < totalFrames; i++) {
    const t = i / fps;
    ctx.clearRect(0, 0, width, height);
    drawFrame(ctx, t);
    if (manual) track?.requestFrame?.();
    onProgress?.(i + 1, totalFrames);

    // Pace to real time, since that is what the recorder is capturing.
    const targetElapsed = (i + 1) * (1000 / fps);
    const actual = performance.now() - started;
    if (targetElapsed > actual) {
      await new Promise((resolve) => setTimeout(resolve, targetElapsed - actual));
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 250));
  recorder.stop();
  await stopped;

  const type = recorder.mimeType || mime || "video/webm";
  return {
    blob: new Blob(chunks, { type }),
    ext: type.includes("mp4") ? "mp4" : "webm",
    path: "mediarecorder",
    frames: totalFrames,
  };
}

/** Picks the best available path. */
export async function exportVideo(options: VideoExportOptions): Promise<VideoResult> {
  if (await canUseWebCodecs(options.width, options.height)) {
    try {
      return await encodeWithWebCodecs(options);
    } catch {
      // A codec that probes supported but fails mid-encode is rare but real; fall back
      // rather than losing the user's export.
    }
  }
  return encodeWithMediaRecorder(options);
}

/** §9.3 caps clip length at 30 s, because export time and file size get unpleasant beyond. */
export const MAX_CLIP_SECONDS = 30;
