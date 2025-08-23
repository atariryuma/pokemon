/**
 * BATTLE-NARRATOR.JS - バトル実況システム
 * 
 * プレイヤーとCPUの行動をポケモンカードゲームらしく実況風に表現
 * 右パネル下部の専用エリアに表示し、ゲーム体験を向上させる
 */

export class BattleNarrator {
    constructor() {
        this.messages = []; // 実況メッセージのログ
        this.maxMessages = 5; // 表示する最大メッセージ数
        this.containerElement = null; // DOM要素（遅延初期化）
    }

    /**
     * DOM要素を初期化
     */
    init() {
        this.containerElement = document.getElementById('battle-commentary');
        if (!this.containerElement) {
            console.warn('🎤 Battle commentary container not found');
            return false;
        }
        return true;
    }

    /**
     * 実況メッセージを追加
     * @param {string} message - 実況メッセージ
     * @param {string} type - メッセージタイプ ('player', 'cpu', 'system', 'battle')
     */
    addMessage(message, type = 'system') {
        const timestamp = new Date().getTime();
        const messageObj = {
            text: message,
            type: type,
            timestamp: timestamp,
            id: `msg_${timestamp}_${Math.random().toString(36).substr(2, 9)}`
        };

        // 新しいメッセージを先頭に追加
        this.messages.unshift(messageObj);
        
        // 最大数を超えた場合は古いメッセージを削除
        if (this.messages.length > this.maxMessages) {
            this.messages = this.messages.slice(0, this.maxMessages);
        }

        // DOM更新
        this.updateDisplay();

        console.log(`🎤 [${type.toUpperCase()}] ${message}`);
    }

    /**
     * プレイヤーの行動を実況
     */
    narratePlayerAction(action, details = {}) {
        let message = '';
        
        switch (action) {
            case 'attach_energy':
                message = `${details.pokemon || 'ポケモン'}に${details.energyType || 'エネルギー'}を付けた！`;
                break;
            case 'evolve':
                message = `${details.from || 'ポケモン'}を${details.to || 'ポケモン'}に進化させた！`;
                break;
            case 'attack':
                const damage = details.damage ? `${details.damage}ダメージ！` : '';
                message = `わざ『${details.attackName || 'こうげき'}』で攻撃！${damage}`;
                break;
            case 'retreat':
                message = `${details.pokemon || 'ポケモン'}をベンチに逃がした`;
                break;
            case 'use_trainer':
                message = `トレーナーズ『${details.trainerName || 'カード'}』を使った`;
                break;
            case 'switch_pokemon':
                message = `${details.pokemon || 'ポケモン'}をバトル場に出した！`;
                break;
            case 'draw_card':
                const count = details.count > 1 ? `${details.count}枚` : '1枚';
                message = `山札から${count}引いた`;
                break;
            case 'take_prize':
                message = `サイドカードを${details.count || 1}枚とった！`;
                break;
            case 'ko_pokemon':
                message = `${details.pokemon || 'ポケモン'}がきぜつした！`;
                break;
            default:
                message = `${action}を行った`;
        }

        this.addMessage(message, 'player');
    }

    /**
     * CPUの行動を実況
     */
    narrateCpuAction(action, details = {}) {
        let message = '';
        
        switch (action) {
            case 'attach_energy':
                message = `相手は${details.pokemon || 'ポケモン'}に${details.energyType || 'エネルギー'}を付けた！`;
                break;
            case 'evolve':
                message = `相手は${details.from || 'ポケモン'}を${details.to || 'ポケモン'}に進化させた！`;
                break;
            case 'attack':
                const damage = details.damage ? `${details.damage}ダメージ！` : '';
                message = `相手の${details.pokemon || 'ポケモン'}が『${details.attackName || 'こうげき'}』で攻撃してきた！${damage}`;
                break;
            case 'retreat':
                message = `相手は${details.pokemon || 'ポケモン'}をベンチに下げた`;
                break;
            case 'use_trainer':
                message = `相手はトレーナーズを使った`;
                break;
            case 'switch_pokemon':
                message = `相手は${details.pokemon || 'ポケモン'}をバトル場に出した！`;
                break;
            case 'draw_card':
                const count = details.count > 1 ? `${details.count}枚` : '1枚';
                message = `相手は山札から${count}引いた`;
                break;
            case 'take_prize':
                message = `相手はサイドカードを${details.count || 1}枚とった！`;
                break;
            case 'thinking':
                message = `相手は次の行動を考えている...`;
                break;
            case 'ko_pokemon':
                message = `相手の${details.pokemon || 'ポケモン'}がきぜつした！`;
                break;
            default:
                message = `相手は${action}を行った`;
        }

        this.addMessage(message, 'cpu');
    }

    /**
     * バトル結果を実況
     */
    narrateBattleResult(result, details = {}) {
        let message = '';
        
        switch (result) {
            case 'damage':
                message = `${details.defender || 'ポケモン'}に${details.damage || 0}ダメージ！`;
                break;
            case 'weakness':
                message = `弱点で威力2倍！${details.damage || 0}ダメージ！`;
                break;
            case 'resistance':
                message = `抵抗力で${details.reduction || 20}ダメージ軽減！`;
                break;
            case 'ko':
                message = `${details.pokemon || 'ポケモン'}はきぜつした！`;
                break;
            case 'status_poison':
                message = `${details.pokemon || 'ポケモン'}は『どく』状態になった！`;
                break;
            case 'status_burn':
                message = `${details.pokemon || 'ポケモン'}は『やけど』状態になった！`;
                break;
            case 'status_sleep':
                message = `${details.pokemon || 'ポケモン'}は『ねむり』状態になった！`;
                break;
            case 'status_paralysis':
                message = `${details.pokemon || 'ポケモン'}は『マヒ』状態になった！`;
                break;
            case 'heal':
                message = `${details.pokemon || 'ポケモン'}のHPが${details.amount || 0}回復した！`;
                break;
            case 'no_effect':
                message = `効果がない...`;
                break;
            default:
                message = result;
        }

        this.addMessage(message, 'battle');
    }

    /**
     * システムメッセージを実況
     */
    narrateSystemMessage(message, details = {}) {
        this.addMessage(message, 'system');
    }

    /**
     * ターン開始の実況
     */
    narrateTurnStart(player) {
        const message = player === 'player' ? 
            'あなたのターンです！' : 
            '相手のターンです！';
        this.addMessage(message, 'system');
    }

    /**
     * フェーズ変更の実況
     */
    narratePhaseChange(phase) {
        const phaseNames = {
            'setup': 'セットアップフェーズ',
            'draw': 'ドローフェーズ', 
            'main': 'メインフェーズ',
            'attack': 'アタックフェーズ',
            'end': 'エンドフェーズ'
        };
        
        const phaseName = phaseNames[phase] || phase;
        this.addMessage(`${phaseName}になりました`, 'system');
    }

    /**
     * DOM表示を更新
     */
    updateDisplay() {
        if (!this.containerElement) {
            if (!this.init()) return; // 初期化失敗
        }

        const html = this.messages.map(msg => {
            const typeClass = this.getTypeClass(msg.type);
            const icon = this.getTypeIcon(msg.type);
            
            return `
                <div class="commentary-message ${typeClass}" data-message-id="${msg.id}">
                    <span class="commentary-icon">${icon}</span>
                    <span class="commentary-text">${msg.text}</span>
                </div>
            `;
        }).join('');

        this.containerElement.innerHTML = html;
    }

    /**
     * メッセージタイプに対応するCSSクラスを取得
     */
    getTypeClass(type) {
        const classes = {
            'player': 'commentary-player',
            'cpu': 'commentary-cpu', 
            'battle': 'commentary-battle',
            'system': 'commentary-system'
        };
        return classes[type] || 'commentary-default';
    }

    /**
     * メッセージタイプに対応するアイコンを取得
     */
    getTypeIcon(type) {
        const icons = {
            'player': '⚡',    // プレイヤーアクション
            'cpu': '🤖',       // CPUアクション
            'battle': '💥',    // バトル結果
            'system': '🎮'     // システムメッセージ
        };
        return icons[type] || '📣';
    }

    /**
     * メッセージを全てクリア
     */
    clear() {
        this.messages = [];
        this.updateDisplay();
    }

    /**
     * ゲーム開始時の初期メッセージ
     */
    narrateGameStart() {
        this.clear();
        this.addMessage('ポケモンカードバトル開始！', 'system');
    }

    /**
     * ゲーム終了時のメッセージ
     */
    narrateGameEnd(winner) {
        const message = winner === 'player' ? 
            'あなたの勝利です！おめでとうございます！' :
            '相手の勝利です！次回頑張りましょう！';
        this.addMessage(message, 'system');
    }
}

// シングルトンインスタンスをエクスポート
export const battleNarrator = new BattleNarrator();