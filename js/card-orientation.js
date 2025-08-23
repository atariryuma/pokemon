/**
 * CARD-ORIENTATION.JS - 統一カード向き制御システム
 *
 * ルール:
 * - CPU: hand以外は180度回転
 * - CPU: handは未回転
 * - Player: すべて未回転
 * - プレースホルダーもルールに従う
 *
 * 実装指針:
 * - data-orientation属性によるCSS制御に完全統一
 * - プレースホルダーを含む全要素で統一管理
 */

/**
 * カード向き制御の統一管理クラス
 */
export class CardOrientationManager {
  /**
   * カードの向き判定（CPU側のhand以外は反転）
   * @param {string} playerId - プレイヤーID ('player' | 'cpu')
   * @param {string} zone - ゾーン情報
   * @param {Element} element - カード要素（プレースホルダー含む）
   * @returns {boolean} 反転が必要かどうか
   */
  static shouldFlipCard(playerId, zone = null, element = null) {
    // プレイヤー識別（要素からのフォールバック含む）
    const isCpu = (playerId === 'cpu') || (!!element?.closest?.('.opponent-board'));
    const normalizedZone = zone || element?.dataset?.zone || '';

    // CPU は hand と modal 以外を回転（プレースホルダー含む）
    return isCpu && normalizedZone !== 'hand' && normalizedZone !== 'modal';
  }

  /**
   * カード要素に適切な向きを適用（プレースホルダー含む）
   * @param {Element} cardElement - カード要素またはプレースホルダー
   * @param {string} playerId - プレイヤーID
   * @param {string} zone - ゾーン情報
   */
  static applyCardOrientation(cardElement, playerId, zone = null) {
    if (!cardElement) return;

    const shouldFlip = this.shouldFlipCard(playerId, zone, cardElement);
    // data-orientation属性でCSS制御を統一
    cardElement.dataset.orientation = shouldFlip ? 'flipped' : 'upright';
    
    // CSS競合対策：直接スタイル適用で確実な反転を保証
    const img = cardElement.querySelector && cardElement.querySelector('img');
    if (shouldFlip) {
      if (img) {
        img.style.transform = 'rotate(180deg) translateZ(0)';
        img.style.transformStyle = 'preserve-3d';
      } else {
        // 画像タグがない（背景画像やプレースホルダー）場合は要素自体を反転
        cardElement.style.transform = 'rotate(180deg) translateZ(0)';
        cardElement.style.transformStyle = 'preserve-3d';
      }
    } else {
      // 正位置に戻す（以前の反転をクリア）
      if (img) {
        img.style.transform = '';
        img.style.transformStyle = '';
      }
      cardElement.style.transform = '';
      cardElement.style.transformStyle = '';
    }
  }

  /**
   * 複数カードに一括で向きを適用
   * @param {Array<Element>} cardElements - カード要素配列
   * @param {string} playerId - プレイヤーID
   * @param {string} zone - ゾーン情報
   */
  static applyBatchCardOrientation(cardElements, playerId, zone = null) {
    if (!Array.isArray(cardElements)) return;
    cardElements.forEach(element => {
      this.applyCardOrientation(element, playerId, zone);
    });
  }
}

// デフォルトエクスポートも提供
export default CardOrientationManager;
