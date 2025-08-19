# ゲームシーケンス計画 (詳細版)

## 1. ゲームフェーズの定義

ゲームは以下の主要なフェーズで進行する。

*   **`setup`**: ゲーム開始前の準備フェーズ。
    *   `initialPokemonSelection`: プレイヤーが初期ポケモン（バトル場とベンチ）を選択する。
*   **`playerTurn`**: プレイヤーの番。
*   **`cpuTurn`**: CPUの番。
*   **`gameOver`**: ゲーム終了フェーズ。

## 2. 詳細なターンシーケンスとアニメーション

### 2.1. `setup` フェーズ

**目的**: プレイヤーとCPUが対戦準備を完了する。

**シーケンス**:

1.  **デッキ作成 & シャッフル (`state.js` `createDeck` / `setup-manager.js` `initializeGame`)**
    *   **アニメーション**: デッキがシャッフルされる視覚効果（例: カードが高速で入れ替わる、デッキが揺れる）。
2.  **初期手札ドロー (7枚) & マリガン (`setup-manager.js` `drawInitialHands`, `handleMulligans`)**
    *   **アニメーション**:
        *   デッキからカードが手札に移動するアニメーション (`animationManager.animateInitialHandDeal`)。
        *   マリガン時: 手札がデッキに戻り、デッキが再度シャッフルされ、新しい手札がドローされるアニメーション (`setupManager.performMulligan`, `animationManager.animateMulligan`)。
    *   **UI**: マリガンが発生した場合、メッセージ表示 (`view.showMessage`)。
3.  **`initialPokemonSelection` フェーズへの移行 (`game.js` `_startGameSetup`)**
    *   **UI**: セットアップオーバーレイが表示され、プレイヤーの手札からたねポケモンがハイライト表示される。
    *   **アニメーション**: オーバーレイがフェードインする。

#### 2.1.1. `initialPokemonSelection` サブフェーズ (プレイヤー操作)

**目的**: プレイヤーがバトル場とベンチの初期ポケモンを選択する。

**シーケンス**:

1.  **プレイヤーが手札のたねポケモンをクリック (`game.js` `_handleSetupCardClick`)**
    *   **UI**: クリックされたカードがハイライト表示される (`.selected` クラス)。
    *   **アニメーション**: カードが少し浮き上がる、または枠が光る (`animationManager.highlightCard`)。
2.  **プレイヤーがバトル場スロットをクリック (`game.js` `_handleSetupCardClick`)**
    *   **条件**: `selectedCardForSetup`が設定されていること。
    *   **アクション**: `setupManager.handlePokemonSelection` を呼び出し、選択されたカードがバトル場スロットに移動し、`active`に設定される。手札からカードが削除される。
    *   **UI**: バトル場スロットに選択されたポケモンが表示される。手札からカードが消える。
    *   **アニメーション**: カードが手札からバトル場スロットへ移動するアニメーション (`game.js` `_animateCardPlacement`)。
3.  **プレイヤーがベンチスロットをクリック (`game.js` `_handleSetupCardClick`)**
    *   **条件**: `selectedCardForSetup`が設定されていること。ベンチが5体未満であること。
    *   **アクション**: `setupManager.handlePokemonSelection` を呼び出し、選択されたカードがベンチスロットに移動し、`bench`に追加される。手札からカードが削除される。
    *   **UI**: ベンチスロットに選択されたポケモンが表示される。手札からカードが消える。
    *   **アニメーション**: カードが手札からベンチスロットへ移動するアニメーション (`game.js` `_animateCardPlacement`)。
4.  **プレイヤーが「確定」ボタンをクリック (`game.js` `_handleConfirmSetup`)**
    *   **条件**: バトルポケモンが選択されていること (`state.players.player.active`が`null`でないこと)。
    *   **アクション**:
        *   CPUの初期ポケモン（バトル場とベンチ）が自動で選択・配置される (`setupManager.setupCpuInitialPokemon`)。
        *   **各プレイヤーの山札の上から6枚がサイドカードとして裏向きで配置される (`setupManager.setupPrizeCards`)**。
        *   `gamePhase`が `playerTurn` に移行する。
    *   **UI**: セットアップオーバーレイが非表示になる。メインゲームボードが表示される。
    *   **アニメーション**: オーバーレイがフェードアウトする。バトル場とベンチのポケモンが表向きになるアニメーション (`animationManager.flipCardFaceUp`)。サイドカードがデッキから配置されるアニメーション (`animationManager.animatePrizeDeal`)。

### 2.2. `playerTurn` フェーズ

**目的**: プレイヤーが自分の番にできるアクションを実行する。

**シーケンス**:

1.  **ターン開始時のドロー (`turn-manager.js` `handlePlayerDraw` -> `Logic.drawCard`)**
    *   **UI**: メッセージ表示 (`view.showGameMessage`)。
    *   **アニメーション**: デッキからカードが手札に移動するアニメーション (`animationManager.animateDrawCard`)。
2.  **プレイヤーアクション (任意の順序、回数制限あり)**
    *   **手札からたねポケモンをベンチに出す (`game.js` `_handleHandCardClick` -> `turnManager.handlePlayerMainPhase` -> `Logic.placeCardOnBench`)**
        *   **UI**: 手札のたねポケモンがクリック可能に。ベンチスロットがハイライトされる。
        *   **アニメーション**: カードが手札からベンチへ移動するアニメーション (`game.js` `_animateCardPlacement`)。
    *   **手札からエネルギーをポケモンにつける (`game.js` `_handleHandCardClick` -> `turnManager.handlePlayerMainPhase` -> `Logic.attachEnergy`)**
        *   **UI**: 手札のエネルギーカードがクリック可能に。バトル場/ベンチのポケモンがハイライトされる。
        *   **アニメーション**: エネルギーカードが手札からポケモンへ移動し、ポケモンにアタッチされるアニメーション (`game.js` `_animateEnergyAttachment`)。
    *   **トレーナーズカードを使用 (未実装)**
    *   **特性を使用 (未実装)**
    *   **ポケモンを進化させる (未実装)**
    *   **バトルポケモンをにがす (`game.js` `_handleRetreat` -> `turnManager.handlePlayerMainPhase` -> `Logic.retreat`)**
        *   **UI**: 「にげる」ボタンがクリック可能に。ベンチポケモンが選択可能に。
        *   **アニメーション**: バトルポケモンがベンチへ、ベンチポケモンがバトル場へ移動するアニメーション (`game.js` `_animatePokemonPromotion`)。にげるコストのエネルギーがトラッシュへ移動するアニメーション。
3.  **攻撃 (`game.js` `_handleAttack` -> `turnManager.handleAttackDeclaration` -> `turnManager.executeAttack` -> `Logic.performAttack`)**
    *   **条件**: ターンに1回のみ。必要なエネルギーがアタッチされていること。
    *   **UI**: 「攻撃」ボタンがクリック可能に。
    *   **アニメーション**:
        *   攻撃エフェクト (`animationManager.animateAttack`)。
        *   ダメージ表示（ダメカンが乗るアニメーション） (`animationManager.animateHPDamage`)。
        *   きぜつ時: きぜつしたポケモンがトラッシュへ移動するアニメーション (`animationManager.animateKnockout`)。
    *   **アクション**: 攻撃後、ターン終了へ自動移行。
    *   **サイドカードの取得**: 相手のポケモンがきぜつした場合、**攻撃したプレイヤーはサイドカードを取得する**。
        *   取得枚数は、きぜつしたポケモンの種類によって異なる（例: 通常1枚、ポケモンV/exは2枚、ポケモンVMAXは3枚）。
        *   サイドカードは、**攻撃したプレイヤーのサイドの山から1枚ずつ手札に加える**。この際、カードは表向きにされる。
        *   **アニメーション**: サイドカードがサイドエリアから手札に移動するアニメーション (`game.js` `_animatePrizeTake`)。
4.  **ターン終了 (`game.js` `_handleEndTurn` -> `turnManager.endPlayerTurn`)**
    *   **UI**: 「ターン終了」ボタンがクリック可能に。
    *   **アクション**: `turnPlayer`が切り替わり、`turn`が増加する。

### 2.3. `cpuTurn` フェーズ

**目的**: CPUが自分の番にできるアクションを実行する。

**シーケンス**:

1.  **ターン開始時のドロー (`turn-manager.js` `executeCpuTurn` -> `Logic.drawCard`)**
    *   **UI**: メッセージ表示 (`view.showGameMessage`)。
    *   **アニメーション**: デッキからカードがCPUの手札に移動するアニメーション（裏向き） (`animationManager.animateDrawCard`)。
2.  **CPUアクション (`turn-manager.js` `executeCpuTurn`)**
    *   **たねポケモンをベンチに出す**: CPUの手札からたねポケモンをベンチに出す (`turnManager.cpuPlayBasicPokemon` -> `Logic.placeCardOnBench`)。
        *   **アニメーション**: カードがCPUの手札からベンチへ移動するアニメーション。
    *   **エネルギーをポケモンにつける**: CPUのアクティブポケモンにエネルギーをつける (`turnManager.cpuAttachEnergy` -> `Logic.attachEnergy`)。
        *   **アニメーション**: エネルギーカードがCPUの手札からポケモンへ移動し、ポケモンにアタッチされるアニメーション。
    *   **攻撃**: 攻撃可能な場合、攻撃する (`turnManager.cpuPerformAttack` -> `turnManager.executeAttack` -> `Logic.performAttack`)。
        *   **アニメーション**: 攻撃エフェクト、ダメージ表示、きぜつ時アニメーション。
3.  **ターン終了 (`turn-manager.js` `endCpuTurn`)**
    *   **アクション**: `turnPlayer`が切り替わり、`turn`が増加する。

### 2.4. `gameOver` フェーズ

**目的**: どちらかのプレイヤーが勝利条件を満たしたときにゲームを終了する。

**シーケンス**:

1.  **勝利条件チェック (`Logic.checkForWinner`)**
    *   **条件**: サイドカードが0枚、バトルポケモンが出せない、山札切れなど。
2.  **ゲーム終了 (`game.js` `_handleGameOver`)**
    *   **UI**: 勝利メッセージが表示される。ゲームボード上の操作が無効になる。
    *   **アニメーション**: 勝利演出（例: 画面が光る、勝利プレイヤーのポケモンが強調される）。

## 3. UI/UXの考慮事項

*   **フィードバック**: プレイヤーのアクション（カードを引く、ダメージを与えるなど）に対して、常に視覚的・テキスト的なフィードバックを提供する。
*   **選択状態の明示**: クリック可能なカードやスロットはハイライト表示する。選択中のカードは明確に区別する。
*   **エラーメッセージ**: 不正な操作やルール違反があった場合、明確なメッセージでプレイヤーに通知する。
*   **アニメーションの速度**: アニメーションはゲームのテンポを損なわない適切な速度に設定する。

## 4. コードへのマッピング

*   **`state.js`**: ゲームのあらゆる状態を保持する。
*   **`logic.js`**: 各アクションのルール処理と状態遷移を担当する純粋関数群。
*   **`view.js`**: `state`オブジェクトをDOMにマッピングし、UIの描画とアニメーションを担当する。
*   **`game.js`**: コントローラーとして、ユーザー入力やCPUの行動に応じて`Logic`を呼び出し、`state`を更新し、`View`に描画を指示する。フェーズ管理もここで行う。
*   **`setup-manager.js`**: ゲーム開始時のセットアップフェーズ（初期手札、マリガン、初期ポケモン配置、サイドカード配置）を管理する。
*   **`turn-manager.js`**: プレイヤーとCPUのターン進行、ターン制約、自動処理を統括する。
*   **`animations.js`**: 各種アニメーションの実行と管理を行う。