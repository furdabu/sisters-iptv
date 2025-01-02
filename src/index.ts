import express from 'express';

const app = express();
const port = 8888; // 好きなポート番号

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
app.get('/auto/v1', (req, res) => {
  // ここで Mirakurun or FFmpeg からのストリームを返す。
  // ひとまず固定のメッセージを返すだけのモックでもOK。
  res.setHeader('Content-Type', 'video/mp2t'); // TSの場合
  res.write('dummy TS data'); 
  res.end();
});

app.listen(port, () => {
  console.log(`HDHomeRun emulator listening on port ${port}`);
});
