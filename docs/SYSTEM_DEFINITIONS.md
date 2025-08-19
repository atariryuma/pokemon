# システム定義書 (System Definitions)

## 🎯 概要
このドキュメントは、ポケモンカードゲームシステムで使用される全ての定数、定義、命名規則を統一的に管理するためのリファレンスです。

---

## 📊 フェーズ定数 (Game Phase Constants)

### GAME_PHASES (phase-manager.js)
```javascript
export const GAME_PHASES = {
  // 基本フェーズ
  SETUP: 'setup',
  INITIAL_POKEMON_SELECTION: 'initialPokemonSelection',
  
  // プレイヤーターン
  PLAYER_DRAW: 'playerDraw',
  PLAYER_MAIN: 'playerMain',
  PLAYER_ATTACK: 'playerAttack',
  
  // CPUターン
  CPU_TURN: 'cpuTurn',
  CPU_DRAW: 'cpuDraw',
  CPU_MAIN: 'cpuMain',
  CPU_ATTACK: 'cpuAttack',
  
  // 特殊フェーズ
  AWAITING_NEW_ACTIVE: 'awaitingNewActive',
  PRIZE_SELECTION: 'prizeSelection',
  GAME_OVER: 'gameOver'
};
```

### 使用箇所と注意事項
- **必須**: 全てのフェーズ比較で `GAME_PHASES` 定数を使用
- **禁止**: 文字列リテラル（`'setup'`, `'gameOver'`等）の直接使用
- **例**: `state.phase === GAME_PHASES.SETUP` ✅ / `state.phase === 'setup'` ❌

---

## 👤 プレイヤー識別子 (Player Identifiers)

### ゲームロジック用
```javascript
// State管理・ロジック処理
const PLAYERS = {
  HUMAN: 'player',
  CPU: 'cpu'
};
```

### DOM要素用
```javascript
// CSS クラス名・要素選択
const DOM_PLAYERS = {
  HUMAN: '.player-self',
  CPU: '.opponent-board'
};
```

### View関数用
```javascript
// View._renderBoard() 等の引数
playerType: 'player' | 'cpu'
```

---

## 🎴 ゾーン識別子 (Zone Identifiers)

### ゲームゾーン
```javascript
const ZONES = {
  HAND: 'hand',
  DECK: 'deck',
  ACTIVE: 'active',
  BENCH: 'bench',
  DISCARD: 'discard',
  PRIZE: 'prize',
  STADIUM: 'stadium'
};
```

### データ構造でのマッピング
```javascript
PlayerState = {
  deck: Card[],
  hand: Card[],
  active: PokemonCard | null,
  bench: (PokemonCard | null)[],  // 最大5, nullは空スロット
  discard: Card[],
  prize: (Card | null)[],         // 長さ6, 裏向きはnull
}
```

---

## 🎨 CSS セレクター規則 (CSS Selector Rules)

### アクティブポケモン
```css
.active-bottom  /* プレイヤー側 */
.active-top     /* CPU側 */
```

### ベンチポケモン (5スロット)
```css
.bottom-bench-1, .bottom-bench-2, .bottom-bench-3, .bottom-bench-4, .bottom-bench-5  /* プレイヤー側 */
.top-bench-1, .top-bench-2, .top-bench-3, .top-bench-4, .top-bench-5              /* CPU側 */
```

### サイドカード (3枚表示)
```css
.side-left-1, .side-left-2, .side-left-3   /* プレイヤー側 */
.side-right-1, .side-right-2, .side-right-3 /* CPU側 */
```

### デッキ・トラッシュ
```css
.bottom-right-deck, .bottom-right-trash  /* プレイヤー側 */
.top-left-deck, .top-left-trash          /* CPU側 */
```

### 共通要素
```css
.stadium-zone      /* スタジアムカード */
.deck-container    /* デッキスタッキング効果用 */
.side-cards-container  /* サイドカードスタッキング効果用 */
```

---

## 🏷️ DOM ID・クラス命名規則 (DOM ID/Class Naming)

### UI要素 ID
```javascript
// ゲーム状態パネル
'game-status-panel'      // 右端中央の状態表示
'phase-indicator'        // フェーズ表示
'turn-indicator'         // ターン数表示
'current-player'         // 現在プレイヤー表示

// プログレス表示
'active-status'          // バトル場状況
'bench-status'           // ベンチ状況
'bench-count'            // ベンチポケモン数

// メッセージ・UI
'game-message-display'   // ゲームメッセージ
'initial-pokemon-selection'  // 初期ポケモン選択UI
'confirm-initial-pokemon-button'  // 確定ボタン

// アクションボタン
'retreat-button'         // にげるボタン
'attack-button'          // 攻撃ボタン
'end-turn-button'        // ターン終了ボタン

// 手札・情報
'player-hand'            // プレイヤー手札
'cpu-hand'               // CPU手札
'card-info-panel'        // カード詳細パネル
'action-modal'           // アクションモーダル
```

### データ属性
```javascript
// カード要素に付与される属性
img.dataset.cardId = card.id;        // カードID
img.dataset.owner = playerType;      // 所有者 ('player'|'cpu')
img.dataset.zone = zone;             // ゾーン ('active'|'bench'|...)
img.dataset.index = index;           // ゾーン内インデックス
```

---

## 🃏 カードデータ構造 (Card Data Structure)

### 基本カード
```javascript
Card = {
  id: string,                        // 一意ID
  name_en: string,                   // 英語名
  name_ja: string,                   // 日本語名
  card_type: "Pokemon"|"Energy"|"Trainer"
}
```

### ポケモンカード
```javascript
PokemonCard = {
  ...Card,
  card_type: "Pokemon",
  stage: "Basic"|"Stage1"|"Stage2",
  evolves_from?: string,             // 進化元名
  evolves_to?: string[],             // 進化先名一覧
  hp: number,                        // HP
  types: string[],                   // タイプ
  rule_box?: "ex"|"V"|"VMAX"|null,   // ルールボックス
  weakness?: {type:string, value:string}[],
  resistance?: {type:string, value:string}[],
  retreat_cost: number,              // 無色エネルギー個数
  ability?: {name_en, text_en, name_ja, text_ja},
  attacks: [{
    name_en: string,
    name_ja: string,
    cost: string[],                  // ["Grass","Colorless",...]
    damage?: number,                 // 基本ダメージ
    text_en?: string,
    text_ja?: string
  }],
  
  // ランタイム追加プロパティ
  attached_energy?: string[],        // 付いているエネルギー
  damage?: number,                   // 現在のダメージ
  special_conditions?: string[]      // 特殊状態
}
```

### エネルギーカード
```javascript
EnergyCard = {
  ...Card,
  card_type: "Energy",
  energy_type: "Grass"|"Fire"|"Water"|"Lightning"|"Psychic"|"Fighting"|"Darkness"|"Metal"|"Fairy"|"Dragon"|"Colorless",
  is_basic: boolean,
  text_en?: string,                  // 特殊エネルギー用
  text_ja?: string
}
```

### トレーナーカード
```javascript
TrainerCard = {
  ...Card,
  card_type: "Trainer",
  trainer_type: "Item"|"Supporter"|"Stadium",
  text_en: string,                   // 効果テキスト
  text_ja: string
}
```

---

## 🎮 ゲーム状態構造 (Game State Structure)

### メインステート
```javascript
State = {
  rngSeed: number,                   // RNG シード
  turn: number,                      // ターン数 (1開始)
  phase: string,                     // 現在フェーズ (GAME_PHASES使用)
  turnPlayer: "player"|"cpu",        // 現在のプレイヤー
  canRetreat: boolean,               // そのターンにリトリート可能か
  stadium?: Card | null,             // 場のスタジアム
  log: LogEntry[],                   // ゲームログ
  prompt?: {                         // ユーザー向けメッセージ
    message: string
  },
  pendingAction?: {                  // 保留中のアクション
    type: string,
    ...
  },
  
  players: {
    player: PlayerState,
    cpu: PlayerState
  }
}
```

### プレイヤーステート
```javascript
PlayerState = {
  deck: Card[],                      // 山札
  hand: Card[],                      // 手札
  active: PokemonCard | null,        // バトル場
  bench: (PokemonCard | null)[],     // ベンチ (最大5)
  discard: Card[],                   // トラッシュ
  prize: (Card | null)[],            // サイド (長さ6)
  prizeRemaining: number,            // 残りサイド数 (6→0)
  prizesToTake?: number              // 取得予定サイド数
}
```

---

## 🔧 関数命名規則 (Function Naming)

### ロジック関数 (logic.js)
```javascript
// カード移動
export function playBasicToBench(state, playerId, cardId)
export function evolvePokemon(state, playerId, baseId, evolveId)
export function attachEnergy(state, playerId, energyId, pokemonId)

// ゲーム処理
export function performAttack(state, attackerId, attackIndex)
export function checkForKnockout(state, defendingPlayerId)
export function checkForWinner(state)

// ユーティリティ
export function findPokemonById(playerState, pokemonId)
export function hasEnoughEnergy(pokemon, attack)
export function drawCard(state, playerId, count = 1)
```

### View関数 (view.js)
```javascript
// 描画
_renderBoard(boardElement, playerState, playerType, state)
_createCardElement(card, playerType, zone, index)
_renderPrizeArea(boardElement, prizes, playerType)

// UI制御
showGameMessage(message)
hideGameMessage()
updateGameStatus(state)
updateSetupProgress(state)

// イベント
setCardClickHandler(handler)
showCardInfo(card, targetElement)
```

### ターン管理 (turn-manager.js)
```javascript
// ターン制御
startPlayerTurn(state)
endPlayerTurn(state)
startCpuTurn(state)
endCpuTurn(state)

// アクション処理
handleAttackDeclaration(state, {attackIndex})
executeAttack(state)
handleCardPlay(state, {cardId, targetSlot})
```

---

## 🎨 アニメーション定数 (Animation Constants)

### CSS アニメーションクラス
```css
.animate-deal-card      /* カード配布 */
.animate-draw-card      /* ドロー */
.animate-play-card      /* カード使用 */
.animate-attack         /* 攻撃 */
.animate-damage         /* ダメージ */
.animate-hp-damage      /* HP減少 */
.animate-knockout       /* きぜつ */
.animate-energy-attach  /* エネルギー付与 */
.animate-fade-in        /* フェードイン */
.animate-slide-in-bottom /* 下からスライド */
.animate-evolution      /* 進化 */
```

### 状態表示クラス
```css
.card-selected          /* 選択中カード */
.slot-highlight         /* スロットハイライト */
.energy-target-highlight /* エネルギー対象ハイライト */
.error-message          /* エラーメッセージ */
```

---

## 📝 ログエントリ構造 (Log Entry Structure)

```javascript
LogEntry = {
  type: string,                      // ログタイプ
  message: string,                   // 表示メッセージ
  timestamp?: number,                // タイムスタンプ
  player?: "player"|"cpu",           // 関連プレイヤー
  cardId?: string,                   // 関連カードID
  details?: Object                   // 追加詳細情報
}
```

---

## ⚠️ 重要な注意事項

### 必須事項
1. **フェーズ定数**: 必ず `GAME_PHASES` を使用、文字列リテラル禁止
2. **プレイヤーID**: ロジックでは `'player'/'cpu'`、DOMでは `.player-self/.opponent-board`
3. **配列サイズ**: bench は最大5、prize は固定6
4. **null セーフ**: 描画時は必ず配列・オブジェクト存在チェック

### パフォーマンス考慮
1. **イミュータブル**: State変更は常に新オブジェクト作成
2. **DOM更新**: 必要最小限の要素のみ更新
3. **メモリ管理**: 不要なイベントリスナー削除

### デバッグ支援
1. **コンソールログ**: 重要な処理は絵文字付きでログ出力
2. **データ属性**: カード要素に識別情報を付与
3. **エラーハンドリング**: 不正状態での適切なエラーメッセージ

---

*このドキュメントは システム変更時に必ず更新してください*