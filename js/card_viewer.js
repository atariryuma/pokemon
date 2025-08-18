import { cardMasterList, getCardImagePath } from './cards.js';

document.addEventListener('DOMContentLoaded', () => {
    const cardContainer = document.getElementById('card-container');

    cardMasterList.forEach(card => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card-display';

        const img = document.createElement('img');
        img.src = getCardImagePath(card.name_en);
        img.alt = card.name_ja;
        cardDiv.appendChild(img);

        const nameEn = document.createElement('p');
        nameEn.className = 'name-en';
        nameEn.textContent = card.name_en;
        cardDiv.appendChild(nameEn);

        const nameJa = document.createElement('p');
        nameJa.className = 'name-ja';
        nameJa.textContent = card.name_ja;
        cardDiv.appendChild(nameJa);

        const cardType = document.createElement('p');
        cardType.className = 'card-type';
        cardType.textContent = `Type: ${card.card_type}`;
        cardDiv.appendChild(cardType);

        if (card.card_type === 'Pokémon') {
            const hp = document.createElement('p');
            hp.className = 'hp';
            hp.textContent = `HP: ${card.hp}`;
            cardDiv.appendChild(hp);
        }

        cardContainer.appendChild(cardDiv);
    });
});
