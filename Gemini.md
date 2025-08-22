# ポケモンカードゲーム開発ガイドライン

## 📋 プロジェクト概要

このプロジェクトは、JavaScriptを使用したポケモンカードゲームのWebアプリケーション実装です。純粋関数とモジュラーアーキテクチャを採用し、ターン制カードゲームの複雑なルールと状態管理を効率的に実装しています。

## 🏗️ アーキテクチャ原則

### コアアーキテクチャパターン

1. **MVC（Model-View-Controller）パターン**
   - Model: `state.js` - ゲーム状態とデータ管理
   - View: `view.js` - DOM操作と描画ロジック
   - Controller: `game.js` - ゲームロジックとユーザー入力制御

2. **モジュラー設計**
   - 各機能を独立したモジュールに分離
   - 明確な責任分離（Separation of Concerns）
   - 依存関係の最小化

3. **純粋関数アプローチ**
   - 副作用なし（No Side Effects）
   - 入力に対して予測可能な出力
   - テスタビリティとデバッグ性の向上

### ステート管理パターン

```javascript
// 状態の更新は常に新しいオブジェクトを返す（Immutable Updates）
function updateGameState(currentState, action) {
    return {
        ...currentState,
        // 変更部分のみ更新
    };
}
```

## 🎯 開発ガイドライン

### 1. コーディングスタンダード

#### JavaScript ベストプラクティス

- **ES6+ モジュール構文を使用**
  ```javascript
  // ✅ Good
  import { someFunction } from './module.js';
  export { myFunction };
  
  // ❌ Avoid
  const module = require('./module');
  ```

- **純粋関数の実装**
  ```javascript
  // ✅ Good - 純粋関数
  function calculateDamage(pokemon, attack, opponent) {
      return damage; // 副作用なし
  }
  
  // ❌ Avoid - 副作用あり
  function dealDamage(pokemon, attack) {
      pokemon.hp -= attack.damage; // 直接変更
  }
  ```

- **Null安全性の確保**
  ```javascript
  // ✅ Good
  const prize = Array.isArray(player.prize) ? player.prize : new Array(6).fill(null);
  
  // ❌ Avoid
  const prizeCount = player.prize.length; // エラーの可能性
  ```

#### ネーミング規則

- **変数・関数**: camelCase (`gameState`, `playCard`)
- **定数**: UPPER_SNAKE_CASE (`GAME_PHASES`, `MAX_HAND_SIZE`)
- **クラス**: PascalCase (`Game`, `View`, `AnimationManager`)
- **ファイル**: kebab-case (`action-hud-manager.js`, `card-orientation.js`)

#### コメント規則

- 実装の「なぜ」を説明（「何を」ではなく）
- 複雑なビジネスロジックには必須
- JSDocスタイルを関数に適用

```javascript
/**
 * ポケモンの弱点・抵抗計算を適用してダメージを算出
 * @param {number} baseDamage - 基本ダメージ
 * @param {Object} attacker - 攻撃側ポケモン
 * @param {Object} defender - 防御側ポケモン
 * @returns {number} 最終ダメージ
 */
function calculateFinalDamage(baseDamage, attacker, defender) {
    // 弱点・抵抗の計算ロジック
}
```

### 2. ファイル構成規則

#### ディレクトリ構造

```text
pokemon/
├── js/                          # JavaScriptファイル
│   ├── animations/              # アニメーション関連モジュール
│   │   ├── card-moves.js        # カード移動アニメーション
│   │   ├── combat.js            # 戦闘アニメーション
│   │   ├── core.js              # アニメーションコア機能
│   │   ├── effects.js           # エフェクトアニメーション
│   │   └── ui.js                # UIアニメーション
│   ├── action-hud-manager.js    # アクションHUD管理
│   ├── animation-manager.js     # アニメーション統合管理
│   ├── card-orientation.js      # カード向き管理
│   ├── data-manager.js          # データ管理
│   ├── error-handler.js         # エラーハンドリング
│   ├── game.js                  # メインゲームクラス
│   ├── logic.js                 # ゲームルール・純粋関数
│   ├── main.js                  # エントリーポイント
│   ├── memory-manager.js        # メモリ管理
│   ├── modal-manager.js         # モーダル管理
│   ├── phase-manager.js         # フェーズ管理
│   ├── setup-manager.js         # セットアップ管理
│   ├── state.js                 # 状態管理
│   ├── turn-manager.js          # ターン管理
│   ├── ui-constants.js          # UI定数
│   ├── view.js                  # 描画ロジック
│   └── z-index-constants.js     # z-index定数
├── data/                        # データファイル
│   ├── cards-master.json        # カードマスターデータ
│   └── schema.json              # データスキーマ
├── assets/                      # 画像・UI素材
│   ├── cards/                   # カード画像
│   │   ├── energy/              # エネルギーカード画像
│   │   └── pokemon/             # ポケモンカード画像
│   ├── playmat/                 # プレイマット関連
│   └── ui/                      # UI素材
├── scripts/                     # ユーティリティスクリプト
│   ├── rename_energy_images.py  # エネルギー画像リネーム
│   └── rename_pokemon_images.py # ポケモン画像リネーム
├── index.html                   # メインHTMLファイル
├── card_viewer.html             # カードビューアー
├── server.js                    # 開発サーバー
├── package.json                 # 依存関係管理
└── CLAUDE.md                    # 開発ガイドライン
```

#### モジュール責任分離

**コアモジュール:**

- **state.js**: 状態作成・初期化のみ
- **logic.js**: ゲームルール・純粋関数のみ
- **view.js**: DOM操作・描画のみ
- **game.js**: 統合・制御・イベント処理
- **main.js**: エントリーポイント・初期化

**管理モジュール:**

- **action-hud-manager.js**: フローティングアクションボタンの管理
- **animation-manager.js**: アニメーション統合管理とキュー制御
- **data-manager.js**: カードデータの読み込み・管理
- **error-handler.js**: エラーハンドリング・ログ管理
- **memory-manager.js**: メモリ使用量の監視・最適化
- **modal-manager.js**: モーダルダイアログの管理
- **phase-manager.js**: ゲームフェーズの状態管理
- **setup-manager.js**: ゲームセットアップの制御
- **turn-manager.js**: ターン制御・プレイヤー切り替え

**ユーティリティモジュール:**

- **card-orientation.js**: カードの向き・配置管理
- **ui-constants.js**: UI関連の定数定義
- **z-index-constants.js**: レイヤー管理用定数

### 3. エラーハンドリング

#### エラー処理戦略

```javascript
// 1. 入力検証
function validateCardPlay(state, cardId) {
    if (!cardId || !state.players[state.currentPlayer].hand.includes(cardId)) {
        throw new Error(`Invalid card play: ${cardId}`);
    }
}

// 2. 境界値チェック
function drawCards(state, count) {
    const availableCards = state.deck.length;
    const actualDraw = Math.min(count, availableCards);
    // デッキ枯渇時の処理
}

// 3. 状態一貫性チェック
function validateGameState(state) {
    // 各プレイヤーのカード総数チェック
    // 必須フィールドの存在確認
}
```

### 4. テスト戦略

#### ユニットテスト指針

- **純粋関数を優先的にテスト**
- **境界値・エッジケースを網羅**
- **状態遷移の検証**

```javascript
// テスト例
describe('attachEnergy', () => {
    it('should attach energy to pokemon', () => {
        const result = attachEnergy(state, 'player', energyId, pokemonId);
        expect(result.players.player.hand).not.toContain(energyId);
        expect(result.players.player.active.attached_energy).toContain(energyId);
    });
    
    it('should respect energy attachment limit', () => {
        // 1ターン1枚制限のテスト
    });
});
```

### 5. パフォーマンス最適化

#### 描画最適化

- **必要時のみ再描画**
- **DOM操作の最小化**
- **イベントリスナーの適切な管理**

```javascript
// ✅ Good - 差分更新
function updateCardInHand(cardElement, newCard) {
    if (cardElement.dataset.cardId !== newCard.id) {
        // カードが変更された場合のみ更新
        rerenderCard(cardElement, newCard);
    }
}

// ❌ Avoid - 全体再描画
function updateHand() {
    handElement.innerHTML = ''; // 全削除して再構築
    renderAllCards();
}
```

#### メモリ管理

- **不要なイベントリスナーの削除**
- **循環参照の回避**
- **大きなオブジェクトの適切な破棄**

### 6. デバッグ・ログ戦略

#### ログレベル

```javascript
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1, 
    INFO: 2,
    DEBUG: 3
};

// 本番環境では ERROR, WARN のみ
// 開発環境では全レベル出力
```

#### 状態ログ

```javascript
function logStateChange(action, oldState, newState) {
    console.group(`🎮 ${action}`);
    console.log('Before:', oldState);
    console.log('After:', newState);
    console.groupEnd();
}
```

## 🔄 開発フロー

### 1. 機能開発プロセス

1. **要件定義**: 実装する機能の仕様を明確化
2. **設計**: 影響する関数・モジュールを特定
3. **実装**: 純粋関数から実装し、統合テスト
4. **テスト**: ユニット・統合テストで検証
5. **コードレビュー**: アーキテクチャ原則への準拠確認

### 2. コミット規則

```text
feat: 新機能追加
fix: バグ修正
refactor: リファクタリング
test: テスト追加・修正
docs: ドキュメント更新
style: フォーマット変更（機能に影響なし）
```

### 3. ブランチ戦略

- `main`: 安定版
- `develop`: 開発統合ブランチ
- `feature/*`: 機能開発ブランチ
- `fix/*`: バグ修正ブランチ

## 📚 参考資料・ベストプラクティス

### JavaScript ゲーム開発

- [Game Programming Patterns](https://gameprogrammingpatterns.com/)
- [MDN Web Game Development](https://developer.mozilla.org/en-US/docs/Games)
- [JavaScript: The Right Way](https://jstherightway.org/)

### 状態管理パターン

- State Pattern for game states
- Finite State Machines (FSM)
- Event-driven architecture

### カードゲーム設計

- Entity-Component-System (ECS) patterns
- Rule engine design
- Turn-based game architecture

## 🛠️ 開発ツール

### 推奨ツール

- **エディタ**: Visual Studio Code
- **ブラウザ**: Chrome DevTools
- **Linting**: ESLint
- **フォーマット**: Prettier
- **バージョン管理**: Git

### デバッグ支援

- Browser DevTools
- Console logging with levels
- State inspection tools
- Performance profiling

---

このガイドラインは、プロジェクトの成長に合わせて継続的に更新していきます。新しいベストプラクティスや改善点があれば、積極的に反映してください。