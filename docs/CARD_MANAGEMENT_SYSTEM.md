# ポケモンカード管理システム ドキュメント

## 📋 概要

このドキュメントは、ポケモンカードゲームシステムにおけるカードデータの管理方法について詳細に説明します。システムは**JSON-based Dynamic Loading**方式を採用し、将来的なカード追加に柔軟に対応できる設計となっています。

---

## 🏗️ システム構成

### データソース優先順位
1. **プライマリ**: `cards.json` (動的JSONローディング)
2. **フォールバック**: `js/cards.js` の静的データ

### 主要ファイル
- `cards.json` - メインカードデータベース（JSON形式）
- `js/cards.js` - カードローダーとフォールバック静的データ
- `card_viewer.html` - カードデータベースビューワー

---

## 📊 データ形式

### Pokémon Card Structure
```json
{
  "card_type": "Pokémon",
  "name_en": "Akamayabato",
  "name_ja": "アカメバト",
  "stage": "BASIC",
  "hp": 130,
  "type": "Colorless",
  "attacks": [
    {
      "name_en": "Scratch",
      "name_ja": "ひっかく",
      "cost": ["Lightning"],
      "damage": 90,
      "effect_en": "",
      "effect_ja": ""
    }
  ],
  "ability": null,
  "weakness": {
    "type": "Darkness",
    "value": "×2"
  },
  "resistance": {
    "type": "None",
    "value": ""
  },
  "retreat_cost": ["Colorless"],
  "image": ""
}
```

### Energy Card Structure
```json
{
  "card_type": "Basic Energy",
  "name_en": "Fire Energy",
  "name_ja": "ほのお エネルギー",
  "energy_type": "Fire",
  "effect_en": "Provides 1 Fire Energy.",
  "effect_ja": "Fireのエネルギーを1個ぶん供給する。",
  "rules_en": "You can attach 1 Energy from your hand per turn unless stated otherwise.",
  "rules_ja": "カードの効果がないかぎり、手札から1ターンに1枚だけエネルギーをつけられる。",
  "image": ""
}
```

---

## 🔧 実装詳細

### 1. カードローディングシステム (`js/cards.js`)

```javascript
// メインの輸出変数
export let cardMasterList = [];
export let nameTranslations = {};

// JSON動的ローディング関数
export async function loadCardsFromJSON() {
  try {
    const response = await fetch('./cards.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    cardMasterList = await response.json();
    generateNameTranslations();
    
    console.log(`✅ Loaded ${cardMasterList.length} cards from JSON`);
    return cardMasterList;
  } catch (error) {
    console.warn('⚠️ JSON loading failed, using static fallback:', error);
    cardMasterList = getStaticCardData();
    generateNameTranslations();
    return cardMasterList;
  }
}
```

### 2. フォールバック機能
- JSONローディングが失敗した場合、自動的に静的データに切り替わります
- エラーハンドリングにより、システムの可用性を保証

### 3. ゲーム初期化での統合 (`js/game.js`)

```javascript
async init() {
  // 📦 Card data loading (最優先)
  try {
    await loadCardsFromJSON();
    console.log('✅ Card data loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load card data:', error);
  }
  
  // その他の初期化処理...
}
```

---

## 🎯 新しいカードの追加方法

### 方法1: JSON直接編集 (推奨)

1. `cards.json`ファイルを開く
2. 配列に新しいカードオブジェクトを追加
3. 必要なフィールドを適切に設定
4. ファイルを保存
5. ゲームを再起動

**例:**
```json
{
  "card_type": "Pokémon",
  "name_en": "New Pokemon",
  "name_ja": "新しいポケモン",
  "stage": "BASIC",
  "hp": 120,
  "type": "Fire",
  "attacks": [
    {
      "name_en": "Fire Blast",
      "name_ja": "かえんほうしゃ",
      "cost": ["Fire", "Fire"],
      "damage": 80,
      "effect_en": "",
      "effect_ja": ""
    }
  ],
  "weakness": {
    "type": "Water",
    "value": "×2"
  },
  "resistance": {
    "type": "None",
    "value": ""
  },
  "retreat_cost": ["Colorless"],
  "image": ""
}
```

### 方法2: APIまたは管理ツール (将来拡張)
- 管理者インターフェースの実装
- RESTful API経由でのカード追加
- バックアップとバージョン管理

---

## 🔍 デバッグとメンテナンス

### カードデータの確認方法

1. **Card Viewer**: `card_viewer.html`で全カードを表示・検索
2. **Browser Console**: `cardMasterList`変数でデータ確認
3. **Test Page**: `test_cards.html`でローディングテスト

### よくある問題と解決方法

#### Q: カードが表示されない
A: 
1. `cards.json`のフォーマットを確認
2. Browser DevToolsのConsoleでエラーをチェック
3. 静的フォールバックが作動しているか確認

#### Q: 新しいカードが反映されない
A:
1. ブラウザキャッシュをクリア
2. `cards.json`のJSON構文が正しいか確認
3. サーバーを再起動

#### Q: 画像が表示されない
A:
1. `assets/`フォルダに適切な画像ファイルが存在するか確認
2. `getCardImagePath()`関数の動作を確認
3. フォールバック画像の設定を確認

---

## 📈 パフォーマンス特性

### メモリ使用量
- **JSON方式**: 必要時のみメモリロード
- **静的方式**: アプリ起動時に全ロード

### ロード時間
- **初回**: JSONファイルのfetch時間（通常50-200ms）
- **以降**: メモリからの即座取得

### スケーラビリティ
- **現在**: ~30カード（軽量）
- **推奨上限**: ~500カード
- **対応策**: 必要に応じてページング実装

---

## 🚀 将来拡張計画

### 短期 (数週間)
- [ ] カード画像の自動最適化
- [ ] 検索・フィルター機能の強化
- [ ] バリデーション機能の追加

### 中期 (数ヶ月)
- [ ] カード編集UI の実装
- [ ] バックアップ・復元機能
- [ ] 多言語対応の強化

### 長期 (数年)
- [ ] クラウドベースのカード管理
- [ ] APIベースのカード配信
- [ ] ユーザー投稿カード機能

---

## 🔐 セキュリティ考慮事項

### データ整合性
- JSONスキーマバリデーション
- 必須フィールドの検証
- 型安全性の保証

### アクセス制御
- 管理者のみがカードデータを編集可能
- 読み取り専用モードでの一般配布

---

## 📋 現在のカード統計

- **総カード数**: 32枚
- **ポケモンカード**: 23枚
- **エネルギーカード**: 9枚
- **画像ファイル**: 30枚 (22ポケモン + 8エネルギー)
- **データサイズ**: ~25KB (JSON)
- **フォルダ構造**: 完全整理済み

---

## 🛠️ 技術仕様

### 対応ブラウザ
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

### 依存関係
- **ES6 Modules**: 動的インポート対応
- **Fetch API**: JSONローディング
- **JSON**: データ形式

### ファイル構成
```
pokemon/
├── cards.json                 # メインデータベース
├── js/
│   ├── cards.js              # ローダーとフォールバック
│   └── game.js               # ゲーム初期化でload実行
├── card_viewer.html          # データビューワー
└── CARD_MANAGEMENT_SYSTEM.md # このドキュメント
```

---

## 📞 サポート情報

このカード管理システムに関する質問や問題がある場合は、以下の情報とともに報告してください：

1. **ブラウザ**: バージョン情報
2. **エラーメッセージ**: コンソールの完全な出力
3. **再現手順**: 問題が発生する操作手順
4. **期待される動作**: 本来どうあるべきか

---

*📅 最終更新: 2025年8月*  
*🔄 バージョン: 2.0 (JSON-based Dynamic Loading)*