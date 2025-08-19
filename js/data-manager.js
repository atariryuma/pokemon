/**
 * データ管理モジュール
 * カードデータの読み込み、画像パス管理、フォールバック機能を提供
 */

// カードデータ（JSONから動的読み込み）
let cardMasterList = [];

/**
 * カードデータをJSONファイルから読み込む
 * @returns {Promise<Array>} カードデータの配列
 */
export async function loadCardsFromJSON() {
    try {
        const response = await fetch('./data/cards-master.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        cardMasterList = await response.json();
        console.log(`📦 Loaded ${cardMasterList.length} cards from JSON`);
        return cardMasterList;
    } catch (error) {
        console.error('❌ Failed to load cards from JSON:', error);
        // フォールバック: 静的データ
        cardMasterList = getStaticFallbackData();
        console.log(`🔄 Fallback: Using ${cardMasterList.length} static cards`);
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
 * カード画像パスを取得
 * @param {string} cardNameEn - カードの英語名
 * @returns {string} 画像ファイルのパス
 */
export function getCardImagePath(cardNameEn) {
    // 特別なカード名のマッピング
    const specialNames = {
        "Glasswing Butterfly Larva": "Glasswing_Butterfly_Larva1",
        "Cat exv": "Neko_exv",
        "Grey Dagger Moth Larva": "Haiirohitori_Larva",
        "Short-horned Grasshopper": "Shouyou_Batta",
        "Tateha Butterfly": "Tateha",
        "Caterpillar exz": "Kemushi_exz",
        "Taiwan Clouded Yellow": "Taiwan_Clouded_Yellow",
        "Kurohime Crane Fly": "Kurohime_Ganbo",
        "Bee ex": "Bee_ex",
        "Hosohari Stinkbug ex": "Hosohari_Stinkbug_ex",
        "Tonosama Grasshopper": "Tonosama_Batta",
        "Rainbow Skink": "Rainbow_Skink",
        "Longhorn Beetle": "Longhorn_Beetle",
        "Tsumamurasaki Madara": "Tsumamura_Sakimadara",
        "Kobane Inago": "Koban_Inago",
        "Orange Spider": "Orange_Spider"
    };

    // エネルギーカード
    if (cardNameEn.includes("Energy")) {
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
        return `assets/cards/energy/${imageName}.webp`; // Changed path
    }

    // ポケモンカード
    const fileName = specialNames[cardNameEn] || cardNameEn.replace(/ /g, '_');
    return `assets/cards/pokemon/${fileName}.webp`; // Changed path
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

