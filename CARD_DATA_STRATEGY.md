# 🎴 カードデータ管理戦略（推奨）

## 🎯 ハイブリッド方式の提案

### 📁 ファイル構成
```
data/
├── cards-master.json     ← メインデータベース（高速検索用）
├── cards-backup.json     ← 自動バックアップ
└── validation.json       ← データ整合性チェック用

assets/cards/
├── pokemon/
│   ├── Akamayabato.webp  ← 画像 + 最小限のメタデータ
│   └── metadata.json     ← 画像固有の情報（任意）
├── energy/
└── trainer/
```

### 🔄 運用フロー

#### 1. 開発・編集時
- **cards-master.json** をメインDBとして使用
- カードエディタで編集 → JSON更新
- 画像とJSONの整合性を自動チェック

#### 2. パフォーマンス最適化
```javascript
// 初期化時：JSONを一括読み込み
const cards = await loadCardsFromJSON();

// 使用時：メモリ内検索（高速）
const pokemon = cards.filter(c => c.card_type === 'Pokémon');

// 画像：遅延読み込み + キャッシュ
const imagePath = getCardImagePath(card.name_en, card);
```

#### 3. データ整合性保証
```javascript
// 自動検証システム
function validateCardData() {
    const cards = loadCardsFromJSON();
    const imageFiles = scanImageDirectory();
    
    // 不整合を検出・報告
    const orphanImages = findOrphanImages(cards, imageFiles);
    const missingImages = findMissingImages(cards, imageFiles);
    
    return { orphanImages, missingImages };
}
```

### 🎖️ このアプローチの利点

1. **高速性**: JSONベースの検索・フィルタリング
2. **整合性**: 自動検証システム
3. **柔軟性**: エディタでの編集が容易
4. **拡張性**: 新しいフィールド追加が簡単
5. **バックアップ**: データ損失リスク最小化

### 🔧 実装優先度

#### Phase 1 (現在): JSON最適化
- [x] データ正規化システム
- [x] ID自動生成
- [x] フィールド補完
- [ ] 自動バックアップ

#### Phase 2: 整合性システム
- [ ] 画像・データ整合性チェック
- [ ] 孤立ファイル検出
- [ ] 自動修復機能

#### Phase 3: 高度な機能
- [ ] WebP メタデータ読み込み（補助）
- [ ] データ同期システム
- [ ] パフォーマンス監視

## 🎯 結論

**現在のJSON方式 + 改善が最も効率的**

理由：
- ブラウザゲームに最適化
- エディタとの親和性
- 将来の拡張性
- メンテナンスの容易さ