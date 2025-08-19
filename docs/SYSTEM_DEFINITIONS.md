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

ゲーム内の各ゾーンは、コード内で文字列リテラルとして識別されます。

### ゾーン名
- `hand`
- `deck`
- `active`
- `bench`
- `discard`
- `prize`
- `stadium`

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

### サイドカード (6枚表示)
```css
.side-left .card-slot:nth-child(1) ... :nth-child(6)   /* プレイヤー側 */
.side-right .card-slot:nth-child(1) ... :nth-child(6) /* CPU側 */
```

### デッキ・トラッシュ
```css
.bottom-right-deck, .bottom-right-trash  /* プレイヤー側 */
.top-left-deck, .top-left-trash          /* CPU側 */
```

### 共通要素
```css
.stadium-slot      /* スタジアムカード */
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
export function placeCardInActive(state, player, cardId)
export function placeCardOnBench(state, player, cardId, benchIndex)
export function evolvePokemon(state, playerId, baseId, evolveId)
export function attachEnergy(state, playerId, energyId, pokemonId)
export function retreat(state, player, fromActiveId, toBenchIndex)
export function promoteToActive(state, player, benchIndex)
export function takePrizeCard(state, player, prizeIndex)

// ゲーム処理
export function performAttack(state, attackingPlayerId, attackIndex)
export function checkForKnockout(state, defendingPlayerId)
export function checkForWinner(state)

// ユーティリティ
export function findCardInHand(playerState, cardId)
export function findPokemonById(playerState, pokemonId)
export function hasEnoughEnergy(pokemon, attack)
export function drawCard(state, playerId)
```

### View関数 (view.js)
```javascript
// 描画
render(state)
_clearBoard()
_renderBoard(boardElement, playerState, playerType, state)
_renderHand(handElement, hand, playerType)
_renderPrizeArea(boardElement, prize, playerType)
_renderStadium(state)
_createCardElement(card, playerType, zone, index, isFaceDown)

// UI制御
bindCardClick(handler)
setConfirmSetupButtonHandler(handler)
showModal({ title, body, actions })
hideModal()
showGameMessage(message)
hideGameMessage()
showErrorMessage(message)
showActionButtons(buttonsToShow)
hideActionButtons()
showInitialPokemonSelectionUI()
hideInitialPokemonSelectionUI()
updateGameStatus(state)
updateSetupProgress(state)
updateStatusTitle(title)
updateStatusMessage(message)

// イベント・ハイライト
_makeSlotClickable(slotElement, zone, index)
_initHandDock()
_positionHandAgainstBoard(desiredOverlapPx)
_getDesiredHandGap()
_updateHandContainerHeight()
_debugZOrder()
showCardInfo(card, targetElement)
hideCardInfo()
_generateCardInfoHtml(card)
```

### ターン管理 (turn-manager.js)
```javascript
// クラス: TurnManager
constructor()
startPlayerTurn(state)
handlePlayerDraw(state)
handlePlayerMainPhase(state, action, actionData)
handlePlayBasicPokemon(state, { cardId, benchIndex })
handleAttachEnergy(state, { energyId, pokemonId })
handleUseTrainer(state, { cardId, trainerType })
handleRetreat(state, { fromActiveId, toBenchIndex })
handleAttackDeclaration(state, { attackIndex })
executeAttack(state)
endPlayerTurn(state)
startCpuTurn(state)
executeCpuTurn(state)
cpuPromoteToActive(state)
cpuPlayBasicPokemon(state)
cpuAttachEnergy(state)
cpuCanAttack(state)
cpuPerformAttack(state)
endCpuTurn(state)
processSpecialConditions(state, playerId)
animateCardDraw(playerId)
animateAttack(attackerId, state)
animateEnergyAttachment(playerId)
simulateCpuThinking(baseTime)
getTurnActions()
reset()
```

### アニメーション管理 (animations.js)
```javascript
// クラス: AnimationManager
constructor()
animateDealCards(cardElements, staggerDelay)
animateDrawCard(cardElement)
animateDealCardsNoFade(cardElements, staggerDelay)
animateInitialHandDeal(cardElements, staggerDelay)
animatePrizeDeal(elements, staggerDelay)
animatePlayCard(cardElement, fromPosition, toPosition)
animateSmoothCardMove(cardElement, fromContainer, toContainer, animationType)
animateAttack(attackerElement, defenderElement)
animateHPDamage(hpElement)
animateKnockout(pokemonElement)
animateEnergyAttach(energyElement, targetElement)
highlightCard(cardElement)
unhighlightCard(cardElement)
highlightSlot(slotElement, type)
unhighlightSlot(slotElement, type)
clearAllHighlights()
animateMessage(messageElement)
animateError(messageElement)
animateHandEntry(cardElements)
animateModalShow(modalElement)
animateModalHide(modalElement)
animateEvolution(pokemonElement, evolutionCard)
animateSpecialCondition(pokemonElement, condition)
flipCardFaceUp(cardElement, newImageSrc)
animateAdvancedAttack(attackerElement, defenderElement, attackType)
clearAllAnimations()
getElementPosition(element)
destroy()

// プライベートメソッド (内部使用)
_getConditionIcon(condition)
_createDefaultAttackEffect(container, attackerRect, defenderRect)
_animateDamageImpact(defenderElement)
_createLightningEffect(container, attackerRect, defenderRect) // 例: 未実装
_createFireEffect(container, attackerRect, defenderRect)     // 例: 未実装
_createWaterEffect(container, attackerRect, defenderRect)    // 例: 未実装
_createGrassEffect(container, attackerRect, defenderRect)    // 例: 未実装
addAnimationClass(element, className)
removeAnimationClass(element, className)
waitForAnimation(element, animationName, callback)
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
.animate-deal-card-nofade /* フェードなし配布 */
.animate-evolution-placement /* 進化配置 */
.error-message          /* エラーメッセージ */
```

### 状態表示クラス
```css
.card-selected          /* 選択中カード */
.slot-highlight         /* スロットハイライト */
.energy-target-highlight /* エネルギー対象ハイライト */
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