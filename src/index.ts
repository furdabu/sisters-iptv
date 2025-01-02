import express from 'express';
import { spawn } from "child_process";
import http from "http";

const app = express();
const port = 8888;
const MIRAKURUN_SERVICE_URL = "http://192.168.100.3:40772/api/services/3273901048/stream?decode=1";
// discover.json
app.get('/discover.json', (req, res) => {
  res.json({
    FriendlyName: 'My HDHomeRun Emulator',
    ModelNumber: 'HDHR3-US',
    FirmwareName: 'hdhomerun_emulator',
    FirmwareVersion: '20250101',
    DeviceID: '12345678',
    DeviceAuth: 'testauth',
    BaseURL: `http://${req.hostname}:${port}`,
    LineupURL: `http://${req.hostname}:${port}/lineup.json`
  });
});

// lineup_status.json
app.get('/lineup_status.json', (req, res) => {
  res.json({
    ScanInProgress: 0,
    ScanPossible: 1,
    Source: 'Antenna',
    SourceList: ['Antenna']
  });
});

// lineup.json
app.get('/lineup.json', (req, res) => {
  res.json([
    {
      GuideNumber: '1',
      GuideName: 'NHK総合(テスト)',
      URL: `http://${req.hostname}:${port}/auto/v1`
    },
    // 必要に応じて増やす
  ]);
});

// チャンネルストリーム (auto/v1)
// HDHomeRunエミュレータのエンドポイント例
// ここでは "/auto/v1" にアクセスすると Mirakurun のストリームを MP4 変換して返す
app.get("/auto/v1", (req, res) => {
  console.log("[tsreadex + FFmpeg (TS for Plex)] start streaming...");

  // --- 1) tsreadex ---
  const tsreadexArgs = [
    // "-x", "18/38/39", // EIT削除など最低限のフィルタ例
    // "-n", "1040",     // サービスID例
    "-"
  ];
  console.log("[tsreadex] spawn tsreadex", tsreadexArgs.join(" "));
  const tsreadex = spawn("tsreadex", tsreadexArgs);

  // --- 2) FFmpeg (MPEG-TSコンテナ + H.264 + AC3音声) ---
  //   -c:v libx264   : ソフトウェア H.264 エンコード
  //   -c:a ac3       : AC3音声
  //   -profile:v main -level 4.0 : HDHomeRunクライアント等への互換性を高める
  //   -f mpegts      : MPEG-TSコンテナで出力
  //   -mpegts_flags  : system_b+resend_headers → TS内で頻繁にPAT/PMTなどを再送し、Plexが誤認しないように
  const ffmpegArgs = [
    "-hide_banner",
    "-loglevel", "error",
    "-i", "pipe:0",

    // 映像: H.264
    "-c:v", "libx264",
    "-profile:v", "main",
    "-level:v", "4.0",
    "-preset", "veryfast",
    "-vf", "scale=-2:360",

    // 音声: AC3
    "-c:a", "ac3",
    "-b:a", "192k",

    // 出力を MPEG-TS
    "-f", "mpegts",
    "-mpegts_flags", "+system_b+resend_headers",

    "pipe:1"
  ];
  console.log("[FFmpeg] spawn ffmpeg", ffmpegArgs.join(" "));
  const ffmpeg = spawn("ffmpeg", ffmpegArgs);

  // パイプ構成
  tsreadex.stdout.pipe(ffmpeg.stdin);

  // レスポンスのContent-Type (MPEG-TS)
  res.setHeader("Content-Type", "video/mp2t");
  ffmpeg.stdout.pipe(res);

  // --- 3) MirakurunからTS取得 → tsreadex.stdinへ ---
  const mirakurunRequest = http.get(MIRAKURUN_SERVICE_URL, (mirakurunResponse) => {
    mirakurunResponse.pipe(tsreadex.stdin);
  });

  // --- エラーハンドリング ---
  tsreadex.stderr.on("data", (data) => {
    console.error("[tsreadex stderr]", data.toString());
  });
  ffmpeg.stderr.on("data", (data) => {
    console.error("[FFmpeg stderr]", data.toString());
  });

  tsreadex.on("close", (code) => {
    console.log(`tsreadex exited with code ${code}`);
    if (!res.writableEnded) res.end();
    try { ffmpeg.kill("SIGKILL"); } catch {}
  });
  ffmpeg.on("close", (code) => {
    console.log(`FFmpeg exited with code ${code}`);
    if (!res.writableEnded) res.end();
    try { tsreadex.kill("SIGKILL"); } catch {}
  });

  mirakurunRequest.on("error", (err) => {
    console.error("Mirakurun request error:", err);
    try { tsreadex.kill("SIGKILL"); } catch {}
    try { ffmpeg.kill("SIGKILL"); } catch {}
    if (!res.writableEnded) res.end();
  });

  req.on("close", () => {
    console.log("Client disconnected, cleaning up...");
    try { tsreadex.kill("SIGKILL"); } catch {}
    try { ffmpeg.kill("SIGKILL"); } catch {}
    mirakurunRequest.destroy();
  });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});