# ARを用いた高知県の観光を支援するシステムの試作

[ソフトウェア工学で開発したシステム「SceneTrip」](https://github.com/r02092/se2025)において、ARを用いたコンテンツを提供するという案があったが、開発にかかる手間の都合により初期の段階から没になってしまったので、その代わりに作成

## 機能

- 特定の観光名所にカメラを向けると見られるARコンテンツ
  - 土佐山田駅の駅名標
  - 土佐日記御崎の泊碑（検出テストのみ）
  - ISO 7010の飲食禁止を示すピクトグラム（デモ用）
- 近隣のスポットの名前をカメラの映像上に重ねて表示
- 鉄道沿線で使用するとその場所における発車標を表示
  - 対応路線
    - 四国旅客鉄道土讃線・大歩危駅〜窪川駅（大歩危駅自体は除く）
    - 四国旅客鉄道予土線・川奥信号場〜北宇和島駅の両渡り線の部分
    - 土佐くろしお鉄道全線
  - 対応期間
    - 2026年4月〜9月

## 使用したものについて

- スポット情報(`src/spots.json`)は、[Shareによって作成されたデータ](https://github.com/r02092/se2025/blob/main/database/seeders/DatabaseSeeder.php)を使用しています。
- スポットの標高の推測値として、[国土地理院](https://www.gsi.go.jp/)により提供されている[地理院タイル](https://maps.gsi.go.jp/development/ichiran.html)を使用しています。
- 四国旅客鉄道および土佐くろしお鉄道の時刻表データ(`src/timetable.json`)は、[鉄道運用Hub](https://unyohub.2pd.jp/)において、[いずみ茶](https://x.com/Izumicha_SB03)様により[クリエイティブ・コモンズ 表示 4.0 国際 ライセンス](https://creativecommons.org/licenses/by/4.0/deed.ja)の下で提供されています。
- `src/setup.ts`では、[国土数値情報ダウンロードサイト](https://nlftp.mlit.go.jp/)より「[鉄道データ](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-v3_1.html)」をダウンロードし、加工したデータを`src/generated/railway.json`に出力します。「[鉄道データ](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-v3_1.html)」は[国土交通省](https://www.mlit.go.jp/)により[公共データ利用規約（第1.0版）](https://www.digital.go.jp/resources/open_data/public_data_license_v1.0)の下で提供されています。
