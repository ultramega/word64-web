export class GameUtils {
    static shiftTiles(grid) {
        for(let col = 0; col < grid.length; col++) {
            for(let row = 0; row < grid[col].length; row++) {
                grid[col][row].initPos.y = grid[col][row].pos.y;
                grid[col][row].pos.y = row;
            }
        }
    }

    static collapseWord(tiles) {
        let word = '';
        let score = 0;
        for(let i = 0; i < tiles.length; i++) {
            word += tiles[i].letter;
            score += tiles[i].value;
        }
        return {word, base: score, score: score * word.length};
    }
}
