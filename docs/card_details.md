# カード情報詳細

このドキュメントでは、`cards.json` に定義されているカード情報と、関連するアセットについて詳細をまとめます。

## カードの種類

`cards.json` には主に2種類のカードが定義されています。

-   **Pokémon (ポケモン)**: バトルで使用する主要なカードです。HP、タイプ、技、弱点、抵抗力、にげるコストなどの情報を持っています。
-   **Basic Energy (基本エネルギー)**: ポケモンが技を使用するために必要なエネルギーカードです。

---

## ポケモンカード

### 共通プロパティ

-   `card_type`: カードの種類（例: "Pokémon"）
-   `name_en`: 英語名
-   `name_ja`: 日本語名
-   `stage`: 進化段階（例: "BASIC", "STAGE1", "STAGE2"）
-   `hp`: ヒットポイント
-   `type`: ポケモンのタイプ（例: "Colorless", "Grass", "Fire" など）
-   `attacks`: 技のリスト
    -   `name_en`: 技の英語名
    -   `name_ja`: 技の日本語名
    -   `cost`: 技を使用するために必要なエネルギーのタイプと数
    -   `damage`: 技のダメージ
    -   `effect_en`: 技の英語効果
    -   `effect_ja`: 技の日本語効果
-   `ability`: 特性（存在しない場合は `null`）
    -   `name_en`: 特性の英語名
    -   `name_ja`: 特性の日本語名
    -   `effect_en`: 特性の英語効果
    -   `effect_ja`: 特性の日本語効果
-   `weakness`: 弱点
    -   `type`: 弱点のタイプ
    -   `value`: ダメージ倍率（例: "×2"）
-   `resistance`: 抵抗力
    -   `type`: 抵抗力のタイプ
    -   `value`: ダメージ軽減値（例: "-20"）
-   `retreat_cost`: にげるコスト（必要なエネルギーのタイプと数）
-   `image`: 関連する画像アセットのパス（現状は空ですが、`assets/` フォルダ内の画像と関連付けられます）

### ポケモンカード一覧

#### Akamayabato (アカメバト)
-   **タイプ**: Colorless
-   **HP**: 130
-   **技**:
    -   ひっかく (Scratch): Lightning 1個で90ダメージ
    -   回ふく (Recover): Lightning, Grass, Water, Colorless 1個ずつで0ダメージ。自分のHPをすべて回ふく。相手の次の攻撃は70ダメージ小さくなる。
-   **弱点**: Darkness ×2
-   **抵抗力**: なし
-   **にげるコスト**: Colorless 1個
-   **画像アセット**: `assets/Akamayabato.webp`

#### Cat exv (猫exv)
-   **タイプ**: Colorless
-   **HP**: 200
-   **技**:
    -   突撃 (Assault): Fire, Darkness, Psychic, Colorless 1個ずつで150ダメージ。相手の攻撃を0にする。次の攻撃も0にする。
    -   たたきつける (Slam): Colorless 2個で80ダメージ
-   **弱点**: Fighting ×2
-   **抵抗力**: なし
-   **にげるコスト**: Colorless 2個
-   **画像アセット**: `assets/Neko_exv.webp`

#### Glasswing Butterfly Larva (イシガケチョウ 幼虫) - BASIC
-   **タイプ**: Grass
-   **HP**: 30
-   **技**:
    -   たたく (Pound): Grass 1個で10ダメージ
    -   よける (Evade): Lightning, Colorless 1個ずつで0ダメージ。相手の次の攻撃を50小さくする。
-   **弱点**: Fire ×2
-   **抵抗力**: Fighting -20
-   **にげるコスト**: Colorless 1個
-   **画像アセット**: `assets/Glasswing_Butterfly_Larva1.webp`

#### Glasswing Butterfly Larva (イシガケチョウ 幼虫) - STAGE1
-   **タイプ**: Grass
-   **HP**: 50
-   **技**:
    -   葉を食べる (Leaf Munch): Grass, Fire, Water 1個ずつで40ダメージ。このワザを使ったなら、＋50ダメージ。
    -   突撃 (Charge): Lightning 2個で50ダメージ
-   **弱点**: Fire ×2
-   **抵抗力**: Fighting -20
-   **にげるコスト**: Colorless 1個
-   **画像アセット**: `assets/Glasswing_Butterfly_Larva2.webp`

#### Glasswing Butterfly (イシガケチョウ) - STAGE2
-   **タイプ**: Grass
-   **HP**: 70
-   **技**:
    -   風をおこす (Gust): Grass, Colorless 1個ずつで30ダメージ
    -   蜜を吸う (Nectar Sip): Grass, Colorless 2個で60ダメージ。自分のHPを50回ふくする。
-   **弱点**: Fire ×2
-   **抵抗力**: Fighting -20
-   **にげるコスト**: Colorless 1個
-   **画像アセット**: `assets/Glasswing_Butterfly.webp`

#### Kobane Inago (コバネイナゴ)
-   **タイプ**: Grass
-   **HP**: 50
-   **技**:
    -   突撃 (Charge): Fire 1個で60ダメージ
-   **特性**: 隠れる (Hide): 相手の次の5回の攻撃を無効化する。
-   **弱点**: Fire ×2
-   **抵抗力**: Fighting -20
-   **にげるコスト**: Colorless 1個
-   **画像アセット**: `assets/Koban_Inago.webp`

#### Orange Spider (オレンジぐも)
-   **タイプ**: Grass
-   **HP**: 30
-   **技**:
    -   糸をはく (Spit Silk): Grass, Colorless 1個ずつで40ダメージ
-   **特性**: 糸をはる (Set Web): 相手の次の攻撃を無効化する。
-   **弱点**: Fire ×2
-   **抵抗力**: Fighting -20
-   **にげるコスト**: Colorless 1個
-   **画像アセット**: `assets/Orange_Spider.webp`

#### Tsumamurasaki Madara (つまむらさきまだら)
-   **タイプ**: Psychic
-   **HP**: 190
-   **技**:
    -   羽ばたく (Wing Beat): Fire, Colorless 2個で100ダメージ
-   **特性**: チート (Cheat): 自分のサイドを1つとる。
-   **弱点**: Darkness ×2
-   **抵抗力**: Fighting -20
-   **にげるコスト**: Colorless 2個
-   **画像アセット**: `assets/Tsumamura_Sakimadara.webp`

#### Grey Dagger Moth Larva (ハイイロヒトリの幼虫)
-   **タイプ**: Grass
-   **HP**: 90
-   **技**:
    -   毒を出す (Poison Spray): Darkness 2個で50ダメージ。相手をどく状態にする。
    -   回復 (Heal): Psychic, Fire, Darkness, Colorless 1個ずつで10ダメージ。コインを2回投げ、すべてオモテなら、HPをすべて回ふく。
-   **弱点**: Fire ×2
-   **抵抗力**: Fighting -20
-   **にげるコスト**: Colorless 1個
-   **画像アセット**: `assets/Haiirohitori_Larva.webp`

#### Short-horned Grasshopper (ショウヨウバッタ)
-   **タイプ**: Grass
-   **HP**: 80
-   **技**:
    -   とぶ (Jump): Grass 1個で10ダメージ。あぶなくなったら、とびはねてにげる。
    -   たたきつける (Slam): Colorless 2個で10ダメージ。コインを2回投げ、オモテの数×20ダメージ追加。
-   **弱点**: Fire ×2
-   **抵抗力**: Fighting -20
-   **にげるコスト**: Colorless 1個
-   **画像アセット**: `assets/Shouyou_Batta.webp`

#### Haiirohitori (ハイイロヒトリ) - STAGE1
-   **タイプ**: Psychic
-   **HP**: 120
-   **技**:
    -   攻撃アップ (Attack Up): Colorless, Grass, Fire, Darkness 1個ずつで120ダメージ。コインを1回投げ、オモテならこの攻撃は+60ダメージ。
    -   ためる (Charge): Lightning, Colorless 1個ずつで10ダメージ。2ターンスキップ。3ターン目に＋150ダメージ。
-   **弱点**: Darkness ×2
-   **抵抗力**: Fighting -20
-   **にげるコスト**: Colorless 1個
-   **画像アセット**: `assets/Haiirohitori.webp`

#### Tateha Butterfly (タテハチョウ)
-   **タイプ**: Fire
-   **HP**: 90
-   **技**:
    -   おどろかす (Startle): Water, Darkness, Fire 1個ずつで120ダメージ。相手は次の2ターンをとばす。
    -   かくれる (Hide): Darkness 1個で30ダメージ
-   **弱点**: Grass ×2
-   **抵抗力**: Fighting -20
-   **にげるコスト**: Colorless 2個
-   **画像アセット**: `assets/Tateha.webp`

#### Caterpillar exz (毛虫exz)
-   **タイプ**: Fighting
-   **HP**: 200
-   **技**:
    -   かみなり (Thunderbolt): Lightning, Psychic, Darkness, Fire 1個ずつで200ダメージ。相手の攻撃をむこう。
    -   どくばり (Poison Sting): Colorless 1個で120ダメージ
-   **弱点**: Water ×2
-   **抵抗力**: なし
-   **にげるコスト**: Colorless 2個
-   **画像アセット**: `assets/Kemushi_exz.webp`

#### Taiwan Clouded Yellow (タイワンキチョウ)
-   **タイプ**: Water
-   **HP**: 90
-   **技**:
    -   ちょうのむれ (Butterfly Swarm): Grass 2個で60ダメージ。自分の攻撃に＋100ダメージ。
    -   ジャンプ (Jump): Psychic, Darkness, Fire 1個ずつで30ダメージ
-   **弱点**: Lightning ×2
-   **抵抗力**: Fighting -20
-   **にげるコスト**: Colorless 1個
-   **画像アセット**: `assets/Taiwan_Clouded_Yellow.webp`

#### Kurohime Crane Fly (クロヒメガガンボモドキ)
-   **タイプ**: Colorless
-   **HP**: 110
-   **技**:
    -   まもる (Guard): Psychic 1個で0ダメージ。相手の攻撃を20小さくする。
    -   ジャンプ (Jump): Grass 1個で10ダメージ
-   **弱点**: Psychic ×2
-   **抵抗力**: Grass -20
-   **にげるコスト**: Colorless 1個
-   **画像アセット**: `assets/Kurohime_Ganbo.webp`

#### Snail (カタツムリ)
-   **タイプ**: Fire
-   **HP**: 80
-   **技**:
    -   まもる (Guard): Grass 2個で0ダメージ。相手の攻撃をむこう。
    -   たいあたり (Tackle): Colorless 2個で60ダメージ
-   **弱点**: Water ×2
-   **抵抗力**: なし
-   **にげるコスト**: Colorless 1個
-   **画像アセット**: `assets/Snail.webp`

#### Bee ex (ミツバチex)
-   **タイプ**: Darkness
-   **HP**: 190
-   **技**:
    -   蜜をすう (Nectar Sip): Water 2個, Colorless 1個で100ダメージ。ぜん回ふくし、＋30ダメージ。
    -   どくスプレー (Poison Spray): Darkness 1個で90ダメージ
-   **弱点**: Fire ×2
-   **抵抗力**: Grass -20
-   **にげるコスト**: Colorless 2個
-   **画像アセット**: `assets/Bee_ex.webp`

#### Hosohari Stinkbug ex (ホソヘリカメムシex)
-   **タイプ**: Water
-   **HP**: 180
-   **技**:
    -   ステルスアタック (Stealth Attack): Fire, Darkness, Colorless 1個ずつで120ダメージ。相手の攻撃を0にし、＋70ダメージ。
    -   におい (Stink): Colorless 1個で0ダメージ。相手のHPを0にする。
-   **弱点**: Lightning ×2
-   **抵抗力**: Fighting -20
-   **にげるコスト**: Colorless 1個
-   **画像アセット**: `assets/Hosohari_Stinkbug_ex.webp`

#### Aokanabun (アオカナブン)
-   **タイプ**: Metal
-   **HP**: 180
-   **技**:
    -   まもる (Guard): Grass, Colorless 1個ずつで10ダメージ。相手の攻撃を0にする。
    -   ためる (Charge): Fire, Darkness, Psychic, Colorless 1個ずつで150ダメージ
-   **弱点**: Fire ×2
-   **抵抗力**: Grass -20
-   **にげるコスト**: Colorless 2個
-   **画像アセット**: `assets/Aokanabun.webp`

#### Tonosama Grasshopper (トノサマバッタ)
-   **タイプ**: Lightning
-   **HP**: 130
-   **技**:
    -   とびさる (Fly Away): Lightning, Psychic, Darkness 1個ずつで100ダメージ
    -   キック (Kick): Lightning 1個で30ダメージ
-   **弱点**: Fighting ×2
-   **抵抗力**: Metal -20
-   **にげるコスト**: Colorless 1個
-   **画像アセット**: `assets/Tonosama_Batta.webp`

#### Rainbow Skink (ニホントカゲ（レインボー）)
-   **タイプ**: Metal
-   **HP**: 170
-   **技**:
    -   かくれる (Hide): Psychic, Colorless 1個ずつで100ダメージ。相手の次の攻撃は0ダメージ。
-   **弱点**: Fighting ×2
-   **抵抗力**: Grass -20
-   **にげるコスト**: Colorless 1個
-   **画像アセット**: `assets/Rainbow_Skink.webp`

#### Longhorn Beetle (カミキリムシ)
-   **タイプ**: Darkness
-   **HP**: 70
-   **技**:
    -   みをたべる (Eat Fruit): Water 1個で40ダメージ。このワザは＋30ダメージ。
-   **弱点**: Fire ×2
-   **抵抗力**: Grass -20
-   **にげるコスト**: Colorless 1個
-   **画像アセット**: `assets/Longhorn_Beetle.webp`

---

## 基本エネルギーカード

### 共通プロパティ

-   `card_type`: カードの種類（例: "Basic Energy"）
-   `name_en`: 英語名
-   `name_ja`: 日本語名
-   `energy_type`: エネルギーのタイプ（例: "Colorless", "Grass", "Fire" など）
-   `effect_en`: 英語効果
-   `effect_ja`: 日本語効果
-   `rules_en`: 英語ルールテキスト
-   `rules_ja`: 日本語ルールテキスト
-   `image`: 関連する画像アセットのパス（現状は空ですが、`assets/` フォルダ内の画像と関連付けられます）

### 基本エネルギーカード一覧

#### Colorless Energy (無色 エネルギー)
-   **タイプ**: Colorless
-   **効果**: Colorlessのエネルギーを1個ぶん供給する。
-   **ルール**: カードの効果がないかぎり、手札から1ターンに1枚だけエネルギーをつけられる。
-   **画像アセット**: `assets/Energy_Colorless.webp`

#### Grass Energy (くさ エネルギー)
-   **タイプ**: Grass
-   **効果**: Grassのエネルギーを1個ぶん供給する。
-   **ルール**: カードの効果がないかぎり、手札から1ターンに1枚だけエネルギーをつけられる。
-   **画像アセット**: `assets/Energy_Grass.webp`

#### Fire Energy (ほのお エネルギー)
-   **タイプ**: Fire
-   **効果**: Fireのエネルギーを1個ぶん供給する。
-   **ルール**: カードの効果がないかぎり、手札から1ターンに1枚だけエネルギーをつけられる。
-   **画像アセット**: `assets/Energy_Fire.webp`

#### Water Energy (みず エネルギー)
-   **タイプ**: Water
-   **効果**: Waterのエネルギーを1個ぶん供給する。
-   **ルール**: カードの効果がないかぎり、手札から1ターンに1枚だけエネルギーをつけられる。
-   **画像アセット**: `assets/Energy_Water.webp`

#### Lightning Energy (でんき エネルギー)
-   **タイプ**: Lightning
-   **効果**: Lightningのエネルギーを1個ぶん供給する。
-   **ルール**: カードの効果がないかぎり、手札から1ターンに1枚だけエネルギーをつけられる。
-   **画像アセット**: `assets/Energy_Lightning.webp`

#### Psychic Energy (エスパー エネルギー)
-   **タイプ**: Psychic
-   **効果**: Psychicのエネルギーを1個ぶん供給する。
-   **ルール**: カードの効果がないかぎり、手札から1ターンに1枚だけエネルギーをつけられる。
-   **画像アセット**: `assets/Energy_Psychic.webp`

#### Fighting Energy (かくとう エネルギー)
-   **タイプ**: Fighting
-   **効果**: Fightingのエネルギーを1個ぶん供給する。
-   **ルール**: カードの効果がないかぎり、手札から1ターンに1枚だけエネルギーをつけられる。
-   **画像アセット**: `assets/Energy_Fighting.webp`

#### Darkness Energy (あく エネルギー)
-   **タイプ**: Darkness
-   **効果**: Darknessのエネルギーを1個ぶん供給する。
-   **ルール**: カードの効果がないかぎり、手札から1ターンに1枚だけエネルギーをつけられる。
-   **画像アセット**: `assets/Energy_Darkness.webp`

#### Metal Energy (はがね エネルギー)
-   **タイプ**: Metal
-   **効果**: Metalのエネルギーを1個ぶん供給する。
-   **ルール**: カードの効果がないかぎり、手札から1ターンに1枚だけエネルギーをつけられる。
-   **画像アセット**: `assets/Energy_Metal.webp`
