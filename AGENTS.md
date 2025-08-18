了解。**実装に必要な最小限の仕様**だけに削ってまとめました。これに沿ってコードが書けます。

---

# 実装最小仕様（Coding-Only）

## 1) データスキーマ（cards\_master.json / cards.js）

**共通**:
`id:string, name_en:string, name_ja:string, card_type:"Pokemon"|"Energy"|"Trainer"`

**Pokemon**

```
{
  id, name_en, name_ja, card_type:"Pokemon",
  stage:"Basic"|"Stage1"|"Stage2",
  evolves_from?: string, evolves_to?: string[],
  hp:number, types:string[], rule_box?: "ex"|"V"|"VMAX"|null,
  weakness?: {type:string, value:"×2"|"+"|"-"}[],
  resistance?: {type:string, value:"-30"|"-20"|"-"},
  retreat_cost:number,               // 無色アイコン個数
  ability?: {name_en, text_en, name_ja, text_ja},
  attacks:[{
    name_en, name_ja,
    cost: string[],                  // ["Grass","Colorless",...]
    damage?: number,                 // 数値のみ（可変は text_en に記述）
    text_en?: string, text_ja?: string
  }],
  attached_energy?: string[],        // ランタイムで使用（stateで管理）
  special_conditions?: string[]      // "Poisoned" | "Burned" | "Asleep" | "Paralyzed" | "Confused"
}
```

**Energy**

```
{
  id, name_en, name_ja,
  card_type:"Energy",
  energy_type:"Grass"|"Fire"|"Water"|"Lightning"|"Psychic"|"Fighting"|"Darkness"|"Metal"|"Fairy"|"Dragon"|"Colorless",
  is_basic: boolean,
  text_en?: string, text_ja?: string   // 特殊エネ用（提供タイプ/条件）
}
```

**Trainer**

```
{
  id, name_en, name_ja,
  card_type:"Trainer",
  trainer_type:"Item"|"Supporter"|"Stadium",
  text_en, text_ja
}
```

---

## 2) ゲームステート（state.js）

```
State = {
  rngSeed:number,
  turn:number,                        // 1開始
  phase:"setup"|"playing"|"betweenTurns"|"gameOver",
  turnPlayer:"player"|"cpu",
  canRetreat:boolean,                 // そのターン未実行ならtrue
  stadium?: Card | null,
  log: LogEntry[],

  players:{
    player: PlayerState,
    cpu:    PlayerState
  }
}

PlayerState = {
  deck: Card[],
  hand: Card[],
  active: PokemonCard | null,
  bench: (PokemonCard | null)[],      // 最大5（nullは空スロット）
  discard: Card[],
  prize: (Card | null)[],             // 長さ6（裏向き保持、公開時のみCard）
  prizeRemaining:number,              // 6→0
  statusChips?: {dmg:number, special?:string[]} // 表示用派生
}
```

---

## 3) ゾーンとセットアップ（logic.setupGame）

* デッキ60枚をシャッフル、**7枚ドロー**。
* **たね**1枚を`active`へ、**任意でベンチ最大5**。
* `prize` に**6枚**を裏向きでセット（配列長6を保証）。
* 先攻/後攻を決定。`phase="playing"`、`turn=1`、`turnPlayer=player`。

---

## 4) ターン進行（logic.\*）

順序自由・制約あり。**攻撃後にターン終了**。

```
startTurn(state):
  draw 1（ドロー不可で敗北）
  canRetreat = true

mainPhase(state):
  - playBasicToBench(cardId)
  - evolvePokemon(baseId -> evolveId)  // 場に出たターンは不可
  - attachEnergy(pokemonId, energyId)  // 1/ターン
  - playItem(cardId)                   // 制限なし
  - playSupporter(cardId)              // 1/ターン
  - playStadium(cardId)                // 置き換え
  - useAbility(pokemonId, abilityIndex)
  - retreat(pokemonId)                 // canRetreat && 支払い成功 -> active/bench入替, canRetreat=false
  - declareAttack(attackIndex)         // エネ足りること
    -> resolveAttack()                 // ダメージ/効果/弱点/抵抗/バリア等
    -> checkKO() -> prizeGain()
    -> endTurn()
```

---

## 5) ダメージ処理

* **計算順**：効果修正 → 弱点/抵抗 → ダメカン配置（10刻み表示はView）。
* **特殊状態**：`Poisoned`(ターン毎に+10/20等), `Burned`(コイントス後ダメ), `Asleep/Paralyzed`(攻撃不能), `Confused`(攻撃時判定)。
  ベンチに下げる/進化で多くは解除。

---

## 6) きぜつ・勝利条件

* HP以上のダメージで**きぜつ**：場から`discard`（または効果でLost等）。
* **サイド取得**：通常1、`rule_box`によって2/3。
* 勝利：①サイド0枚取得、②相手の場にポケモン不在、③ドロー不能。

---

## 7) エンジン契約（純粋関数・副作用なし）

* `setupGame(state) -> state`
* `draw(state, player, n=1) -> state`
* `playBasicToBench(state, player, cardId) -> state`
* `evolvePokemon(state, player, baseId, evolveId) -> state`
* `attachEnergy(state, player, energyId, pokemonId) -> state`
* `playItem(state, player, cardId) -> state`
* `playSupporter(state, player, cardId) -> state`
* `playStadium(state, player, cardId) -> state`
* `useAbility(state, player, pokemonId, abilityIndex) -> state`
* `retreat(state, player, fromActiveId, toBenchIndex) -> state`
* `declareAttack(state, player, attackIndex) -> state`
* `endTurn(state) -> state`

> すべて**新Stateを返却**。View/DOMアクセス禁止。

---

## 8) View マッピング（view\.js）

**HTMLのIDとゾーンの対応（固定）**

* CPU: `#cpu-hand` `#cpu-bench` `#cpu-active` `#cpu-deck` `#cpu-discard` `#cpu-prize-area`
* YOU: `#you-hand` `#you-bench` `#you-active` `#you-deck` `#you-discard` `#you-prize-area`
* 共通: `#stadium-zone` `#log-scroll` `#turn-player` `#turn-indicator` `#end-turn-button` `#action-modal`

**描画ルール**

* **必ずnullセーフ**：

  ```
  const prize = Array.isArray(p.prize) ? p.prize : new Array(6).fill(null);
  const bench = Array.isArray(p.bench) ? p.bench.slice(0,5) : new Array(5).fill(null);
  ```
* サイドは**6スロット**常時描画（裏面画像）。
* CPU手札は**裏面**、自分は表。
* Active は大きめ1枠、Bench は横5枠グリッド、Hand は横スクロール。
* ダメージ/状態はカード上の `.overlay .chip` に反映。

---

## 9) 検証・制約

* デッキ60枚、**同名上限4**（基本エネ除外）。
* 進化は「直前に場に出たターン不可」「適正系統のみ」。
* エネルギー**手貼り1/ターン**、リトリート**1/ターン**。
* サポート**1/ターン**。スタジアムは場に1枚（置き換え）。

---

## 10) テスト最小セット

* **ユニット**：`attachEnergy` 上限、`retreat` コスト支払い、`evolve` タイミング、弱点/抵抗の計算。
* **シナリオ**：セットアップ→ドロー→手貼り→攻撃→きぜつ→サイド取得。
* **プロパティ**：シャッフルの一様性、攻撃後に `endTurn` 必須、ゾーン整合性。

---

## 11) Viewエラー対策（今回のログの要点）

* `renderSideDeckArea` で `player.prize.length` 参照時に **undefined** → **必ず配列化してから `.length`**。
  例：

  ```js
  const prize = Array.isArray(player.prize) ? player.prize : new Array(6).fill(null);
  // hand/bench/discard/deck も同様に防御
  ```
* 描画ヘルパーは **最新 state を引数で受け取る**（`this.state` 参照に依存しない）。

---

これだけあれば、**State/Logic/View** の最低限を確実に実装できます。必要なら、この仕様に合わせた\*\*雛形コード（state.js / logic.js / view\.js）\*\*もその場で出します。

了解しました。先ほどまとめた関数一覧に、**関数名・引数・戻り値の簡単な説明**を付け足して整理しました。

---

# 関数一覧（引数と戻り値の説明付き）

## 📂 cards.js

* **`cardMasterList`**
  定数。全カード情報の配列。
  **戻り値:** `Array<CardObject>`

* **`nameTranslations`**
  定数。英語名と日本語名の対応表。
  **戻り値:** `Object<{[enName: string]: string}>`

---

## 📂 state.js

* **`createInitialState()`**
  初期ゲーム状態を生成。
  **引数:** なし
  **戻り値:** `{ players, turn, log, stadium, ... }`（ゲーム全体の状態オブジェクト）

* **`createDeck()`**
  デッキ（カードの配列）を生成。
  **引数:** なし
  **戻り値:** `Array<CardObject>`

---

## 📂 logic.js（ゲームルール関連の純粋関数）

* **`setupGame(state)`**
  ゲーム開始時の初期化処理。
  **引数:** `state`（ゲーム状態）
  **戻り値:** 更新後の `state`

* **`startTurn(state)`**
  新しいターンの開始処理。
  **引数:** `state`
  **戻り値:** 更新後の `state`

* **`draw(state, player, n = 1)`**
  指定プレイヤーが山札からカードを引く。
  **引数:** `state`, `player`(string: `"p1"` or `"p2"`), `n`(int)
  **戻り値:** 更新後の `state`

* **`playBasicToBench(state, player, cardId)`**
  手札の基本ポケモンをベンチに出す。
  **引数:** `state`, `player`, `cardId`
  **戻り値:** 更新後の `state`

* **`evolvePokemon(state, player, baseId, evolveId)`**
  ポケモン進化処理。
  **引数:** `state`, `player`, `baseId`(進化元ID), `evolveId`(進化先ID)
  **戻り値:** 更新後の `state`

* **`attachEnergy(state, player, energyId, pokemonId)`**
  エネルギーカードをポケモンに付ける。
  **引数:** `state`, `player`, `energyId`, `pokemonId`
  **戻り値:** 更新後の `state`

* **`playItem(state, player, cardId)`**
  アイテムカードを使用。
  **引数:** `state`, `player`, `cardId`
  **戻り値:** 更新後の `state`

* **`playSupporter(state, player, cardId)`**
  サポートカードを使用。
  **引数:** `state`, `player`, `cardId`
  **戻り値:** 更新後の `state`

* **`playStadium(state, player, cardId)`**
  スタジアムカードを設置。
  **引数:** `state`, `player`, `cardId`
  **戻り値:** 更新後の `state`

* **`useAbility(state, player, pokemonId, abilityIndex)`**
  ポケモンの特性を発動。
  **引数:** `state`, `player`, `pokemonId`, `abilityIndex`
  **戻り値:** 更新後の `state`

* **`retreat(state, player, fromActiveId, toBenchIndex)`**
  アクティブポケモンをベンチに下げる。
  **引数:** `state`, `player`, `fromActiveId`, `toBenchIndex`
  **戻り値:** 更新後の `state`

* **`declareAttack(state, player, attackIndex)`**
  攻撃を宣言。
  **引数:** `state`, `player`, `attackIndex`
  **戻り値:** 更新後の `state`

* **`resolveAttack(state)`**
  攻撃ダメージや効果を適用。
  **引数:** `state`
  **戻り値:** 更新後の `state`

* **`checkKO(state)`**
  気絶判定を行う。
  **引数:** `state`
  **戻り値:** 更新後の `state`

* **`prizeGain(state)`**
  サイドカード取得処理。
  **引数:** `state`
  **戻り値:** 更新後の `state`

* **`endTurn(state)`**
  プレイヤーのターンを終了。
  **引数:** `state`
  **戻り値:** 更新後の `state`

* **`checkWinCondition(state)`**
  勝敗判定。
  **引数:** `state`
  **戻り値:** `{winner: string | null}` を含む更新後の `state`

---

## 📂 view\.js（描画関連）

* **`constructor(rootEl)`**
  Viewクラスの初期化。
  **引数:** `rootEl`（描画対象のDOM要素）
  **戻り値:** なし

* **`render(state)`**
  画面全体を描画。
  **引数:** `state`
  **戻り値:** なし

* **`renderPlayerAreas(state)`**
  両プレイヤーのエリアを描画。
  **引数:** `state`
  **戻り値:** なし

* **`renderPlayerArea(state, owner)`**
  プレイヤー個別エリアを描画。
  **引数:** `state`, `owner`(`"p1"` or `"p2"`)
  **戻り値:** なし

* **`renderSideDeckArea(state, owner)`**
  山札・捨て札・サイドカードをまとめて描画。
  **引数:** `state`, `owner`
  **戻り値:** なし

* **`renderHandArea(state, owner)`**
  手札を描画。
  **引数:** `state`, `owner`
  **戻り値:** なし

* **`renderBenchArea(state, owner)`**
  ベンチポケモンを描画。
  **引数:** `state`, `owner`
  **戻り値:** なし

* **`renderActiveArea(state, owner)`**
  アクティブポケモンを描画。
  **引数:** `state`, `owner`
  **戻り値:** なし

* **`renderDiscardArea(state, owner)`**
  トラッシュを描画。
  **引数:** `state`, `owner`
  **戻り値:** なし

* **`renderDeckArea(state, owner)`**
  デッキを描画。
  **引数:** `state`, `owner`
  **戻り値:** なし

* **`renderPrizeArea(state, owner)`**
  サイドカードを描画。
  **引数:** `state`, `owner`
  **戻り値:** なし

* **`renderStadium(state)`**
  スタジアムを描画。
  **引数:** `state`
  **戻り値:** なし

* **`renderTurnInfo(state)`**
  ターン数・プレイヤー情報を描画。
  **引数:** `state`
  **戻り値:** なし

* **`renderLog(state)`**
  バトルログを描画。
  **引数:** `state`
  **戻り値:** なし

* **`_createPlayerSide(state, owner)`**
  DOM生成（プレイヤーの全領域）。
  **引数:** `state`, `owner`
  **戻り値:** `HTMLElement`

* **`_createInfoArea(state)`**
  ゲーム情報エリアのDOMを生成。
  **引数:** `state`
  **戻り値:** `HTMLElement`

* **`_createDeckArea(state, owner)`**
  デッキ領域のDOMを生成。
  **引数:** `state`, `owner`
  **戻り値:** `HTMLElement`

* **`_createCardElement(state, card, options)`**
  1枚のカードDOMを生成。
  **引数:** `state`, `card`(CardObject), `options`(表示設定)
  **戻り値:** `HTMLElement`

---

## 📂 game.js（コントローラ）

* **`constructor(rootEl)`**
  Gameクラスの初期化。
  **引数:** `rootEl`
  **戻り値:** なし

* **`init()`**
  状態・ビューを初期化。
  **引数:** なし
  **戻り値:** なし

* **`start()`**
  ゲームを開始する。
  **引数:** なし
  **戻り値:** なし

* **`startGameLoop()`**
  ゲームループを開始。
  **引数:** なし
  **戻り値:** なし

* **`gameLoop(ts)`**
  毎フレーム実行。
  **引数:** `ts`（タイムスタンプ）
  **戻り値:** なし

* **`render()`**
  状態をViewへ描画。
  **引数:** なし
  **戻り値:** なし

* **`updateState(newState)`**
  新しい状態を反映。
  **引数:** `newState`
  **戻り値:** なし

---

## 📂 main.js

* **`App.init()`**
  エントリーポイント。Gameを初期化。
  **引数:** なし
  **戻り値:** なし

* **`startApp()`**
  DOMContentLoaded後に起動。
  **引数:** なし
  **戻り値:** なし

---

