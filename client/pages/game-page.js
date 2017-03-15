import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

import './game-page.html';
import { ReactiveCountdown } from '../../imports/util/ReactiveCountdown.js';
import { LetterGrid } from '../../imports/letter-grid.js';
import { GameUtils } from '../../imports/util/game-utils.js';

Template.GamePage.onCreated(function() {
    this.gameState = new ReactiveDict();
    this.timer = new ReactiveCountdown(180000, {
        steps: 500,
        interval: 500,
        completed: () => {
            Template.GamePage.onGameTimeExpired(this);
        },
    });
    this.endGame = new ReactiveDict();
});

Template.GamePage.onRendered(function() {
    this.letterGrid = new LetterGrid(document.getElementById('canvas'), (tiles) => {
        this.gameState.set('currentWord', GameUtils.collapseWord(tiles));
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
    Meteor.call('game.pause', (error) => {
        this.timer.stop();
    });
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
        instance.gameState.set('currentWord', null);

        const coords = [];
        for(let i = 0; i < instance.letterGrid.selectedTiles.length; i++) {
            coords.push(instance.letterGrid.selectedTiles[i].pos);
        }
        Meteor.call('game.submitWord', coords, (error, result) => {
            if(result) {
                instance.letterGrid.submitWord(instance);
                Meteor.call('game.refillGrid', (error, result) => {
                    if(result) {
                        for(let i = 0; i < result.length; i++) {
                            instance.letterGrid.tiles[result[i].pos.x].push(result[i]);
                        }
                    }
                });

                const word = GameUtils.collapseWord(instance.letterGrid.selectedTiles);
                instance.gameState.set('currentScore', instance.gameState.get('currentScore') + word.score);
                instance.gameState.set('wordHistory', instance.gameState.get('wordHistory').concat([{word: word.word, score: word.score}]));
            } else {
                instance.letterGrid.rejectWord(instance);
            }
        });
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
        return Template.instance().gameState.get('currentScore');
    },
    currentWord() {
        const currentWord = Template.instance().gameState.get('currentWord');
        if(currentWord) {
            return currentWord.word;
        }
    },
    currentWordScore() {
        const currentWord = Template.instance().gameState.get('currentWord');
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
        const currentWord = Template.instance().gameState.get('currentWord');
        if(currentWord) {
            return currentWord.word.length < 2 ? 'disabled' : '';
        }
        return 'disabled';
    },
    clearButtonStatus() {
        const currentWord = Template.instance().gameState.get('currentWord');
        if(currentWord) {
            return currentWord.word.length > 0 ? '' : 'hidden';
        }
        return 'hidden';
    },
    pauseButtonStatus() {
        return Template.instance().gameState.get('status') == 'running' ? '' : 'hidden';
    },
    wordHistory() {
        const list = Template.instance().gameState.get('wordHistory');
        if(list) {
            return list.reverse();
        }
    },
    isGameStarted() {
        return Template.instance().gameState.get('status') != 'init';
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
    Meteor.call('game.init', (error, result) => {
        if(!error) {
            instance.gameState.set('status', result.started ? 'paused' : 'init');
            instance.gameState.set('currentScore', result.score);
            instance.gameState.set('wordHistory', result.words);
            instance.letterGrid.tiles = result.tiles;

            if(result.started) {
                instance.letterGrid.start();
                instance.letterGrid.isPaused = true;
                instance.timer._current = result.timeLeft;
                instance.timer._dependency.changed();
                if(result.timeLeft <= 0) {
                    Template.GamePage.onGameTimeExpired(instance);
                }
            }
        }
    });
};

Template.GamePage.startGame = function(instance) {
    Meteor.call('game.start', (error, result) => {
        if(!error) {
            if(instance.letterGrid.isStarted) {
                instance.letterGrid.isPaused = false;
            } else {
                instance.letterGrid.start(true);
            }
            instance.gameState.set('status', 'running');
            instance.timer._current = result.timeLeft;
            instance.timer._dependency.changed();
            if(result.timeLeft <= 0) {
                Template.GamePage.onGameTimeExpired();
            } else {
                instance.timer.resume();
            }
        }
    });
};

Template.GamePage.pauseGame = function(instance) {
    Meteor.call('game.pause', (error) => {
        if(!error) {
            instance.letterGrid.isPaused = true;
            instance.gameState.set('status', 'paused');
            instance.timer.stop();
        }
    });
};

Template.GamePage.replayGame = function(instance) {
    Meteor.call('game.replay', (error) => {
        if(!error) {
            Template.GamePage.initGame(instance);
        }
    });
};

Template.GamePage.endGame = function(instance) {
    Meteor.call('game.end', (error) => {
        if(!error) {
            Template.GamePage.initGame(instance);
        }
    });
};

Template.GamePage.onGameTimeExpired = function(instance) {
    instance.letterGrid.stop();

    const gs = instance.gameState;
    gs.set('status', 'ended');

    instance.endGame.set('totalPoints', gs.get('currentScore'));

    const words = gs.get('wordHistory');
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
