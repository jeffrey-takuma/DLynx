# DLynx

download.test.tsの詳細テスト仕様

  - repoRoot から app/downloader/bin を組み立てる
  - repoRoot から media を出力先にする
  - 実行ファイル名が OS に応じて yt-dlp / yt-dlp.exe になる
  - argv に --ffmpeg-location, --newline, --progress-template, -P, URL が決まった順序で入る
  - URL は渡された文字列をそのまま最後の引数に入れる
  - mkdir や spawn は呼ばない
