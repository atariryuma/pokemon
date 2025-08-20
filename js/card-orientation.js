/**
 * CARD-ORIENTATION.JS - カード向き制御統一システム
 * 
 * プレイヤー・CPU カードの向き制御を統一管理
 * 重複コードの削除と向き判定の一元化
 * 
 * === 責任分担 ===
 * - view.js の _createCardElement(): 初期カード作成時に向きを設定（メイン責任）
 * - animations.js の flipCardFaceUp(): カードフリップ時の向き制御（特殊ケース）
 * - unified-animations.js の createAnimationCard(): アニメーション用クローンの向き制御
 * - 統一カード配布アニメーション: 向き設定しない（二重適用防止）
 * 
 * === ゾーン別ルール ===
 * - hand: CPU/Player問わず回転なし
 * - deck/active/bench/prize/discard: CPUのみ180度回転、Playerは回転なし
 */

/**
 * カード向き制御の統一管理クラス
 */
export class CardOrientationManager {
  /**
   * カードの向き情報を統一的に取得
   * @param {string} playerId - プレイヤーID ('player' | 'cpu')
   * @param {string} zone - ゾーン情報 ('hand' | 'deck' | 'active' | 'bench' | 'prize' | 'discard' | 'stadium')
   * @param {Element} element - カード要素 (オプション、フォールバック用)
   * @returns {Object} 向き制御情報
   */
  static getCardOrientation(playerId, zone = null, element = null) {
    // プレイヤーIDを最優先で判定
    let isCpu = (playerId === 'cpu');
    
    // playerId が null/undefined の場合のみ要素から判定
    if (playerId === null || playerId === undefined) {
      isCpu = element?.closest('.opponent-board');
      console.log(`🔍 getCardOrientation: playerId was null, detected from DOM: isCpu=${isCpu}`);
    }
    
    // ゾーン別の向き制御ルール
    let shouldRotate = false;
    if (isCpu) {
      // CPUの場合: 手札は回転なし、プレイマット系は180度回転
      shouldRotate = zone !== 'hand' && zone !== 'modal';
    }
    
    // 詳細デバッグログ
    console.log(`🎯 getCardOrientation: playerId="${playerId}", zone="${zone}", isCpu=${isCpu}, shouldRotate=${shouldRotate}`);
    
    return {
      isCpu,
      playerId: isCpu ? 'cpu' : 'player',
      zone: zone,
      shouldRotate: shouldRotate,
      transform: shouldRotate ? 'rotateX(180deg)' : '',
      baseClass: isCpu ? 'cpu-card' : 'player-card',
      playerSelector: isCpu ? '.opponent-board' : '.player-self',
      handSelector: isCpu ? '#cpu-hand' : '#player-hand'
    };
  }

  /**
   * カード要素に適切な向きを適用
   * @param {Element} cardElement - カード要素
   * @param {string} playerId - プレイヤーID
   * @param {string} zone - ゾーン情報
   * @param {boolean} force - 強制適用フラグ
   */
  static applyCardOrientation(cardElement, playerId, zone = null, force = false) {
    if (!cardElement) return;

    const imgElement = cardElement.querySelector('img');
    const orientation = this.getCardOrientation(playerId, zone, cardElement);
    
    console.log(`🎯 CardOrientation detected: playerId=${playerId}, zone=${zone}, isCpu=${orientation.isCpu}, shouldRotate=${orientation.shouldRotate}, transform=${orientation.transform}, hasImg=${!!imgElement}`);
    
    // shouldRotateフラグまたは強制適用の場合のみ回転を適用
    if (orientation.shouldRotate || force) {
      cardElement.classList.add('cpu-card');
      cardElement.classList.remove('player-card');
      console.log(`✅ Applied card rotation: CSS .cpu-card class (zone: ${zone}) ${imgElement ? 'with img' : 'placeholder only'}`);
    } else {
      if (orientation.isCpu) {
        // CPU手札など回転しないCPUカード
        cardElement.classList.add('cpu-card-no-rotate');
        cardElement.classList.remove('player-card', 'cpu-card');
        console.log(`✅ Applied CPU card (no rotation): CSS .cpu-card-no-rotate class (zone: ${zone}) ${imgElement ? 'with img' : 'placeholder only'}`);
      } else {
        cardElement.classList.add('player-card');
        cardElement.classList.remove('cpu-card', 'cpu-card-no-rotate');
        console.log(`✅ Applied player card orientation: CSS .player-card class (zone: ${zone}) ${imgElement ? 'with img' : 'placeholder only'}`);
      }
    }
  }

  /**
   * 複数カードに一括で向きを適用
   * @param {Array<Element>} cardElements - カード要素配列
   * @param {string} playerId - プレイヤーID
   * @param {string} zone - ゾーン情報
   */
  static applyBatchCardOrientation(cardElements, playerId, zone = null) {
    cardElements.forEach(element => {
      this.applyCardOrientation(element, playerId, zone);
    });
  }

  /**
   * アニメーション後の向き確定処理
   * @param {Element} cardElement - カード要素
   * @param {string} playerId - プレイヤーID
   * @param {string} zone - ゾーン情報
   */
  static finalizeCardOrientation(cardElement, playerId, zone = null) {
    if (!cardElement) return;

    const imgElement = cardElement.querySelector('img');
    if (!imgElement) return;

    const orientation = this.getCardOrientation(playerId, zone, cardElement);

    // トランジションを削除してから最終的な向きを設定
    imgElement.style.transition = '';
    imgElement.style.transform = orientation.transform;
  }
}

// デフォルトエクスポートも提供
export default CardOrientationManager;