/**
 * DEBUG-SYSTEM.JS - CPU手札 vs プレイマット専用デバッグシステム
 */

export class DebugSystem {
    constructor() {
        this.isEnabled = false;
        this.logLevel = 'INFO';
    }

    /**
     * デバッグモードを有効化
     */
    enable(logLevel = 'INFO') {
        this.isEnabled = true;
        this.logLevel = logLevel;
        this.log('INFO', '🔧 CPU手札 vs プレイマット専用デバッグ開始');
        
        // 定期測定開始
        this.startPeriodicMeasurement();
    }

    /**
     * デバッグモードを無効化
     */
    disable() {
        this.isEnabled = false;
        this.stopPeriodicMeasurement();
        this.log('INFO', '🔧 デバッグ終了');
    }

    /**
     * ログ出力
     */
    log(level, message, data = null) {
        if (!this.isEnabled) return;
        
        const timestamp = new Date().toISOString().substr(11, 8);
        const prefix = `[${timestamp}] ${level}`;
        
        if (data) {
            console.log(`${prefix} ${message}`, data);
        } else {
            console.log(`${prefix} ${message}`);
        }
    }

    /**
     * CPU手札とプレイマットプレースホルダーの専用測定
     */
    measureAll() {
        this.log('INFO', '🎯 === CPU手札 & プレースホルダー測定 ===');
        
        this.measureCpuHandSpecs();
        this.testPlayerPlaceholderClicks();
        
        this.log('INFO', '🎯 === 測定完了 ===');
    }

    /**
     * プレースホルダーの詳細スペック分析
     */
    testPlayerPlaceholderClicks() {
        this.log('INFO', '🔍 === プレースホルダー詳細スペック分析 ===');
        
        // 全プレースホルダーを取得
        const allSlots = document.querySelectorAll('#game-board .card-slot');
        this.log('INFO', `📊 総プレースホルダー数: ${allSlots.length}`);
        
        const specs = [];
        
        allSlots.forEach((slot, index) => {
            const rect = slot.getBoundingClientRect();
            const styles = window.getComputedStyle(slot);
            const classes = Array.from(slot.classList);
            const dataZone = slot.getAttribute('data-zone') || 'unknown';
            const parentBoard = slot.closest('.player-board');
            const boardType = parentBoard ? (parentBoard.classList.contains('player-self') ? 'player' : 'cpu') : 'shared';
            
            const spec = {
                index,
                name: classes.find(c => c !== 'card-slot') || 'unnamed',
                zone: dataZone,
                board: boardType,
                position: {
                    x: Math.round(rect.left),
                    y: Math.round(rect.top),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height)
                },
                depth: {
                    zIndex: styles.zIndex,
                    transform: styles.transform,
                    transformStyle: styles.transformStyle
                },
                interaction: {
                    pointerEvents: styles.pointerEvents,
                    cursor: styles.cursor,
                    visibility: styles.visibility,
                    opacity: styles.opacity
                },
                classes: classes
            };
            
            specs.push(spec);
        });
        
        // カテゴリ別に整理
        const categories = {
            player_active: specs.filter(s => s.board === 'player' && s.name.includes('active')),
            player_bench: specs.filter(s => s.board === 'player' && s.name.includes('bench')),
            player_side: specs.filter(s => s.board === 'player' && s.name.includes('side')),
            player_deck: specs.filter(s => s.board === 'player' && (s.name.includes('deck') || s.name.includes('trash'))),
            cpu_active: specs.filter(s => s.board === 'cpu' && s.name.includes('active')),
            cpu_bench: specs.filter(s => s.board === 'cpu' && s.name.includes('bench')),
            cpu_side: specs.filter(s => s.board === 'cpu' && s.name.includes('side')),
            cpu_deck: specs.filter(s => s.board === 'cpu' && (s.name.includes('deck') || s.name.includes('trash'))),
            shared: specs.filter(s => s.board === 'shared')
        };
        
        // カテゴリ別に詳細出力
        Object.entries(categories).forEach(([category, items]) => {
            if (items.length > 0) {
                this.log('INFO', `📍 ${category.toUpperCase()}: ${items.length}個`);
                items.forEach(item => {
                    this.log('INFO', `  ${item.name}:`);
                    this.log('INFO', `    位置: (${item.position.x}, ${item.position.y}) ${item.position.width}×${item.position.height}px`);
                    this.log('INFO', `    Z-Index: ${item.depth.zIndex}, Transform: ${item.depth.transform.substring(0, 50)}${item.depth.transform.length > 50 ? '...' : ''}`);
                    this.log('INFO', `    インタラクション: pointer=${item.interaction.pointerEvents}, cursor=${item.interaction.cursor}`);
                });
            }
        });
        
        // JSONデータとの比較
        this.analyzeJsonCoordinates();
        
        this.log('INFO', '🎯 === 分析完了 ===');
    }

    /**
     * JSON座標データの分析
     */
    async analyzeJsonCoordinates() {
        try {
            const response = await fetch('./assets/playmat/playmat_slots_named.json');
            const data = await response.json();
            
            this.log('INFO', '📋 === JSON座標データ分析 ===');
            this.log('INFO', `プレイマットサイズ: ${data.image_size.width}×${data.image_size.height}px`);
            this.log('INFO', `カード標準サイズ: ${data.card_median_size.width}×${data.card_median_size.height}px`);
            this.log('INFO', `総スロット数: ${data.slots_named.length}`);
            
            // 座標データをカテゴリ別に分類
            const jsonCategories = {
                bottom_bench: data.slots_named.filter(s => s.name.startsWith('bottom_bench')),
                top_bench: data.slots_named.filter(s => s.name.startsWith('top_bench')),
                active: data.slots_named.filter(s => s.name.includes('active')),
                side_left: data.slots_named.filter(s => s.name.startsWith('side_left')),
                side_right: data.slots_named.filter(s => s.name.startsWith('side_right')),
                deck_trash: data.slots_named.filter(s => s.name.includes('deck') || s.name.includes('trash')),
                stadium: data.slots_named.filter(s => s.name === 'stadium')
            };
            
            Object.entries(jsonCategories).forEach(([category, items]) => {
                if (items.length > 0) {
                    this.log('INFO', `🗺️ ${category.toUpperCase()}: ${items.length}個`);
                    items.forEach(item => {
                        this.log('INFO', `  ${item.name}:`);
                        this.log('INFO', `    JSONサイズ: ${item.size.width}×${item.size.height}px`);
                        this.log('INFO', `    JSON座標: (${item.bbox.x_min}, ${item.bbox.y_min}) - (${item.bbox.x_max}, ${item.bbox.y_max})`);
                        this.log('INFO', `    中心点: (${item.center.x}, ${item.center.y})`);
                        this.log('INFO', `    アスペクト比: ${item.aspect_ratio_h_over_w.toFixed(3)}`);
                    });
                }
            });
            
        } catch (error) {
            this.log('INFO', '⚠️ JSON座標データの読み込みに失敗');
        }
    }

    /**
     * CPU手札スペック測定
     */
    measureCpuHandSpecs() {
        this.log('INFO', '🤖 CPU手札スペック:');
        
        // CPU手札エリア
        const cpuHandArea = document.querySelector('#cpu-hand-area');
        if (cpuHandArea) {
            const rect = cpuHandArea.getBoundingClientRect();
            const styles = getComputedStyle(cpuHandArea);
            this.log('INFO', `  エリア: ${rect.width.toFixed(1)}×${rect.height.toFixed(1)}px @(${rect.left.toFixed(1)}, ${rect.top.toFixed(1)}) z:${styles.zIndex}`);
        }
        
        // CPU手札コンテナ
        const cpuHand = document.querySelector('#cpu-hand');
        if (cpuHand) {
            const rect = cpuHand.getBoundingClientRect();
            const styles = getComputedStyle(cpuHand);
            this.log('INFO', `  コンテナ: ${rect.width.toFixed(1)}×${rect.height.toFixed(1)}px transform:${styles.transform} z:${styles.zIndex}`);
        }
        
        // CPU手札スロット - 動的生成されたhand-slotを検索
        const cpuHandSlots = document.querySelectorAll('#cpu-hand .hand-slot');
        
        this.log('INFO', `  動的スロット数: ${cpuHandSlots.length}`);
        
        // HTMLソースを直接確認
        const cpuHandElement = document.querySelector('#cpu-hand');
        if (cpuHandElement) {
            this.log('INFO', `  HTML内容: ${cpuHandElement.innerHTML.substr(0, 200)}...`);
        }
        
        // 各スロット詳細
        cpuHandSlots.forEach((slot, i) => {
            const rect = slot.getBoundingClientRect();
            const styles = getComputedStyle(slot);
            this.log('INFO', `    [${i}]: ${rect.width.toFixed(1)}×${rect.height.toFixed(1)}px display:${styles.display} visible:${rect.width > 0 && rect.height > 0}`);
        });
    }
    
    /**
     * プレイマットプレースホルダースペック測定
     */
    // measurePlaymatPlaceholderSpecs関数を削除 - testPlayerPlaceholderClicksに統合

    /**
     * 定期測定の開始
     */
    startPeriodicMeasurement() {
        // 初回測定
        setTimeout(() => this.measureAll(), 2000);
        
        // 20秒間隔で測定（ログ削減）
        this.measurementInterval = setInterval(() => {
            this.measureAll();
        }, 20000);
    }

    /**
     * 定期測定の停止
     */
    stopPeriodicMeasurement() {
        if (this.measurementInterval) {
            clearInterval(this.measurementInterval);
            this.measurementInterval = null;
        }
    }
}

// シングルトンインスタンス
export const debugSystem = new DebugSystem();