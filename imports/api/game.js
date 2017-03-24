import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { ReactiveVar } from 'meteor/reactive-var';
import { check } from 'meteor/check'

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
    userId: {
        type: SimpleSchema.RegEx.Id,
        optional: true,
    },
    connectionId: {
        type: SimpleSchema.RegEx.Id,
        optional: true,
    },
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
    previousTick: {
        type: SimpleSchema.Integer,
        autoValue: function() {
            if(!this.isSet && (!this.isUpdate || this.field('status').value == 'running')) {
                return Date.now();
            }
        },
    },
    seed: SimpleSchema.Integer,
    tilesPlayed: {
        type: SimpleSchema.Integer,
        min: 0,
        defaultValue: 0,
    },
}));

if(Meteor.isServer) {
    Meteor.publish('gameSession', function(gameId) {
        if(!gameId) {
            return;
        }
        check(gameId, String);
        return GameSessions.find(gameId, {fields: {
            userId: 1,
            status: 1,
            tiles: 1,
            words: 1,
            timeLeft: 1,
            seed: 1,
            tilesPlayed: 1,
        }});
    });

    Meteor.onConnection(function(connection) {
        connection.onClose(function() {
            GameSessions.update({
                connectionId: connection.id,
                status: 'running',
            }, {$set: {status: 'paused'}});
        });
    });

    const globalTick = function() {
        GameSessions.find({
            status: 'running',
            timeLeft: {$gt: -1},
        }, {fields: {previousTick: 1}}).forEach(function(doc) {
            GameSessions.update(doc._id, {
                $inc: {timeLeft: -(Date.now() - doc.previousTick)},
                $set: {previousTick: Date.now()},
            });
        });
        Meteor.setTimeout(globalTick, 1000);
    };
    globalTick();
}

export const PlayResult = new ReactiveVar(null);

Meteor.methods({
    'game.init'(gameId) {
        check(gameId, Match.Maybe(String));
        if(Meteor.isClient) {
            return;
        }

        const gameState = GameSessions.findOne({$or: [
            {_id: gameId},
            {$and: {
                userId: this.userId,
                $ne: {userId: null},
            }},
        ]}, {fields: {status: 1}});
        if(!gameState) {
            const tiles = [];
            GameUtils.fillGrid(tiles);
            return GameSessions.insert({
                userId: this.userId,
                connectionId: this.connection.id,
                tiles,
                seed: Date.now(),
            });
        } else if(gameState.status == 'running') {
            GameSessions.update(gameState._id, {$set: {status: 'paused'}});
        }

        GameSessions.update(gameState._id, {$set: {connectionId: this.connection.id}});

        return gameId;
    },
    'game.start'(gameId) {
        check(gameId, String);
        const gameState = GameSessions.findOne(gameId, {fields: {_id: 1}});
        if(!gameState) {
            throw new Meteor.Error('invalid-game');
        }

        GameSessions.update(gameState._id, {$set: {status: 'running'}});
    },
    'game.setPaused'(gameId, isPaused) {
        check(gameId, String);
        check(isPaused, Boolean);
        const gameState = GameSessions.findOne(gameId, {fields: {
            started: 1,
            startTime: 1,
        }});
        if(!gameState) {
            throw new Meteor.Error('invalid-game');
        }

        if(gameState.status == 'init' || gameState.status == 'ended') {
            throw new Meteor.Error('game-not-started');
        }

        if(isPaused) {
            GameSessions.update(gameState._id, {$set: {status: 'paused'}});
        } else {
            GameSessions.update(gameState._id, {$set: {status: 'running'}});
        }
    },
    'game.end'(gameId) {
        check(gameId, String);
        GameSessions.remove(gameId);
    },
    'game.playWord'(gameId, tiles) {
        check(gameId, String);
        check(tiles, [Match.ObjectIncluding({pos: Match.ObjectIncluding({x: Number, y: Number})})]);
        const gameState = GameSessions.findOne(gameId, {fields: {
            started: 1,
            tiles: 1,
            tileHistory: 1,
            timeLeft: 1,
            startTime: 1,
            seed: 1,
            tilesPlayed: 1,
        }});
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

            GameSessions.update(gameState._id, {
                $set: {
                    tiles: gameState.tiles,
                    tileHistory: gameState.tileHistory,
                },
                $push: {words: tiles},
                $inc: {tilesPlayed: tiles.length},
            });
        }
    },
    'game.replay'(gameId) {
        check(gameId, String);
        const gameState = GameSessions.findOne(gameId, {fields: {tileHistory: 1}});
        if(!gameState) {
            throw new Meteor.Error('invalid-game');
        }

        GameSessions.update(gameState._id, {
            $set: {
                status: 'init',
                tiles: gameState.tileHistory,
                words: [],
                timeLeft: 180000,
            },
        });
    },
});
