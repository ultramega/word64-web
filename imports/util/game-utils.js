import { Meteor } from 'meteor/meteor';
import { HTTP } from 'meteor/http';

import { LetterTile } from './letter-tile.js';

export class GameUtils {
    static seedRng(seed, skip) {
        LetterTile.seedRng(seed, skip);
    }

    static shiftTiles(grid) {
        for(let col = 0; col < grid.length; col++) {
            for(let row = 0; row < grid[col].length; row++) {
                grid[col][row].initPos.y = grid[col][row].pos.y;
                grid[col][row].pos.y = row;
            }
        }
    }

    static fillGrid(grid, history) {
        while(grid.length < GameUtils.GRID_SIZE) {
            grid.push([]);
        }

        for(let col = 0; col < grid.length; col++) {
            let initRow = GameUtils.GRID_SIZE;
            while(grid[col].length < GameUtils.GRID_SIZE) {
                const tile = LetterTile.getTile(null, col, grid[col].length, col, initRow++);
                grid[col].push(tile);
                if(history) {
                    history[col].push(LetterTile.getTile(tile.letter, col, history[col].length, col, history[col].length + 8));
                }
            }
        }
    }

    static findTiles(grid, tiles) {
        const localTiles = [];
        let prev;
        for(let i = 0; i < tiles.length; i++) {
            const c = tiles[i].pos;
            if(c.x < 0 || c.x >= grid.length || c.y < 0 || c.y >= grid[c.x].length) {
                return false;
            }

            if(i > 0) {
                if(!((c.y == prev.y && Math.abs(c.x - prev.x) == 1)
                    || (c.x == prev.x && Math.abs(c.y - prev.y) == 1))) {
                    return false;
                }
            }

            localTiles.push(grid[c.x][c.y]);
            prev = c;
        }

        return localTiles;
    }

    static collapseWord(tiles) {
        let word = '';
        let score = 0;
        for(let i = 0; i < tiles.length; i++) {
            word += tiles[i].letter;
            score += tiles[i].value;
        }
        return {word, base: score, score: score * word.length, tiles};
    }

    static isValidWord(word) {
        return GameUtils.WORD_LIST.indexOf(word) > -1;
    }

    static playWord(grid, tiles, tileHistory, updateGrid) {
        const gridTiles = GameUtils.findTiles(grid, tiles);
        if(!gridTiles) {
            return false;
        }

        const word = GameUtils.collapseWord(gridTiles);
        if(!GameUtils.isValidWord(word.word.toLowerCase())) {
            return false;
        }

        if(updateGrid) {
            for(let j = gridTiles.length - 1; j >= 0; j--) {
                const col = grid[gridTiles[j].pos.x];
                col.splice(col.indexOf(gridTiles[j]), 1);
            }
            GameUtils.shiftTiles(grid);
            GameUtils.fillGrid(grid, tileHistory);
        }

        return word;
    }

    static simulateGame(seed, moves) {
        const grid = [];
        GameUtils.seedRng(seed);
        GameUtils.fillGrid(grid);

        const words = [];
        for(let i = 0; i < moves.length; i++) {
            const word = GameUtils.playWord(grid, moves[i]);
            if(!word) {
                return false;
            }

            words.push(word);
        }

        return words;
    }
}

GameUtils.GRID_SIZE = 8;

GameUtils.WORD_LIST = [];
if(Meteor.isClient) {
    HTTP.get('words.txt', (error, result) => {
        if(!error) {
            GameUtils.WORD_LIST = result.content.split('\n');
        }
    });
} else {
    GameUtils.WORD_LIST = Assets.getText('words.txt').split('\n');
}
