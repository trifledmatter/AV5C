import express, { type Request, type Response } from "express";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";

const app = express();
let e = [];

// to see the camera in real time

app.get("/", (req: Request, res: Response) => {
  res.writeHead(200, {
    "Content-Type": "multipart/x-mixed-replace; boundary=ffserver",
  });

  const ffmpegArgs = [
    "-f",
    "v4l2",
    "-i",
    "/dev/video0",
    "-vf",
    "scale=1280:960",
    "-q:v",
    "3", // quality
    "-f",
    "mjpeg",
    "pipe:1",
  ] as const;

  const ffmpeg: ChildProcessWithoutNullStreams = spawn("ffmpeg", [
    ...ffmpegArgs,
  ]);

  ffmpeg.stdout.on("data", (data: Buffer) => {
    res.write(
      `--ffserver\r\nContent-Type: image/jpeg\r\nContent-Length: ${data.length}\r\n\r\n`
    );
    res.write(data);
    res.write("\r\n");
  });

  ffmpeg.stderr.on("data", (err: Buffer) => {
    e.push(err.toString());
    e.pop();
  });

  ffmpeg.on("close", (code: number, signal: NodeJS.Signals | null) => {
    console.log(`FFmpeg process closed, code: ${code}, signal: ${signal}`);
    res.end();
  });

  req.on("close", () => {
    ffmpeg.kill("SIGTERM");
  });
});

const PORT = 8080;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}/`);
});
