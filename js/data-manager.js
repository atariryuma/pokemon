/**
 * データ管理モジュール
 * カードデータの読み込み、画像パス管理、フォールバック機能を提供
 */

// カードデータ（JSONから動的読み込み）
let cardMasterList = [];

const noop = () => {};

/**
 * カードデータをJSONファイルから読み込む
 * @param {boolean} forceReload - キャッシュを無視して強制的に再読み込みするか
 * @returns {Promise<Array>} カードデータの配列
 */
export async function loadCardsFromJSON(forceReload = false) {
    try {
        const cacheParam = forceReload ? `?_t=${Date.now()}` : '';
        const response = await fetch(`./data/cards-master.json${cacheParam}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const rawData = await response.json();
        cardMasterList = normalizeCardData(rawData);
        
        // デバッグ: カードマスターリストの内容をチェック
        if (cardMasterList.length > 0) {
            console.log('🔍 First card loaded:', cardMasterList[0]);
            console.log('🔍 Card properties:', Object.keys(cardMasterList[0]));
            
            // 各カードタイプの数をチェック
            const pokemon = cardMasterList.filter(c => c.card_type === 'Pokémon');
            const basicEnergy = cardMasterList.filter(c => c.card_type === 'Basic Energy');
            const rawEnergy = cardMasterList.filter(c => c.card_type === 'Energy');
            const trainer = cardMasterList.filter(c => c.card_type === 'Trainer');
            
            console.log('🔍 Card counts - Pokémon:', pokemon.length, 'Basic Energy:', basicEnergy.length, 'Raw Energy:', rawEnergy.length, 'Trainer:', trainer.length);
            
            if (basicEnergy.length > 0) {
                console.log('🔍 First Basic Energy card:', basicEnergy[0]);
            }
            
            // name_enが欠けているカードをチェック
            const missingNameEn = cardMasterList.filter(c => !c.name_en);
            if (missingNameEn.length > 0) {
                console.warn('⚠️ Cards missing name_en:', missingNameEn.length);
                console.log('First missing name_en card:', missingNameEn[0]);
            }
        }
        
        noop(`📦 Loaded ${cardMasterList.length} cards from JSON${forceReload ? ' (forced reload)' : ''}`);
        return cardMasterList;
    } catch (error) {
        console.error('❌ Failed to load cards from JSON:', error);
        // フォールバック: 静的データ
        cardMasterList = getStaticFallbackData();
        noop(`🔄 Fallback: Using ${cardMasterList.length} static cards`);
        return cardMasterList;
    }
}

/**
 * 現在のカードリストを取得
 * @returns {Array} カードデータの配列
 */
export function getCardMasterList() {
    return cardMasterList;
}

/**
 * カードデータを強制的に再読み込み
 * @returns {Promise<Array>} 更新されたカードデータの配列
 */
export async function refreshCardData() {
    return await loadCardsFromJSON(true);
}

/**
 * ページフォーカス時のデータ更新チェック
 * エディタから戻ってきた時にデータを自動更新
 */
export function enableAutoRefresh() {
    let isHidden = false;
    
    // ページの表示状態が変わったときの処理
    const handleVisibilityChange = async () => {
        if (document.hidden) {
            isHidden = true;
        } else if (isHidden) {
            // ページが再度表示されたときにデータを更新
            isHidden = false;
            try {
                await refreshCardData();
                noop('🔄 Card data refreshed on page focus');
                // カスタムイベントを発火してUIに更新を通知
                window.dispatchEvent(new CustomEvent('cardDataUpdated', { 
                    detail: { cards: cardMasterList } 
                }));
            } catch (error) {
                console.error('❌ Failed to refresh card data:', error);
            }
        }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // フォーカス時にも更新チェック
    window.addEventListener('focus', async () => {
        if (isHidden) {
            await handleVisibilityChange();
        }
    });
}

/**
 * カード画像パスを取得
 * @param {string} cardNameEn - カードの英語名
 * @param {Object} card - カードオブジェクト（タイプ判定用）
 * @returns {string} 画像ファイルのパス
 */
export function getCardImagePath(cardNameEn, card = null) {
    // 引数の妥当性チェック
    if (!cardNameEn || typeof cardNameEn !== 'string') {
        console.warn('⚠️ getCardImagePath: invalid cardNameEn:', cardNameEn, 'card:', card);
        return 'assets/ui/card_back.webp'; // フォールバック画像
    }
    
    // デバッグ: カード情報をログに出力
    if (card && (!card.name_en || !card.card_type)) {
        console.warn('⚠️ Card missing properties:', {
            name_en: card.name_en,
            card_type: card.card_type,
            id: card.id,
            fullCard: card
        });
    }
    
    // 特別なカード名のマッピング（実際のファイル名に合わせて修正）
    const specialNames = {
        "Glasswing Butterfly Larva": "Glasswing_Butterfly_Larva",
        "Cat exv": "Cat_exv",
        "Grey Dagger Moth Larva": "Grey_Dagger_Moth_Larva",
        "Short-horned Grasshopper": "Shorthorned_Grasshopper",
        "Tateha Butterfly": "Tateha_Butterfly",
        "Caterpillar exz": "Caterpillar_exz",
        "Taiwan Clouded Yellow": "Taiwan_Clouded_Yellow",
        "Kurohime Crane Fly": "Kurohime_Crane_Fly",
        "Bee ex": "Bee_ex",
        "Hosohari Stinkbug ex": "Hosohari_Stinkbug_ex",
        "Tonosama Grasshopper": "Tonosama_Grasshopper",
        "Rainbow Skink": "Rainbow_Skink",
        "Longhorn Beetle": "Longhorn_Beetle",
        "Tsumamurasaki Madara": "Tsumamurasaki_Madara",
        "Kobane Inago": "Kobane_Inago",
        "Orange Spider": "Orange_Spider"
    };

    // カードタイプによるフォルダ判定
    let folder = 'pokemon'; // デフォルト
    
    if (card && card.card_type) {
        if (card.card_type === 'Energy' || card.card_type === 'Basic Energy' || card.card_type === 'Special Energy') {
            folder = 'energy';
        } else if (card.card_type === 'Trainer') {
            folder = 'trainer';
        } else if (card.card_type === 'Pokémon' || card.card_type === 'Pokemon') {
            folder = 'pokemon';
        }
    } else if (cardNameEn.includes("Energy")) {
        folder = 'energy';
    }
    
    // エネルギーカード
    if (folder === 'energy' || cardNameEn.includes("Energy")) {
        const energyType = cardNameEn.split(" ")[0];
        const energyImageMap = {
            "Colorless": "Energy_Colorless",
            "Grass": "Energy_Grass",
            "Fire": "Energy_Fire",
            "Water": "Energy_Water",
            "Lightning": "Energy_Lightning",
            "Psychic": "Energy_Psychic",
            "Fighting": "Energy_Fighting",
            "Darkness": "Energy_Darkness",
            "Metal": "Energy_Colorless" // Metal uses Colorless as fallback
        };
        const imageName = energyImageMap[energyType] || "Energy_Colorless";
        return `assets/cards/energy/${imageName}.webp`;
    }

    // ポケモン・トレーナーカード
    let fileName;
    
    // 現在は従来の名前ベースを使用（後でID-ベースに移行予定）
    // TODO: 将来的にはIDベースの命名規則に移行する
    fileName = specialNames[cardNameEn] || cardNameEn.replace(/ /g, '_');
    
    const imagePath = `assets/cards/${folder}/${fileName}.webp`;
    
    // デバッグ情報（開発時のみ）
    if (cardNameEn && !specialNames[cardNameEn] && cardNameEn !== cardNameEn.replace(/ /g, '_')) {
        console.debug(`🔍 Image path for "${cardNameEn}": ${imagePath} (ID: ${card?.id})`);
    }
    
    return imagePath;
}

/**
 * 名前翻訳マップ
 */
export const nameTranslations = {
    "Akamayabato": "アカメバト",
    "Cat exv": "猫exv",
    "Glasswing Butterfly Larva": "イシガケチョウ 幼虫",
    "Glasswing Butterfly": "イシガケチョウ",
    "Kobane Inago": "コバネイナゴ",
    "Orange Spider": "オレンジぐも",
    "Tsumamurasaki Madara": "つまむらさきまだら",
    "Grey Dagger Moth Larva": "ハイイロヒトリの幼虫",
    "Short-horned Grasshopper": "ショウヨウバッタ",
    "Haiirohitori": "ハイイロヒトリ",
    "Tateha Butterfly": "タテハチョウ",
    "Caterpillar exz": "毛虫exz",
    "Taiwan Clouded Yellow": "タイワンキチョウ",
    "Kurohime Crane Fly": "クロヒメガガンボモドキ",
    "Snail": "カタツムリ",
    "Bee ex": "ミツバチex",
    "Hosohari Stinkbug ex": "ホソヘリカメムシex",
    "Aokanabun": "アオカナブン",
    "Tonosama Grasshopper": "トノサマバッタ",
    "Rainbow Skink": "ニホントカゲ（レインボー）",
    "Longhorn Beetle": "カミキリムシ",
    "Colorless Energy": "無色 エネルギー",
    "Grass Energy": "くさ エネルギー",
    "Fire Energy": "ほのお エネルギー",
    "Water Energy": "みず エネルギー",
    "Lightning Energy": "でんき エネルギー",
    "Psychic Energy": "エスパー エネルギー",
    "Fighting Energy": "かくとうエネルギー",
    "Darkness Energy": "あく エネルギー",
    "Metal Energy": "はがね エネルギー"
};

/**
 * カードデータを正規化してゲームエンジンと互換性を保つ
 * @param {Array} rawData - 生のカードデータ
 * @returns {Array} 正規化されたカードデータ
 */
function normalizeCardData(rawData) {
    if (!Array.isArray(rawData)) return [];
    
    return rawData.map((card, index) => {
        const normalized = { ...card };
        
        
        // card_type の正規化
        if (normalized.card_type === 'Pokemon') {
            normalized.card_type = 'Pokémon';
        } else if (normalized.card_type === 'Energy') {
            // is_basic プロパティがない場合は基本エネルギーとして扱う
            if (normalized.is_basic === false) {
                normalized.card_type = 'Special Energy';
            } else {
                normalized.card_type = 'Basic Energy';
            }
        }
        
        // stage の正規化
        if (normalized.stage === 'Basic') normalized.stage = 'BASIC';
        if (normalized.stage === 'Stage1') normalized.stage = 'STAGE1';
        if (normalized.stage === 'Stage2') normalized.stage = 'STAGE2';
        
        // 後方互換性のための type -> types 変換
        if (!normalized.types && normalized.type) {
            normalized.types = Array.isArray(normalized.type) ? normalized.type : [normalized.type];
            delete normalized.type;
        }
        
        // weakness を配列に変換（もし単一オブジェクトの場合）
        if (normalized.weakness && !Array.isArray(normalized.weakness)) {
            normalized.weakness = [normalized.weakness];
        }
        
        // retreat_cost を数値に変換（もし配列の場合）
        if (Array.isArray(normalized.retreat_cost)) {
            normalized.retreat_cost = normalized.retreat_cost.length;
        }
        
        // 欠落フィールドの補完
        if (!normalized.name_en && normalized.name_ja) {
            normalized.name_en = normalized.name_ja; // フォールバック
            console.warn(`⚠️ Missing name_en, using name_ja: ${normalized.name_ja}`);
        }
        
        if (!normalized.name_ja && normalized.name_en) {
            normalized.name_ja = normalized.name_en; // フォールバック
            console.warn(`⚠️ Missing name_ja, using name_en: ${normalized.name_en}`);
        }
        
        // image フィールドを image_file に統一
        if (!normalized.image_file && normalized.image) {
            normalized.image_file = normalized.image;
            delete normalized.image;
        }
        
        return normalized;
    });
}

/**
 * 静的フォールバックデータを取得
 * @returns {Array} 基本的なカードデータ
 */
function getStaticFallbackData() {
    return [
        {
            id: "001",
            name_en: "Akamayabato",
            name_ja: "アカメバト",
            card_type: "Pokémon",
            stage: "BASIC",
            hp: 130,
            types: ["Colorless"],
            weakness: [{ type: "Darkness", value: "×2" }],
            retreat_cost: 1,
            attacks: [
                {
                    name_ja: "ひっかく",
                    name_en: "Scratch",
                    cost: ["Lightning"],
                    damage: 90
                }
            ],
            image_file: "Akamayabato.webp"
        },
        {
            id: "002",
            name_en: "Grass Energy",
            name_ja: "くさエネルギー",
            card_type: "Basic Energy",
            energy_type: "Grass",
            is_basic: true,
            image_file: "Energy_Grass.webp"
        }
    ];
}