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

# ポケモンカードゲーム ルールブック (初心者向け)

このルールブックは、ポケモンカードゲームを全く知らない方が、基本的な遊び方を理解できるように作成されています。

## 1. ゲームを始める前に必要なもの

ポケモンカードゲームをプレイするには、以下のものが必要です。

-   **60枚のデッキ**: ポケモン、エネルギー、トレーナーズ（グッズ、サポート、スタジアム）のカードを組み合わせて作ります。
-   **コイン**: 技の効果などで使用します。
-   **ダメカン（ダメージカウンター）**: ポケモンが受けたダメージを示すために使います。
-   **どく・やけどマーカー**: ポケモンが特殊状態になったときに使います。
-   **プレイマット（任意）**: カードを置く場所が分かりやすくなります。

## 2. ゲームの勝利条件

以下のいずれかの条件を満たしたプレイヤーが勝利します。

-   相手のポケモンを倒して、**サイドカードを6枚すべて取る**。
-   相手の場に、バトルポケモンもベンチポケモンもいなくなり、**ポケモンがいなくなる**。
-   相手の番の終わりに、相手の**山札が0枚**になる。

## 3. 対戦の準備

1.  **デッキをシャッフルする**: 自分の60枚のデッキをよくシャッフルし、山札として裏向きに置きます。
2.  **手札を引く**: 山札から上から7枚のカードを引いて手札とします。
3.  **たねポケモンを出す**: 手札の中からたねポケモンを1枚選び、バトル場に裏向きで置きます。手札にたねポケモンがいない場合は、システムが自動で手札をすべて山札に戻してシャッフルし、7枚引き直します。この際、相手プレイヤーはマリガンとして山札からカードを1枚引くことができます。
4.  **ベンチポケモンを出す（任意）**: 手札の中からたねポケモンを最大5枚まで選び、ベンチに裏向きで置きます。
5.  **サイドカードを置く**: 山札の上から6枚のカードを裏向きのまま、サイドカードとして置きます。
6.  **ゲームスタート！**: お互いにバトルポケモンとベンチポケモンを表にし、じゃんけんなどで先攻・後攻を決めます。

## 4. バトルの場所の名称

-   **バトル場**: 相手のポケモンと直接バトルする場所です。ポケモンは1匹だけ置けます。
-   **ベンチ**: バトルポケモンをサポートするポケモンを置く場所です。最大5匹まで置けます。
-   **山札**: デッキをシャッフルして裏向きに置く場所です。ここからカードを引きます。
-   **手札**: 山札から引いたカードや、トレーナーズのカードなどを持ちます。相手に見せることはありません。
-   **トラッシュ**: ポケモンが「きぜつ」したり、使い終わったエネルギーやトレーナーズのカードを置く場所です。
-   **サイド**: 山札から6枚を裏向きに置く場所です。相手のポケモンを「きぜつ」させるたびに、ここからカードを1枚取ることができます。

## 5. 自分の番にできること

先攻プレイヤーの最初の番は、サポートを使うことと、ポケモンを進化させることはできません。

自分の番が来たら、以下のことを好きな順番で、好きなだけ行うことができます（ただし、回数制限があるものもあります）。

1.  **山札からカードを1枚引く**: 自分の番の最初に必ず行います。
2.  **たねポケモンをベンチに出す**: 手札からたねポケモンをベンチに置けます。
3.  **ポケモンを進化させる**: バトル場やベンチのポケモンを、手札から進化ポケモンに重ねて進化させます。たねポケモンから1進化、1進化から2進化と段階的に進化します。出したばかりのたねポケモンは、その番には進化できません。
4.  **エネルギーをポケモンにつける**: 手札からエネルギーカードを1枚選び、バトル場またはベンチのポケモンに1枚だけつけられます。これは1ターンに1回しかできません。
5.  **トレーナーズのカードを使う**: グッズ、サポート、スタジアムの3種類があります。
    -   **グッズ**: 手札から何枚でも使えます。使ったらトラッシュします。
    -   **サポート**: 手札から1ターンに1枚だけ使えます。使ったらトラッシュします。
    -   **スタジアム**: 場に出ているスタジアムをトラッシュし、手札から1枚だけ出せます。場には1枚しか置けません。
6.  **ポケモンの特性を使う**: ポケモンが持っている特性を使うことができます。回数制限がない限り、何回でも使えます。
7.  **バトルポケモンを「にがす」**: バトルポケモンをベンチポケモンと入れ替えることができます。にがすには、そのポケモンの「にげるコスト」分のエネルギーをトラッシュする必要があります。にがしたポケモンはベンチに行き、ベンチのポケモンがバトル場に出ます。
8.  **技を使う**: バトルポケモンが持っている技を1つ選び、必要なエネルギーがついていれば使うことができます。技を使うと自分の番は終わりになります。

## 6. 技を使うとどうなる？

技を使うと、相手のバトルポケモンにダメージを与えたり、特殊な効果を与えたりします。

-   **ダメージ計算**: 技のダメージから、相手のポケモンの「抵抗力」を引きます。その後、相手のポケモンの「弱点」があればダメージが倍になります。
-   **きぜつ**: ダメージを受けてHPが0になったポケモンは「きぜつ」します。きぜつしたポケモンとついているカードはすべてトラッシュに置かれます。相手のポケモンをきぜつさせたプレイヤーは、きぜつさせたポケモンの種類に応じてサイドカードを1枚、または複数枚（ポケモンV/exは2枚、ポケモンVMAXは3枚）取ります。
-   **特殊状態**: 技の効果で「どく」「やけど」「ねむり」「マヒ」「こんらん」などの特殊状態になることがあります。それぞれ異なる効果があります。

## 7. サイドカード

相手のポケモンを「きぜつ」させるたびに、自分のサイドカードを1枚、または複数枚（きぜつさせたポケモンの種類による）取ることができます。先に6枚すべて取ったプレイヤーが勝利します。

## 8. ゲームの流れのまとめ

1.  **対戦準備**
2.  **先攻プレイヤーの番**
    -   山札からカードを1枚引く
    -   できることを好きなだけ行う（エネルギーをつける、ポケモンを進化させる、トレーナーズを使う、特性を使う、にがす）
    -   技を使う（番が終わる）
3.  **後攻プレイヤーの番**
    -   山札からカードを1枚引く
    -   できることを好きなだけ行う
    -   技を使う（番が終わる）
4.  **どちらかの勝利条件が満たされるまで、2と3を繰り返す**

● ポケモンカードゲーム 完全フロー

  🎯 第1段階: セットアップフェーズ

  ---
  1. じゃんけん（ROCK_PAPER_SCISSORS）

  プレイヤーの操作:
  - グー・チョキ・パーのボタンが表示される
  - プレイヤーがいずれかをクリック

  CPUの動作:
  - ランダムで選択（33.3%ずつの確率）
  - 選択サウンド再生

  勝敗処理:
  - あいこの場合：「あいこ！もう一度！」表示で再じゃんけん
  - プレイヤー勝利→先攻後攻選択権を得る
  - CPU勝利→CPUが自動で先攻後攻を決定（70%確率で先攻選択）

  視覚エフェクト:
  - 勝敗結果のフローティングテキスト表示
  - サウンドエフェクト再生

  ---
  2. 先攻後攻選択（FIRST_PLAYER_CHOICE）

  プレイヤー勝利時:
  - 「先攻」「後攻」ボタンが表示される
  - プレイヤーが選択

  CPU勝利時:
  - CPUが2秒間の思考時間後に自動選択
  - 70%確率で先攻、30%確率で後攻を選択
  - 「CPUが先攻/後攻を選択しました」メッセージ表示

  ---
  3. 山札配置（DECK_PLACEMENT）

  自動処理:
  - 両プレイヤーのデッキをシャッフル
  - デッキシャッフルアニメーション実行
  - 「デッキをシャッフルして山札の場所に置いています...」メッセージ
  - 1.5秒待機後、次フェーズへ

  ---
  4. 手札配布（HAND_DEAL）

  自動処理:
  - プレイヤー・CPU共に7枚ドロー
  - 順次手札配布アニメーション実行は削除
  - プレイヤーとCPU の一括で手札出現アニメーション
  - 「山札から手札を7枚引いています...」メッセージ

  マリガンシステム:
  - たねポケモンがない場合は自動で山札に戻してシャッフル・再ドロー
  - 最大3回まで可能

  ---
  5. バトルポケモン配置（ACTIVE_PLACEMENT）

  CPUの自動配置:
  - たねポケモンを自動でバトル場に配置
  - 配置アニメーション実行
  - 「CPUがバトルポケモンを配置しました」ログ

  プレイヤーの操作:
  - 手札のたねポケモンカードをクリック
  - バトル場スロットにドラッグ&ドロップまたは配置ボタン
  - 配置アニメーション実行

  ---
  6. ベンチポケモン配置（BENCH_PLACEMENT）

  CPUの自動配置:
  - 手札のたねポケモンを自動でベンチに配置（最大5匹）
  - 戦略的判断でベンチ数を決定

  プレイヤーの操作:
  - 手札のたねポケモンをベンチスロットに配置
  - スキップ可能（「配置完了」ボタン）
  - 最大5匹まで配置可能

  ---
  7. サイドカード配置（PRIZE_PLACEMENT）

  プレイヤーは操作、CPUは、ポケモンの配置後自動実行:
  - プレイヤーに6枚のサイドカードを裏向きで配置
  - プレイヤーとCPUはノンブロッキングで、準備フェーズの間に互いに干渉せず実施
  - サイドカード配置アニメーション（山札からサイドへの動き）
両者のサイドカードの配布が終わったら準備終了
  ---
  8. カード公開・バトル開始（CARD_REVEAL）

  自動処理:
  - 全ポケモンカードを表向きに
  - カード公開アニメーション実行
  - 「ポケモンを表向きにして、バトル開始！」メッセージ
  - ターン1開始、先攻プレイヤーのターンに移行

  ---
  🎮 第2段階: バトルフェーズ

  ---
  9. プレイヤーターン

  9-1. ドローフェーズ（PLAYER_DRAW）
  - 山札から1枚ドロー（クリックで手動）先攻はCPUの場合もあり
  - カードドローアニメーション
  - ドロー不能の場合はゲーム敗北

  9-2. メインフェーズ（PLAYER_MAIN）
  プレイヤーが自由に以下の行動を選択：

  たねポケモンをベンチに出す:
  - 手札のたねポケモンをベンチスロットにドラッグ
  - 制限なし（ベンチ空きスロットがある限り）

  ポケモン進化:
  - ベンチまたはバトル場のポケモンをクリック
  - 進化可能な場合は進化ボタン表示
  - 場に出た最初のターンは進化不可

  エネルギー付与:
  - 手札のエネルギーをポケモンにドラッグ
  - 1ターンに1回のみ
  - エネルギー付与アニメーション

  トレーナーカード使用:
  - アイテム：制限なし
  - サポート：1ターンに1回のみ
  - スタジアム：場に1枚のみ（置き換え可能）

  にげる:
  - バトルポケモンをベンチと入れ替え
  - にげるコスト（エネルギー）が必要
  - 1ターンに1回のみ

  攻撃宣言:
  - バトルポケモンの攻撃ボタンをクリック
  - 必要エネルギーが足りていること
  - 攻撃後は自動でターン終了

  ---
  10. CPUターン

  10-1. CPUドローフェーズ（CPU_DRAW）
  - 自動で1枚ドロー
  - ドローアニメーション実行

  10-2. CPUメインフェーズ（CPU_MAIN）
  CPUが以下のAI戦略で自動行動：

  1. バトルポケモン不在チェック:
  - バトルポケモンがいない場合、ベンチから自動昇格
  - 昇格不可の場合はゲーム敗北

  2. たねポケモン配置:
  - 手札のたねポケモンを空きベンチに自動配置
  - 戦略的判断で配置優先度決定

  3. エネルギー付与:
  - 手札のエネルギーをバトルポケモンに優先付与
  - 1ターンに1回のみ

  4. 攻撃可能性チェック:
  - バトルポケモンの攻撃に必要なエネルギーが足りるかチェック

  10-3. CPU攻撃フェーズ（CPU_ATTACK）
  攻撃可能時:
  - 戦略的AIで最適攻撃を選択：
    - 相手を倒せる攻撃を優先
    - 高ダメージ攻撃を優先
    - ランダム要素も含む
  - 攻撃アニメーション実行
  - 画面シェイクエフェクト

  攻撃不可時:
  - ターン終了（パス）

  ---
  🎯 第3段階: 戦闘処理

  ---
  11. 攻撃処理（共通）

  ダメージ計算:
  1. 基本ダメージ
  2. 弱点・抵抗力計算
  3. 特殊効果適用
  4. ダメージ確定

  アニメーション:
  - 攻撃者：攻撃モーション
  - 守備側：ダメージシェイク
  - ダメージ数値ポップアップ
  - HPダメージ表示更新

  ノックアウト判定:
  - HP0以下でポケモンきぜつ
  - ノックアウトアニメーション
  - トラッシュに移動

  ---
  12. サイド獲得処理（PRIZE_SELECTION）

  通常ポケモン:
  - サイドカード1枚獲得
  - プレイヤー：任意のサイドカードを選択
  - CPU：ランダムで1枚選択
  - サイド獲得アニメーション

  ポケモンex/V系:
  - サイドカード2枚獲得
  - 複数枚選択画面表示

  ---
  13. 新バトルポケモン選択（AWAITING_NEW_ACTIVE）

  プレイヤー:
  - ベンチポケモン選択画面表示
  - 任意のベンチポケモンをクリック
  - バトル場昇格アニメーション

  CPU:
  - ベンチから自動選択（戦略的AI）
  - 即座に昇格処理

  ---
  🏆 第4段階: 勝敗判定

  ---
  14. 勝利条件チェック（各ターン後）

  サイド勝利:
  - サイドカード6→0枚で勝利
  - 「すべてのサイドカードを獲得しました！」

  場荒らし勝利:
  - 相手のポケモンが場にいない状態
  - 「相手のポケモンがいなくなりました！」

  デッキアウト勝利:
  - 相手がドローできない状態
  - 「相手の山札がなくなりました！」

  ---
  15. ゲーム終了（GAME_OVER）

  勝利演出:
  - 勝利アニメーション実行
  - 勝利サウンド再生
  - 「勝利！」メッセージ表示
  - 残りポケモンにパルス＋リング効果

  敗北演出:
  - 敗北アニメーション実行
  - 敗北サウンド再生
  - 「敗北...」メッセージ表示

  ゲーム終了後:
  - 「新しいゲーム」ボタン表示
  - 統計情報表示（任意）

  ---
  🎨 演出・アニメーション詳細

  カード移動アニメーション:
  - 手札→場：弧を描いて移動
  - 山札→手札：上から下への移動
  - サイド→手札：横から中央への移動

  戦闘アニメーション:
  - 攻撃タイプ別モーション（炎・水・電気など）
  - ダメージ数値の3Dポップアップ
  - 画面シェイク（ダメージ量に応じて強度変化）

  UI状態管理:
  - トースト通知（非ブロッキング）
  - アクションHUD（状況依存ボタン）
  - ステータスパネル（ゲーム状況表示）
  - 中央モーダル（重要選択時）

  サウンド効果:
  - フェーズ遷移音
  - カード操作音
  - 攻撃音（タイプ別）
  - 勝敗決定音

  このフローが完全なポケモンカードゲームの流れとなります。