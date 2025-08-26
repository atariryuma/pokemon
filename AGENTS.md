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
│   │   ├── flow.js              # アニメーションフロー制御
│   │   └── ui.js                # UIアニメーション
│   ├── action-hud-manager.js    # アクションHUD管理
│   ├── animation-manager.js     # アニメーション統合管理
│   ├── card-api.js              # カードAPI統合
│   ├── card-orientation.js      # カード向き管理
│   ├── card-viewer-integration.js # カードエディタ統合
│   ├── data-manager.js          # データ管理
│   ├── debug-system.js          # デバッグシステム
│   ├── dom-utils.js             # DOM操作ユーティリティ
│   ├── error-handler.js         # エラーハンドリング
│   ├── game.js                  # メインゲームクラス
│   ├── game-logger.js           # ゲームログシステム
│   ├── logic.js                 # ゲームルール・純粋関数
│   ├── main.js                  # エントリーポイント
│   ├── memory-manager.js        # メモリ管理
│   ├── modal-manager.js         # モーダル管理
│   ├── phase-manager.js         # フェーズ管理
│   ├── setup-manager.js         # セットアップ管理
│   ├── state.js                 # 状態管理
│   ├── toast-messages.js        # トースト通知システム
│   ├── turn-manager.js          # ターン管理
│   ├── ui-constants.js          # UI定数
│   ├── view.js                  # 描画ロジック
│   └── z-index-constants.js     # z-index定数
├── data/                        # データファイル
│   └── cards-master.json        # カードマスターデータ
├── assets/                      # 画像・UI素材
│   ├── cards/                   # カード画像
│   │   ├── energy/              # エネルギーカード画像
│   │   └── pokemon/             # ポケモンカード画像
│   ├── playmat/                 # プレイマット関連
│   │   ├── playmat_card_slots.json     # スロット定義
│   │   └── playmat_slots_named.json    # 名前付きスロット
│   ├── ui/                      # UI素材
│   └── z-index-vars.css         # z-index CSS変数
├── scripts/                     # ユーティリティスクリプト
│   ├── dev-server.js            # 開発サーバー（新）
│   ├── rename_energy_images.py  # エネルギー画像リネーム
│   └── rename_pokemon_images.py # ポケモン画像リネーム
├── node_modules/                # NPMパッケージ
├── test_*.html                  # テストファイル群
├── index.html                   # メインHTMLファイル
├── card_viewer.html             # カードビューアー・エディタ
├── server.js                    # 開発サーバー（メイン）
├── package.json                 # 依存関係管理
├── package-lock.json            # 依存関係ロック
├── README.md                    # プロジェクト概要（ユーザー向け）
└── CLAUDE.md                    # 開発ガイドライン（開発者向け）
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

**統合・API モジュール:**

- **card-api.js**: カードAPI統合・データ同期
- **card-viewer-integration.js**: カードエディタとの連携制御
- **toast-messages.js**: トースト通知システム
- **game-logger.js**: ゲームログ・デバッグ情報管理
- **debug-system.js**: 開発・デバッグ支援システム

**ユーティリティモジュール:**

- **card-orientation.js**: カードの向き・配置管理
- **dom-utils.js**: DOM操作・ユーティリティ関数
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

### Claude Code 連携ワークフロー

#### 開発サーバーの起動
```bash
# 開発サーバー起動（複数の選択肢）
node server.js          # メインサーバー (推奨)
node scripts/dev-server.js  # 代替サーバー
npm start               # package.jsonスクリプト
```

#### カードエディタ統合開発
```bash
# カードエディタでの作業
# 1. index.html でゲーム実行
# 2. カードエディタボタン → card_viewer.html を開く
# 3. カード編集・作成後、自動でゲームに反映
```

#### デバッグ・ログ戦略
```javascript
// デバッグシステムの活用
import { debugSystem } from './debug-system.js';
debugSystem.enable(); // 詳細ログを有効化

// ゲームログの使用
import { gameLogger } from './game-logger.js';
gameLogger.logStateChange('ACTION', oldState, newState);
```

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

## 🛠️ Claude Code 固有のベストプラクティス

### CLAUDE.md の活用

このファイル自体が Claude Code のプロジェクトメモリとして機能します：

- **Tech Stack**: Vanilla JavaScript (ES6+), HTML5, CSS3, Node.js
- **Project Structure**: 上記ディレクトリ構造に準拠
- **Commands**: 
  - `node server.js` - 開発サーバー起動
  - `npm install` - 依存関係インストール
  - `npm start` - サーバー起動（package.json経由）

### 開発者向け指針

1. **モジュール最初**：新機能は必ず独立したモジュールとして実装
2. **テスト駆動**：`test_*.html` でテスト検証後に本体統合
3. **ログ活用**：`debug-system.js` と `game-logger.js` でデバッグ
4. **統合設計**：カードエディタとの連携を常に考慮

### よく使用するコマンド・パターン

```bash
# 一般的な作業フロー
node server.js                    # サーバー起動
# ブラウザで http://localhost:3000 を開く
# 開発・テスト・デバッグの反復
```

```javascript
// よく使用するインポートパターン
import { Game } from './game.js';
import { errorHandler } from './error-handler.js';
import { debugSystem } from './debug-system.js';
import { gameLogger } from './game-logger.js';
```

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

## 🔧 開発ツール

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

## 🎴 ポケモンカードゲーム固有のルール

### ゲームフロー

```
関数 ポケカ_対戦():
  準備()
  先攻, 後攻 = じゃんけんで決定()
  現在手番 = 先攻
  繰り返し:
    もし 勝敗が決まっている(): 終了
    ターン(現在手番)
    現在手番 = 相手(現在手番)

関数 準備():
  各自 デッキをシャッフルして山札に置く
  各自 手札を7枚引く
  各自 たねポケモンをバトル場に1枚（裏）、ベンチに任意（最大5・裏）配置
  各自 山札の上から6枚をサイドに置く（裏）
  もし 手札にたねが無いなら:
    マリガン（引き直し）、相手は回数ぶんまで追加で山札から引ける
  お互いのバトル/ベンチを表にして先攻の番で開始

関数 ターン(プレイヤー):
  // 開始処理
  1. ドロー: 山札の上から1枚引く
     もし ドローできない: プレイヤーの敗北 → 終了

  // メイン（順不同／回数制限あり）
  2. ベンチにたねを出す（ベンチ最大5）
  3. 進化する（この番に出したポケモン/この番に進化したポケモンは進化不可。両者の最初の番は進化不可）
  4. エネルギーを手札から1枚だけつける（1ターン1回）
  5. トレーナーズ
     - グッズ：制限なし
     - サポート：1ターン1枚（先攻の最初の番は使用不可）
     - スタジアム：置き換え可（場に1枚）
  6. 特性：カードの指定に従って使用（番は終わらない）
  7. にげる：1ターン1回。にげるコスト分のエネルギーをトラッシュして交代

  // 攻撃（ワザ）
  8. もし 先攻の最初の番 なら 攻撃不可 → スキップ
     それ以外なら:
       使うワザを1つ選ぶ（必要エネルギーがついていること）
       ダメージ計算→きぜつ処理→サイド取得
       攻撃したら手番は終了（以降の行動は不可）

  // ターン終了処理
  9. ポケモンチェック()
     - 特殊状態（どく→やけど→ねむり→マヒの順）を確認・処理
     - 「ポケモンチェックではたらく」特性や効果を処理
     - きぜつの確認→サイドの取得→必要なら新しいバトルポケモンを出す

関数 勝敗が決まっている():
  返す (相手がサイドをすべて取り終えた)
      または (自分の場にポケモンが1匹もいない)
      または (自分の番のはじめにドローできない)
```

---

このガイドラインは、プロジェクトの成長に合わせて継続的に更新していきます。新しいベストプラクティスや改善点があれば、積極的に反映してください。