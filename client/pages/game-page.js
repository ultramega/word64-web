import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { Tracker } from 'meteor/tracker';
import { Mongo } from 'meteor/mongo';
import { ReactiveDict } from 'meteor/reactive-dict';
import { ReactiveVar } from 'meteor/reactive-var';
import { Cookies } from 'meteor/ostrio:cookies';

import { ReactiveCountdown } from '../../imports/util/ReactiveCountdown.js';
import { LetterGrid } from '../../imports/letter-grid.js';
import { GameUtils } from '../../imports/util/game-utils.js';
import { GameSessions } from '../../imports/api/game.js';
import { PlayResult } from '../../imports/api/game.js';

import './game-page.html';

Template.GamePage.onCreated(function() {
    this.gameId = new ReactiveVar(new Cookies().get('gameId'));
    this.gameStatus = new ReactiveVar('loading');
    this.wordList = new ReactiveVar([]);
    this.currentScore = new ReactiveVar(0);
    this.currentWord = new ReactiveVar(null);

    this.timer = new ReactiveCountdown(180000, {
        steps: 500,
        interval: 500,
        completed: () => {
            Template.GamePage.onGameTimeExpired(this);
        },
    });

    this.endGame = new ReactiveDict();

    Tracker.autorun(() => {
        Meteor.subscribe('gameSession', this.gameId.get(), () => {
            const state = GameSessions.findOne({});
            GameUtils.seedRng(state.seed, state.tilesPlayed);
            this.letterGrid.tiles = state.tiles;
            this.timer._current = state.timeLeft;
            this.timer._dependency.changed();

            if(state.status == 'running' || state.status == 'paused') {
                this.letterGrid.start();
                this.letterGrid.isPaused = true;
                if(state.timeLeft <= 0) {
                    Template.GamePage.onGameTimeExpired(this);
                }
            }
        });

        new Cookies().set('gameId', this.gameId.get());
    });

    Tracker.autorun(() => {
        const gameState = GameSessions.findOne({}, {fields: {words: 1}});
        if(gameState) {
            const wordList = [];
            let score = 0;
            for(let i = gameState.words.length - 1; i >= 0; i--) {
                const word = GameUtils.collapseWord(gameState.words[i]);
                score += word.score;
                wordList.push(word);
            }
            this.wordList.set(wordList);
            this.currentScore.set(score);
        }
    });

    Tracker.autorun(() => {
        const gameState = GameSessions.findOne({}, {fields: {status: 1}});
        gameState && this.gameStatus.set(gameState.status);
    });
});

Template.GamePage.onRendered(function() {
    this.letterGrid = new LetterGrid(document.getElementById('canvas'), (tiles) => {
        this.currentWord.set(GameUtils.collapseWord(tiles));
    });

    Tracker.autorun(() => {
        const result = PlayResult.get();
        if(result !== null) {
            if(result) {
                this.letterGrid.submitWord();
            } else {
                this.letterGrid.rejectWord();
            }
            PlayResult.set(null);
        }
    });

    const resize = () => {
        const w = $(window);
        $('#dictionary-frame').css('height', w.height() - 180);

        const main = $('main');
        main.css('height', w.height() - (main.offset().top + $('footer').outerHeight()));

        const canvas = $('#canvas');
        const canvasSize = Math.max(Math.min(main.height(), $('#game-container').width()), 400);
        canvas.attr('height', canvasSize).attr('width', canvasSize);

        const history = $('#word-history');
        history.css('height', canvas.height() - (history.offset().top + $('#game-controls').outerHeight()));

        const startButton = $('#start-game');
        startButton.css('top', canvasSize / 2 - startButton.outerHeight() / 2);
        startButton.css('right', canvasSize / 2 - startButton.outerWidth() / 2);

        this.letterGrid.onResize(this);
    }
    window.addEventListener('resize', resize);
    resize();

    Template.GamePage.initGame(this);
});

Template.GamePage.onDestroyed(function() {
    Meteor.call('game.setPaused', Template.instance().gameId.get(), true);
    this.timer.stop();
});

Template.GamePage.events({
    'click #canvas'() {
        const instance = Template.instance();
        if(instance.letterGrid.isPaused) {
            Template.GamePage.startGame(instance);
        }
    },
    'mousedown #canvas'() {
        $('body').addClass('unselectable');
    },
    'mouseleave #canvas'() {
        $('body').removeClass('unselectable');
    },
    'click #start-game'() {
        Template.GamePage.startGame(Template.instance());
    },
    'click #pause-game'() {
        Template.GamePage.pauseGame(Template.instance());
    },
    'click #submit-word'() {
        const instance = Template.instance();
        Meteor.call('game.playWord', instance.gameId.get(), instance.currentWord.get().tiles);
        instance.currentWord.set(null);
    },
    'click #current-word a'(event) {
        event.preventDefault();
        Template.instance().letterGrid.clearSelection();
    },
    'click #word-history .list-group-item'(event) {
        event.preventDefault();
        $('#dictionary-frame').attr('src', '//www.dictionary.com/browse/' + this.word.toLowerCase());
        $('#dictionary-modal').modal('show');
    },
    'show.bs.modal #dictionary-modal'() {
        Template.GamePage.pauseGame(Template.instance());
    },
    'shown.bs.modal #dictionary-modal'() {
        $('#dictionary-frame').focus();
    },
    'click #new-game-button'() {
        Template.GamePage.endGame(Template.instance());
        $('#endgame-modal').modal('hide');
    },
    'click #replay-game-button'() {
        Template.GamePage.replayGame(Template.instance());
        $('#endgame-modal').modal('hide');
    },
});

Template.GamePage.helpers({
    currentScore() {
        return Template.instance().currentScore.get();
    },
    currentWord() {
        const currentWord = Template.instance().currentWord.get();
        if(currentWord) {
            return currentWord.word;
        }
    },
    currentWordScore() {
        const currentWord = Template.instance().currentWord.get();
        if(currentWord) {
           return currentWord.score + ' (' + currentWord.base + '&times;' + currentWord.word.length + ')';
        }
        return '0 (0&times;0)';
    },
    timer() {
        time = Math.max(0, Template.instance().timer.get() || 0);
        time = Math.floor((time === undefined ? 180000 : time) / 1000);
        return Math.floor(time / 60) + ':' + ('0' + time % 60).slice(-2);
    },
    submitButtonStatus() {
        const currentWord = Template.instance().currentWord.get();
        if(currentWord) {
            return currentWord.word.length < 2 ? 'disabled' : '';
        }
        return 'disabled';
    },
    clearButtonStatus() {
        const currentWord = Template.instance().currentWord.get();
        if(currentWord) {
            return currentWord.word.length > 0 ? '' : 'hidden';
        }
        return 'hidden';
    },
    pauseButtonStatus() {
        return Template.instance().gameStatus.get() == 'running' ? '' : 'hidden';
    },
    wordHistory() {
        return Template.instance().wordList.get();
    },
    isGameStarted() {
        const state = Template.instance().gameStatus.get();
        return state != 'init' && state != 'loading';
    },
    totalPoints() {
        return Template.instance().endGame.get('totalPoints');
    },
    wordsPlayed() {
        return Template.instance().endGame.get('wordsPlayed');
    },
    bestWord() {
        const bestWord = Template.instance().endGame.get('bestWord');
        if(bestWord) {
            if(bestWord.score) {
                return bestWord.word + ' (' + bestWord.score + ')';
            } else {
                return bestWord.word;
            }
        }
    },
});

Template.GamePage.initGame = function(instance) {
    Meteor.call('game.init', instance.gameId.get(), (error, result) => {
        if(!error) {
            instance.gameId.set(result);
        }
    });
};

Template.GamePage.startGame = function(instance) {
    Meteor.call('game.start', instance.gameId.get());
    if(instance.letterGrid.isStarted) {
        instance.letterGrid.isPaused = false;
    } else {
        instance.letterGrid.start(true);
    }
    instance.timer.resume();
};

Template.GamePage.pauseGame = function(instance) {
    Meteor.call('game.setPaused', instance.gameId.get(), true);
    instance.letterGrid.isPaused = true;
    instance.timer.stop();
};

Template.GamePage.replayGame = function(instance) {
    Meteor.call('game.replay', instance.gameId.get(), (error) => {
        if(!error) {
            Template.GamePage.initGame(instance);
        }
    });
};

Template.GamePage.endGame = function(instance) {
    Meteor.call('game.end', instance.gameId.get(), (error) => {
        if(!error) {
            Template.GamePage.initGame(instance);
        }
    });
};

Template.GamePage.onGameTimeExpired = function(instance) {
    instance.letterGrid.stop();

    instance.endGame.set('totalPoints', instance.currentScore.get());

    const words = instance.wordList.get();
    instance.endGame.set('wordsPlayed', words.length);

    let bestWord = {word: '(none)', score: 0};
    for(let i = 0; i < words.length; i++) {
        if(words[i].score > bestWord.score) {
            bestWord = words[i];
        }
    }
    instance.endGame.set('bestWord', bestWord);

    $('#endgame-modal').modal({
        backdrop: 'static',
        keyboard: false,
    });
};
