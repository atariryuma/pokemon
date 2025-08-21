# アニメーション計画書

## 1. 基本方針

ゲームの操作感と没入感を高めるため、CSSトランジションとCSSアニメーションを主体としたアニメーションを実装する。JavaScriptは、アニメーションを起動するためのCSSクラスの付け外しにのみ使用し、ロジックと描画の分離を維持する。

## 2. アニメーション一覧

| イベント | アニメーション内容 | 実装方法 (CSS) |
| :--- | :--- | :--- |
| **ゲーム開始** | 山札から各プレイヤーの手札へカードが配られる。 | `transform: translate`, `opacity` を使用。各カードに `transition-delay` を設定し、連続して配られるように見せる。 |
| **カードを引く** | 山札からカードが1枚、手札にスライドして入る。 | `transform: translate` |
| **カードを出す** | 手札から場のポケモンが、ベンチまたはバトル場にスライドして置かれる。 | `transform: translate` |
| **エネルギーを付ける** | 手札からエネルギーが、対象のポケモンにスライドし、少し小さくなって収まる。 | `transform: translate scale(0.8)` |
| **攻撃** | 攻撃側のポケモンが少し前に出て、元の位置に戻る。 | `transform: translateY(-20px)` を適用するクラスを短時間付け、`transition`で動かす。 |
| **ダメージを受ける** | 防御側のポケモンが左右に小刻みに揺れる。HPテキストが赤く点滅する。 | `animation` (keyframesで振動を定義), `animation` (keyframesで色の点滅を定義) |
| **きぜつ** | ポケモンカードがグレースケールになり、少し透明になってからトラッシュ置き場へスライドする。 | `filter: grayscale(1)`, `opacity`, `transform: translate` |
| **カードの選択** | クリックして選択されたカードが少し上に持ち上がる、または枠が光る。 | `transform: translateY(-10px)`, `box-shadow` |
| **カードが裏返る** | カードがY軸を中心に180度回転する。 | `transform: rotateY(180deg)`, `backface-visibility: hidden` を使用して、回転中の裏面描画を制御する。 |

## 3. 実装手順

1.  汎用的なアニメーション用CSSクラス（例: `.slide-to-hand`, `.shake`, `.fade-out`）を `style.css` に定義する。
2.  `view.js` 内で、特定のアクションが完了した直後に、対象のDOM要素にこれらのクラスを付与する。
3.  `transitionend` または `animationend` イベントをJavaScriptで待ち受け、アニメーション完了後にクラスを削除し、DOMの状態を最終的なものに更新する。
