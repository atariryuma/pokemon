# ゲームシーケンス

このドキュメントは、ゲームの開始から終了までの処理の流れを、具体的な関数名と共に定義します。

## 1. 初期化 (Initialization)

ユーザーがゲームを開始したときの最初の処理フローです。

1.  **`game.init()`**
    *   アプリケーションのエントリーポイント。
    *   `state.createInitialState()` を呼び出し、空のゲーム状態オブジェクトを生成します。
    *   `view.render(initialState)` を呼び出し、空のプレイマットを画面に描画します。

## 2. ゲーム準備 (Setup Phase)

`logic.setupGame(state)` 関数が呼び出され、以下の手順で対戦準備を進行します。

1.  **デッキの準備**:
    *   `createDeck()` を使用して、プレイヤーとCPU双方のデッキ（カード60枚の配列）を生成し、シャッフルします。

2.  **手札を引く**:
    *   `draw(state, player, 7)` を実行し、各プレイヤーが山札から7枚のカードを手札に加えます。

3.  **バトル場のポケモン配置**:
    *   各プレイヤーは手札から「たねポケモン」を1枚選び、バトル場に裏向きで配置します。
    *   （UI操作）→ `setActivePokemon(state, player, cardId)` のような関数でstateを更新。
    *   手札に「たねポケモン」がいない場合は、手札を山札に戻して引き直すマリガン処理を行います。

4.  **ベンチのポケモン配置（任意）**:
    *   各プレイヤーは手札から「たねポケモン」を最大5枚まで選び、ベンチに裏向きで配置します。
    *   （UI操作）→ `playBasicToBench(state, player, cardId)` でstateを更新。

5.  **サイドカードの配置**:
    *   **`setPrizeCards(state, player)`** を実行します。
    *   各プレイヤーの**山札の上から6枚のカード**を、それぞれのサイドゾーンに裏向きで配置します。
    *   これにより `player.prize` 配列（長さ6）が設定されます。

6.  **対戦開始**:
    *   先攻・後攻を決定します。
    *   場のポケモンをすべて表向きにします。
    *   ゲームの状態を更新します: `state.phase = "playing"`, `state.turn = 1`, `state.turnPlayer = (先攻プレイヤー)`。
    *   `view.render(state)` で最終的な盤面を描画します。

## 3. メインゲームループ (Main Game Loop)

`checkWinCondition(state)` で勝者が決まるまで、以下のターン進行を繰り返します。

### 3.1. ターンの開始 (Start of Turn)

*   **`logic.startTurn(state)`**
    1.  **カードを引く**: `draw(state, currentPlayer, 1)` を実行し、ターンプレイヤーが山札から1枚カードを引きます。
        *   この時、山札が0枚で引けない場合は、そのプレイヤーの敗北となります (`checkWinCondition` で判定)。
    2.  **ターン状態リセット**: `canRetreat = true` など、ターンごとにリセットされるフラグを更新します。

### 3.2. メインフェイズ (Main Phase)

ターンプレイヤーは、以下の行動を任意の順序・回数（各カードやルールの制限に従う）で実行できます。

*   `playBasicToBench(state, player, cardId)`: ベンチにポケモンを出す。
*   `evolvePokemon(state, player, baseId, evolveId)`: ポケモンを進化させる。
*   `attachEnergy(state, player, energyId, pokemonId)`: エネルギーをつける（1ターンに1回）。
*   `playItem(state, player, cardId)`: グッズカードを使う。
*   `playSupporter(state, player, cardId)`: サポートカードを使う（1ターンに1回）。
*   `playStadium(state, player, cardId)`: スタジアムを出す。
*   `useAbility(state, player, pokemonId, abilityIndex)`: ポケモンの特性を使う。
*   `retreat(state, player, fromActiveId, toBenchIndex)`: ポケモンをにがす（1ターンに1回）。

### 3.3. バトルフェイズ (Battle Phase)

技を宣言するとメインフェイズは終了し、バトルフェイズに移行します。

1.  **`logic.declareAttack(state, player, attackIndex)`**: プレイヤーが使用する技を選択。
2.  **`logic.resolveAttack(state)`**: ダメージ計算（弱点・抵抗力・効果）と効果の適用。
3.  **`logic.checkKO(state)`**: ポケモンのHPが0以下になったか（きぜつしたか）を判定。
    *   **きぜつした場合**:
        1.  きぜつしたポケモンと、ついているすべてのカードをトラッシュに送る。
        2.  **`logic.prizeGain(state, winningPlayer)`**: 相手をきぜつさせたプレイヤーが、**自分のサイドカードから指定された枚数（通常1枚、V/exなら2枚など）を手札に加える**。
        3.  `checkWinCondition(state)` を呼び出し、サイドを取り切ったか判定。
        4.  きぜつされた側は、ベンチから新しいバトルポケモンを選ぶ。
        5.  `checkWinCondition(state)` を再度呼び出し、場にポケモンがいなくなったか判定。

### 3.4. ターンの終了 (End of Turn)

*   **`logic.endTurn(state)`**
    1.  どく・やけどなどのポケモンチェックアップ処理を実行。
    2.  `checkWinCondition(state)` を呼び出し、状態異常による決着を判定。
    3.  ターンプレイヤーを相手に交代 (`state.turnPlayer`)。
    4.  ターン数を加算 (`state.turn++`)。

## 4. 勝敗判定 (Win Condition)

`logic.checkWinCondition(state)` は、以下の条件を常に監視し、いずれかが満たされた場合に勝者を決定し、`state.phase = "gameOver"` に設定します。

1.  **サイドを取り切る**: どちらかのプレイヤーの `prizeRemaining` が0になる。
2.  **場のポケモンが全滅**: 相手の場にバトルポケモンもベンチポケモンもいなくなる。
3.  **山札が尽きる**: 自分のターンの開始時に、山札からカードを1枚も引けない。