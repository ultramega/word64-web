import Chance from 'chance';

export class LetterTile {
    static seedRng(seed, skip) {
        skip = skip || 0;
        LetterTile.RNG = new Chance(seed);
        while(skip--) {
            LetterTile.RNG.integer();
        }
    }

    static getTile(letter, x, y, initX, initY) {
        letter = letter || LetterTile.RNG.pickone(LetterTile.TILE_LIST);
        if(x === undefined || y === undefined) {
            x = y = 0;
        }
        if(initX === undefined || initY === undefined) {
            initX = initY = 0;
        }
        return {
            letter,
            value: LetterTile.LETTER_VALUES[letter],
            pos: {x, y},
            initPos: {x: initX, y: initY},
        };
    }
}

LetterTile.RNG = new Chance();

LetterTile.LETTER_VALUES = {
    'A': 1,
    'B': 3,
    'C': 3,
    'D': 2,
    'E': 1,
    'F': 4,
    'G': 2,
    'H': 4,
    'I': 1,
    'J': 8,
    'K': 5,
    'L': 1,
    'M': 3,
    'N': 1,
    'O': 1,
    'P': 3,
    'Q': 10,
    'R': 1,
    'S': 1,
    'T': 1,
    'U': 1,
    'V': 4,
    'W': 4,
    'X': 8,
    'Y': 4,
    'Z': 10,
};

LetterTile.TILE_LIST = (
    'A'.repeat(9) +
    'B'.repeat(2) +
    'C'.repeat(2) +
    'D'.repeat(4) +
    'E'.repeat(12) +
    'F'.repeat(2) +
    'G'.repeat(3) +
    'H'.repeat(2) +
    'I'.repeat(9) +
    'J' +
    'K' +
    'L'.repeat(4) +
    'M'.repeat(2) +
    'N'.repeat(6) +
    'O'.repeat(8) +
    'P'.repeat(2) +
    'Q' +
    'R'.repeat(6) +
    'S'.repeat(4) +
    'T'.repeat(6) +
    'U'.repeat(4) +
    'V'.repeat(2) +
    'W'.repeat(2) +
    'X' +
    'Y'.repeat(2) +
    'Z'
);
