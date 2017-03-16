import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';

import SimpleSchema from 'simpl-schema';

import { LetterTile } from '../util/letter-tile.js';
import { GameUtils } from '../util/game-utils.js';

const GameSessions = new Mongo.Collection('gameSessions');

GameSessions.attachSchema(new SimpleSchema({
    userId: SimpleSchema.RegEx.Id,
    tiles: [Array],
    'tiles.$.$': {
        type: Object,
        blackbox: true,
    },
    tileHistory: {
        type: Array,
        autoValue: function() {
            if(!this.isSet && !this.isUpdate && this.field('tiles').isSet) {
                return this.field('tiles').value;
            }
        },
    },
    'tileHistory.$': Array,
    'tileHistory.$.$': {
        type: Object,
        blackbox: true,
    },
    score: {
        type: SimpleSchema.Integer,
        min: 0,
    },
    words: Array,
    'words.$': {
        type: Object,
        blackbox: true,
    },
    started: {
        type: Boolean,
        defaultValue: false,
    },
    timeLeft: {
        type: SimpleSchema.Integer,
        min: 0,
        defaultValue: 180000,
    },
    startTime: {
        type: SimpleSchema.Integer,
        autoValue: Date.now,
    },
}));

const WordList = Assets.getText('words.txt').split('\n');

Meteor.methods({
    'game.init'() {
        if(!this.userId) {
            throw new Meteor.Error('not-authorized');
        }

        let session = GameSessions.findOne({userId: this.userId}, {
            tiles: 1,
            score: 1,
            words: 1,
            started: 1,
            timeLeft: 1,
        });
        if(!session) {
            const tiles = [];
            fillGrid(tiles);
            session = {
                userId: this.userId,
                tiles,
                score: 0,
                words: [],
                started: false,
                timeLeft: 180000,
            };

            GameSessions.insert(session);
        }

        return session;
    },
    'game.start'() {
        const gameState = GameSessions.findOne({userId: this.userId}, {timeLeft: 1});
        if(!gameState) {
            throw new Meteor.Error('invalid-game');
        }

        GameSessions.update({_id: gameState._id}, {$set: {started: true}});

        return {timeLeft: gameState.timeLeft};
    },
    'game.pause'() {
        const gameState = GameSessions.findOne({userId: this.userId}, {startTime: 1});
        if(!gameState) {
            throw new Meteor.Error('invalid-game');
        }

        GameSessions.update({_id: gameState._id}, {$inc: {timeLeft: -(Date.now() - gameState.startTime)}});
    },
    'game.end'() {
        GameSessions.remove({userId: this.userId});
    },
    'game.replay'() {
        const gameState = GameSessions.findOne({userId: this.userId}, {tileHistory: 1});
        if(!gameState) {
            throw new Meteor.Error('invalid-game');
        }

        GameSessions.update({_id: gameState._id}, {
            $set: {
                tiles: gameState.tileHistory,
                score: 0,
                words: [],
                started: false,
                timeLeft: 180000,
            },
        });
    },
    'game.submitWord'(coords) {
        const gameState = GameSessions.findOne({userId: this.userId}, {
            tiles: 1,
            score: 1,
            started: 1,
            startTime: 1,
            timeLeft: 1,
        });
        if(!gameState || !gameState.started) {
            throw new Meteor.Error('invalid-game');
        }

        if(gameState.timeLeft - (Date.now() - gameState.startTime) < 0) {
            throw new Meteor.Error('time-expired');
        }

        const gameTiles = gameState.tiles;
        const tiles = findTiles(gameTiles, coords);
        if(!tiles) {
            throw new Meteor.Error('invalid-move');
        }

        const word = GameUtils.collapseWord(tiles);
        if(WordList.indexOf(word.word.toLowerCase()) == -1) {
            return false;
        }

        for(let i = tiles.length - 1; i >= 0; i--) {
            const col = gameTiles[tiles[i].pos.x];
            col.splice(col.indexOf(tiles[i]), 1);
        }

        GameUtils.shiftTiles(gameTiles);
        GameSessions.update({_id: gameState._id}, {
            $push: {words: {word: word.word, score: word.score}},
            $set: {score: gameState.score + word.score, tiles: gameTiles},
            $inc: {timeLeft: -(Date.now() - gameState.startTime)},
        });

        return true;
    },
    'game.refillGrid'() {
        const gameState = GameSessions.findOne({userId: this.userId}, {tiles: 1, tileHistory: 1});
        if(!gameState) {
            throw new Meteor.Error('invalid-game');
        }

        const newTiles = fillGrid(gameState.tiles, gameState.tileHistory);
        GameSessions.update({_id: gameState._id}, {
            $set: {
                tiles: gameState.tiles,
                tileHistory: gameState.tileHistory
            }
        });

        return newTiles;
    },
});

const fillGrid = function(grid, history) {
    const newTiles = [];
    while(grid.length < 8) {
        grid.push([]);
    }

    for(let col = 0; col < grid.length; col++) {
        for(let row = 0; row < grid[col].length; row++) {
            grid[col][row].initPos.y = grid[col][row].pos.y;
        }
        let initRow = 8;
        while(grid[col].length < 16) {
            const tile = LetterTile.getTile(null, col, grid[col].length, col, initRow++);
            grid[col].push(tile);
            newTiles.push(tile);
            if(history) {
                history[col].push(LetterTile.getTile(tile.letter, col, history[col].length, col, history[col].length + 8));
            }
        }
    }

    return newTiles;
};

const findTiles = function(grid, coords) {
    const tiles = [];
    let prev;
    for(let i = 0; i < coords.length; i++) {
        const c = coords[i];
        if(c.x < 0 || c.x >= grid.length || c.y < 0 || c.y >= grid[c.x].length) {
            return false;
        }

        if(i > 0) {
            if(!((c.y == prev.y && Math.abs(c.x - prev.x) == 1)
                || (c.x == prev.x && Math.abs(c.y - prev.y) == 1))) {
                return false;
            }
        }

        tiles.push(grid[c.x][c.y]);
        prev = c;
    }

    return tiles;
};
