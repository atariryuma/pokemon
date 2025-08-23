/**
 * BATTLE-STATUS.JS - バトル状況システム
 *
 * ユーザーに次の指示や現在の状況を簡潔に伝える
 * 右パネル下部の専用エリアに表示し、ゲーム体験を向上させる
 */

export class BattleStatus {
    constructor() {
        this.messages = []; // 状況メッセージのログ（常に1件）
        this.containerElement = null; // DOM要素（遅延初期化）
    }

    /**
     * DOM要素を初期化
     */
    init() {
        // 統合されたコンテナを優先的に取得
        this.containerElement = document.getElementById('unified-battle-status') ||
                               document.getElementById('battle-status');
        if (!this.containerElement) {
            console.warn('📢 Battle status container not found');
            return false;
        }
        console.log('📢 Battle status initialized with container:', this.containerElement.id);
        return true;
    }

    /**
     * 状況メッセージを更新
     * @param {string} message - 状況メッセージ
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

        // 常に最新の1件のみ保持
        this.messages = [messageObj];

        // DOM更新
        this.updateDisplay();

        console.log(`📢 [${type.toUpperCase()}] ${message}`);
    }

    /**
     * シンプルなシステムメッセージを追加
     * @param {string} message - 表示するメッセージ
     */
    announce(message) {
        this.addMessage(message, 'system');
    }

    /**
     * プレイヤーの行動を報告
     */
    narratePlayerAction(action, details = {}) {
        let message = '';
        
        switch (action) {
            case 'attach_energy':
                message = `${details.pokemon || 'ポケモン'}に${details.energyType || 'エネルギー'}を付けました。`;
                break;
            case 'evolve':
                message = `${details.from || 'ポケモン'}を${details.to || 'ポケモン'}に進化させました。`;
                break;
            case 'attack':
                const damage = details.damage ? `${details.damage}ダメージ。` : '';
                message = `わざ『${details.attackName || 'こうげき'}』で攻撃しました。${damage}`;
                break;
            case 'retreat':
                message = `${details.pokemon || 'ポケモン'}をベンチに逃がしました。`;
                break;
            case 'use_trainer':
                message = `トレーナーズ『${details.trainerName || 'カード'}』を使いました。`;
                break;
            case 'switch_pokemon':
                message = `${details.pokemon || 'ポケモン'}をバトル場に出しました。`;
                break;
            case 'draw_card':
                const count = details.count > 1 ? `${details.count}枚` : '1枚';
                message = `山札から${count}引きました。`;
                break;
            case 'take_prize':
                message = `サイドカードを${details.count || 1}枚取りました。`;
                break;
            case 'ko_pokemon':
                message = `${details.pokemon || 'ポケモン'}がきぜつしました。`;
                break;
            default:
                message = `${action}を行いました。`;
        }

        this.addMessage(message, 'player');
    }

    /**
     * CPUの行動を報告
     */
    narrateCpuAction(action, details = {}) {
        let message = '';
        
        switch (action) {
            case 'attach_energy':
                message = `相手は${details.pokemon || 'ポケモン'}に${details.energyType || 'エネルギー'}を付けました。`;
                break;
            case 'evolve':
                message = `相手は${details.from || 'ポケモン'}を${details.to || 'ポケモン'}に進化させました。`;
                break;
            case 'attack':
                const damage = details.damage ? `${details.damage}ダメージ。` : '';
                message = `相手の${details.pokemon || 'ポケモン'}が『${details.attackName || 'こうげき'}』で攻撃してきました。${damage}`;
                break;
            case 'retreat':
                message = `相手は${details.pokemon || 'ポケモン'}をベンチに下げました。`;
                break;
            case 'use_trainer':
                message = `相手はトレーナーズを使いました。`;
                break;
            case 'switch_pokemon':
                message = `相手は${details.pokemon || 'ポケモン'}をバトル場に出しました。`;
                break;
            case 'draw_card':
                const count = details.count > 1 ? `${details.count}枚` : '1枚';
                message = `相手は山札から${count}引きました。`;
                break;
            case 'take_prize':
                message = `相手はサイドカードを${details.count || 1}枚取りました。`;
                break;
            case 'thinking':
                message = `相手は次の行動を考えています。`;
                break;
            case 'ko_pokemon':
                message = `相手の${details.pokemon || 'ポケモン'}がきぜつしました。`;
                break;
            default:
                message = `相手は${action}を行いました。`;
        }

        this.addMessage(message, 'cpu');
    }

    /**
     * バトル結果を報告
     */
    narrateBattleResult(result, details = {}) {
        let message = '';
        
        switch (result) {
            case 'damage':
                message = `${details.defender || 'ポケモン'}に${details.damage || 0}ダメージ。`;
                break;
            case 'weakness':
                message = `弱点で威力2倍。${details.damage || 0}ダメージ。`;
                break;
            case 'resistance':
                message = `抵抗力で${details.reduction || 20}ダメージ軽減。`;
                break;
            case 'ko':
                message = `${details.pokemon || 'ポケモン'}はきぜつしました。`;
                break;
            case 'status_poison':
                message = `${details.pokemon || 'ポケモン'}は『どく』状態になりました。`;
                break;
            case 'status_burn':
                message = `${details.pokemon || 'ポケモン'}は『やけど』状態になりました。`;
                break;
            case 'status_sleep':
                message = `${details.pokemon || 'ポケモン'}は『ねむり』状態になりました。`;
                break;
            case 'status_paralysis':
                message = `${details.pokemon || 'ポケモン'}は『マヒ』状態になりました。`;
                break;
            case 'heal':
                message = `${details.pokemon || 'ポケモン'}のHPが${details.amount || 0}回復しました。`;
                break;
            case 'no_effect':
                message = `効果がありません。`;
                break;
            default:
                message = result;
        }

        this.addMessage(message, 'battle');
    }

    /**
     * システムメッセージを報告
     */
    narrateSystemMessage(message, details = {}) {
        this.addMessage(message, 'system');
    }

    /**
     * ゲーム進行メッセージを統合（青いトーストからのリダイレクト）
     * @param {string} message - ゲーム進行メッセージ
     * @param {object} context - 追加のコンテキスト情報
     */
    addGameProgressMessage(message, context = {}) {
        // 状況表示用に変換してから表示
        const narrativeMessage = this.convertToNarrativeMessage(message, context);
        this.addMessage(narrativeMessage, 'system');
    }

    /**
     * メッセージを状況表示用に変換
     * @param {string} message - 元のメッセージ
     * @param {object} context - コンテキスト情報
     * @returns {string} 変換されたメッセージ
     */
    convertToNarrativeMessage(message, context = {}) {
        // 状況メッセージ変換テーブル
        const narrativeMap = {
            '山札をクリックしてカードを引いてください。': (ctx) =>
                `ターン開始。山札から1枚ドローしてください${ctx.handCount ? `（手札: ${ctx.handCount}/10枚）` : ''}`,
            '山札をクリックしてカードを1枚ドローしてください。': (ctx) =>
                `ターン開始。山札から1枚ドローしてください${ctx.handCount ? `（手札: ${ctx.handCount}/10枚）` : ''}`,
            'あなたのターンです。アクションを選択してください。': () =>
                'メインフェーズに入りました。行動を選んでください',
            'あなたのターンです。行動を選んでください。': () =>
                'メインフェーズに入りました。行動を選んでください',
            '攻撃を実行中...': (ctx) =>
                `${ctx.pokemonName || 'ポケモン'}が『${ctx.attackName || 'わざ'}』で攻撃中...`,
            'ポケモン配置完了。サイドカードを配布しています...': () =>
                'セットアップ完了。サイドカード6枚を配布中...',
            '相手のターンです...': () =>
                '相手のターンが開始されました'
        };

        // 変換テーブルにあれば変換、なければそのまま
        if (narrativeMap[message]) {
            return narrativeMap[message](context);
        }

        // 部分マッチング変換
        if (message.includes('山札をクリック')) {
            return `ターン開始。山札から1枚ドローしてください${context.handCount ? `（手札: ${context.handCount}/10枚）` : ''}`;
        }
        if (message.includes('あなたのターン')) {
            return 'メインフェーズに入りました。行動を選んでください';
        }
        if (message.includes('攻撃を実行')) {
            return `${context.pokemonName || 'ポケモン'}が攻撃中です...`;
        }

        // 変換できない場合はそのまま返す
        return message;
    }

    /**
     * ターン開始の報告
     */
    narrateTurnStart(player) {
        const message = player === 'player' ?
            'あなたのターンです。' :
            '相手のターンです。';
        this.announce(message);
    }

    /**
     * フェーズ変更の報告
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
        this.addMessage('ポケモンカードバトルを開始します。', 'system');
    }

    /**
     * ゲーム終了時のメッセージ
     */
    narrateGameEnd(winner) {
        const message = winner === 'player' ?
            'あなたの勝利です。おめでとうございます。' :
            '相手の勝利です。次回頑張りましょう。';
        this.addMessage(message, 'system');
    }
}

// シングルトンインスタンスをエクスポート
export const battleStatus = new BattleStatus();