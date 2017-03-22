import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { ReactiveVar } from 'meteor/reactive-var';

import SimpleSchema from 'simpl-schema';

import { GameUtils } from '../util/game-utils.js';

export const GameSessions = new Mongo.Collection('gameSessions');
const posSchema = new SimpleSchema({
    x: {
        type: SimpleSchema.Integer,
        min: 0,
        max: 7,
    },
    y: {
        type: SimpleSchema.Integer,
        min: 0,
    },
});
const tileSchema = new SimpleSchema({
    letter: /^[a-z]$/i,
    value: {
        type: SimpleSchema.Integer,
        min: 1,
        max: 10,
    },
    pos: posSchema,
    initPos: posSchema,
});
GameSessions.attachSchema(new SimpleSchema({
    userId: SimpleSchema.RegEx.Id,
    status: {
        type: String,
        allowedValues: ['init', 'running', 'paused', 'ended'],
        defaultValue: 'init',
    },
    tiles: [Array],
    'tiles.$.$': {
        type: Object,
        blackbox: true,
    },
    tileHistory: {
        type: Array,
        autoValue: function() {
            if(!this.isSet && !this.isUpdate) {
                return this.field('tiles').value;
            }
        },
    },
    'tileHistory.$': Array,
    'tileHistory.$.$': {
        type: Object,
        blackbox: true,
    },
    words: {
        type: Array,
        defaultValue: [],
    },
    'words.$': Array,
    'words.$.$': tileSchema,
    timeLeft: {
        type: SimpleSchema.Integer,
        min: 0,
        defaultValue: 180000,
    },
    startTime: {
        type: SimpleSchema.Integer,
        autoValue: Date.now,
    },
    seed: SimpleSchema.Integer,
    tilesPlayed: {
        type: SimpleSchema.Integer,
        min: 0,
        defaultValue: 0,
    },
}));

if(Meteor.isServer) {
    Meteor.publish('gameSession', function() {
        return GameSessions.find({userId: this.userId}, {
            status: 1,
            tiles: 1,
            words: 1,
            timeLeft: 1,
            seed: 1,
            tilesPlayed: 1,
        });
    });
}

export const PlayResult = new ReactiveVar(null);

Meteor.methods({
    'game.init'() {
        if(Meteor.isClient) {
            return;
        }
        if(!this.userId) {
            throw new Meteor.Error('not-authorized');
        }

        const gameState = GameSessions.findOne({userId: this.userId}, {status: 1});
        if(!gameState) {
            const tiles = [];
            GameUtils.fillGrid(tiles);
            GameSessions.insert({
                userId: this.userId,
                tiles,
                seed: Date.now(),
            });
        } else if(gameState.status == 'running') {
            GameSessions.update({_id: gameState._id}, {$set: {status: 'paused'}});
        }
    },
    'game.start'() {
        const gameState = GameSessions.findOne({userId: this.userId}, {});
        if(!gameState) {
            throw new Meteor.Error('invalid-game');
        }

        GameSessions.update({_id: gameState._id}, {$set: {status: 'running'}});
    },
    'game.setPaused'(isPaused) {
        const gameState = GameSessions.findOne({userId: this.userId}, {
            started: 1,
            startTime: 1,
        });
        if(!gameState) {
            throw new Meteor.Error('invalid-game');
        }

        if(gameState.status == 'init' || gameState.status == 'ended') {
            throw new Meteor.Error('game-not-started');
        }

        if(isPaused) {
            GameSessions.update({_id: gameState._id}, {
                $set: {status: 'paused'},
                $inc: {timeLeft: -(Date.now() - gameState.startTime)},
            });
        } else {
            GameSessions.update({_id: gameState._id}, {$set: {status: 'running'}});
        }
    },
    'game.sync'() {
        const gameState = GameSessions.findOne({userId: this.userId}, {
            status: 1,
            startTime: 1,
        });
        if(!gameState) {
            throw new Meteor.Error('invalid-game');
        }

        if(gameState.status == 'init' || gameState.status == 'ended') {
            throw new Meteor.Error('game-not-started');
        }

        GameSessions.update({_id: gameState._id}, {$inc: {timeLeft: -(Date.now() - gameState.startTime)}});
    },
    'game.end'() {
        GameSessions.remove({userId: this.userId});
    },
    'game.playWord'(tiles) {
        const gameState = GameSessions.findOne({userId: this.userId}, {
            started: 1,
            tiles: 1,
            tileHistory: 1,
            timeLeft: 1,
            startTime: 1,
            seed: 1,
            tilesPlayed: 1,
        });
        if(!gameState) {
            throw new Meteor.Error('invalid-game');
        }

        if(gameState.status == 'init' || gameState.status == 'ended') {
            throw new Meteor.Error('game-not-started');
        }

        if(gameState.timeLeft - (Date.now() - gameState.startTime) < 0) {
            throw new Meteor.Error('time-expired');
        }

        if(Meteor.isServer) {
            GameUtils.seedRng(gameState.seed, gameState.tilesPlayed);
        }

        if(!GameUtils.playWord(gameState.tiles, tiles, gameState.tileHistory, Meteor.isServer)) {
            if(Meteor.isClient) {
                PlayResult.set(false);
            }
        } else {
            if(Meteor.isClient) {
                PlayResult.set(true);
            }

            GameSessions.update({_id: gameState._id}, {
                $set: {
                    tiles: gameState.tiles,
                    tileHistory: gameState.tileHistory,
                },
                $push: {words: tiles},
                $inc: {
                    tilesPlayed: tiles.length,
                    timeLeft: -(Date.now() - gameState.startTime),
                },
            });
        }
    },
    'game.replay'() {
        const gameState = GameSessions.findOne({userId: this.userId}, {tileHistory: 1});
        if(!gameState) {
            throw new Meteor.Error('invalid-game');
        }

        GameSessions.update({_id: gameState._id}, {
            $set: {
                status: 'init',
                tiles: gameState.tileHistory,
                words: [],
                timeLeft: 180000,
            },
        });
    },
});
