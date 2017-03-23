import { Howl } from 'meteor/bojicas:howler2';

import { Interpolator } from './util/interpolator.js';
import { GameUtils } from './util/game-utils.js';

export class LetterGrid {
    constructor(canvas, callback) {
        this._canvas = canvas;
        this._ctx = canvas.getContext('2d');

        this._cb = callback;

        this._tiles = [];
        this._selectedTiles = [];
        this._pos = {x: 0, y: 0};

        this._tileCornerRadius = 8;
        this._tileMargin = 2;

        this._tileBackground = null;

        const mouseCb = (event) => {
            this._onMouseEvent(event);
        };
        canvas.addEventListener('mousedown', mouseCb);
        canvas.addEventListener('mouseup', mouseCb);
        canvas.addEventListener('mouseleave', mouseCb);
        canvas.addEventListener('mousemove', mouseCb);

        this._setSize();
        this._loadBackground();
        this._loadSounds();
        this._invalidate();
    }

    set tiles(tiles) {
        this._tiles = tiles || [];
        this._invalidate();
    }

    get tiles() {
        return this._tiles;
    }

    get selectedTiles() {
        return this._selectedTiles;
    }

    get isStarted() {
        return !!this._started;
    }

    set isPaused(isPaused) {
        this._paused = isPaused;
        this._invalidate();
    }

    get isPaused() {
        return !!this._paused;
    }

    start(animate) {
        this._started = true;
        if(animate) {
            this._triggerSound(LetterGrid.SOUND_GAME_START);
            this._startFillAnimation();
        } else {
            this._invalidate();
        }
    }

    stop() {
        this._started = false;
    }

    onResize() {
        this._setSize();
        this._invalidate();
    }

    submitWord() {
        if(!this._started || this._fillAnimationActive || this._clearAnimationActive) {
            return;
        }
        this._triggerSound(LetterGrid.SOUND_WORD_ACCEPTED);
        this._startClearAnimation();
    }

    rejectWord() {
        if(!this._started || this._fillAnimationActive || this._clearAnimationActive) {
            return;
        }
        this.clearSelection();
        this._triggerSound(LetterGrid.SOUND_WORD_REJECTED);
    }

    clearSelection() {
        if(!this._started || this._fillAnimationActive || this._clearAnimationActive) {
            return;
        }
        this._selectedTiles = [];
        if(this._cb) {
            this._cb(this._selectedTiles);
        }
        this._invalidate();
    }

    _onMouseEvent(event) {
        if(!this._started || this._paused || this._fillAnimationActive || this._clearAnimationActive) {
            return;
        }

        const rect = this._canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) * (this._canvas.width / rect.width);
        const y = (event.clientY - rect.top) * (this._canvas.height / rect.height);

        let tile;
        switch(event.type) {
            case 'mousedown':
                tile = this._getTile(x, y);
                if(tile) {
                    this._clickTile(tile);
                    this._activeTile = tile;
                }
                break;
            case 'mouseup':
            case 'mouseleave':
                this._activeTile = null;
                break;
            case 'mousemove':
                if(!this._activeTile) {
                    break;
                }
                tile = this._getTile(x, y);
                const selected = this._selectedTiles.indexOf(tile) > -1;
                if(tile != this._activeTile) {
                    if(!selected && this._isContiguous(tile)) {
                        this._selectedTiles.push(tile);
                        this._onTileChanged(tile);
                    } else if(selected && this._selectedTiles.length > 1
                        && tile == this._selectedTiles[this._selectedTiles.length - 2]) {
                        this._selectedTiles.pop();
                        this._onTileChanged(tile);
                    }
                }
                this._activeTile = tile;
                break;
        }
    }

    _setSize() {
        this._tileSize = Math.max(1, canvas.width / LetterGrid.GRID_SIZE);
        this._letterTextSize = this._tileSize / 1.6;
        this._scoreTextSize = this._tileSize / 4;
    }

    _loadBackground() {
        const img = new Image();
        img.addEventListener('load', () => {
            this._tileBackground = this._ctx.createPattern(img, 'repeat');
            this._invalidate();
        });
        img.src = 'img/retina_wood.png';
    }

    _loadSounds() {
        this._sounds = [];
        this._sounds[LetterGrid.SOUND_GAME_START] = new Howl({src: ['snd/game_start.wav']});
        this._sounds[LetterGrid.SOUND_TILE_SELECTED] = new Howl({src: ['snd/tile_selected.wav']});
        this._sounds[LetterGrid.SOUND_WORD_ACCEPTED] = new Howl({src: ['snd/word_accepted.wav']});
        this._sounds[LetterGrid.SOUND_WORD_REJECTED] = new Howl({src: ['snd/word_rejected.wav']});
    }

    _triggerSound(soundId) {
        if(this._sounds && this._sounds[soundId]) {
            this._sounds[soundId].play();
        }
    }

    _startFillAnimation() {
        this._fillAnimationActive = true;
        this._animationStart = Date.now();
        this._invalidate();
    }

    _startClearAnimation() {
        this._clearAnimationActive = true;
        this._animationStart = Date.now();
        this._invalidate();
    }

    _endClearAnimation() {
        while(this._selectedTiles.length) {
            const tile = this._selectedTiles.pop();
            const col = this._tiles[tile.pos.x];
            col.splice(col.indexOf(tile), 1);
        }
        this._clearAnimationActive = false;
        GameUtils.shiftTiles(this._tiles);
        GameUtils.fillGrid(this._tiles);
        this._startFillAnimation();
    }

    _prepareCanvas() {
        this._ctx.fillStyle = '#222';
        this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);

        this._ctx.strokeStyle = '#111';
        this._ctx.lineWidth = 1;

        for(let i = 0; i < this._canvas.width; i += this._tileSize) {
            this._ctx.moveTo(Math.floor(i) + 0.5, 0);
            this._ctx.lineTo(Math.floor(i) + 0.5, this._canvas.height);
            this._ctx.stroke();
        }
        this._ctx.moveTo(Math.floor(this._canvas.width) - 0.5, 0);
        this._ctx.lineTo(Math.floor(this._canvas.width) - 0.5, this._canvas.height);
        this._ctx.stroke();

        for(let i = 0; i < this._canvas.height; i += this._tileSize) {
            this._ctx.moveTo(0, Math.floor(i) + 0.5);
            this._ctx.lineTo(this._canvas.width, Math.floor(i) + 0.5);
            this._ctx.stroke();
        }
        this._ctx.moveTo(0, Math.floor(this._canvas.width) - 0.5);
        this._ctx.lineTo(this._canvas.width, Math.floor(this._canvas.width) - 0.5);
        this._ctx.stroke();
    }

    _drawTile(tile) {
        this._positionTile(tile);
        const left = this._pos.x + this._tileMargin;
        const top = this._pos.y + this._tileMargin;
        const size = this._tileSize - this._tileMargin * 2;
        const selected = this._selectedTiles.indexOf(tile) > -1;

        if(selected && this._clearAnimationActive) {
            this._ctx.globalAlpha = this._selectedAlpha;
        }

        this._ctx.fillStyle = this._tileBackground || 'tan';
        this._ctx.beginPath();
        this._ctx.moveTo(left + this._tileCornerRadius, top);
        this._ctx.arcTo(left + size, top, left + size, top + size, this._tileCornerRadius);
        this._ctx.arcTo(left + size, top + size, left, top + size, this._tileCornerRadius);
        this._ctx.arcTo(left, top + size, left, top, this._tileCornerRadius);
        this._ctx.arcTo(left, top, left + size, top, this._tileCornerRadius);
        this._ctx.closePath();
        this._ctx.fill();

        if(selected) {
            this._ctx.fillStyle = 'rgba(255, 102, 102, 0.8)';
            this._ctx.fill();
        }

        this._ctx.fillStyle = '#222';
        this._ctx.textAlign = 'center';
        this._ctx.font = this._letterTextSize + 'px sans-serif';
        this._ctx.fillText(tile.letter, left + size / 2, top + size / 2 + this._tileSize / 4);

        this._ctx.textAlign = 'right';
        this._ctx.font = this._scoreTextSize + 'px sans-serif';
        this._ctx.fillText(tile.value, left + size - this._tileSize / 12, top + this._tileSize / 4);

        this._ctx.globalAlpha = 1.0;
    }

    _positionTile(tile) {
        if(this._fillAnimationActive) {
            const progress = Interpolator.bounce((this._frameTime - this._animationStart) / LetterGrid.DURATION_FILL);
            this._pos.y = this._canvas.height - (tile.initPos.y * this._tileSize -
                (tile.initPos.y * this._tileSize - tile.pos.y * this._tileSize) * progress);
        } else {
            this._pos.y = this._canvas.height - tile.pos.y * this._tileSize;
        }
        this._pos.y -= this._tileSize;
        this._pos.x = tile.pos.x * this._tileSize;
    }

    _invalidate() {
        window.requestAnimationFrame(() => {
            this._renderFrame();
        });
    }

    _renderFrame() {
        if(this._paused) {
            this._drawPaused();
            return;
        }

        this._frameTime = Date.now();
        this._prepareCanvas();

        if(!this._started) {
            return;
        }

        if(this._clearAnimationActive) {
            this._runClearAnimation();
        }

        for(let i = 0; i < this._tiles.length; i++) {
            for(let j = 0; j < this._tiles[i].length; j++) {
                this._drawTile(this._tiles[i][j]);
            }
        }

        this._checkAnimations();
    }

    _drawPaused() {
        this._ctx.fillStyle = 'black';
        this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);

        this._ctx.fillStyle = 'white';
        this._ctx.textAlign = 'center';
        this._ctx.font = '32px sans-serif';
        this._ctx.fillText('PAUSED', this._canvas.width / 2, this._canvas.height / 2 - 20);

        this._ctx.font = '16px sans-serif';
        this._ctx.fillText('Click to resume game', this._canvas.width / 2, this._canvas.height / 2);
    }

    _runClearAnimation() {
        const progress = Interpolator.accelerate((this._frameTime - this._animationStart) / LetterGrid.DURATION_CLEAR);
        this._selectedAlpha = Math.max(0, 1.0 - progress);
        this._invalidate();
    }

    _checkAnimations() {
        if(this._fillAnimationActive) {
            if(this._frameTime - this._animationStart > LetterGrid.DURATION_FILL) {
                this._fillAnimationActive = false;
            }
            this._invalidate();
        }
        if(this._clearAnimationActive && this._frameTime - this._animationStart > LetterGrid.DURATION_CLEAR) {
            this._endClearAnimation();
        }
    }

    _getTile(x, y) {
        const col = Math.floor(x / this._tileSize);
        const row = Math.floor((this._canvas.height - y) / this._tileSize);
        if(col < 0 || col >= this._tiles.length || row < 0 || row >= this._tiles[col].length) {
            return null;
        }
        return this._tiles[col][row];
    }

    _clickTile(tile) {
        const selected = this._selectedTiles.indexOf(tile) > -1;
        if(!selected && this._isContiguous(tile)) {
            this._selectedTiles.push(tile);
            this._onTileChanged(tile);
        } else if(selected && tile == this._selectedTiles[this._selectedTiles.length - 1]) {
            this._selectedTiles.pop();
            this._onTileChanged(tile);
        }
    }

    _onTileChanged(tile) {
        if(this._cb) {
            this._cb(this._selectedTiles);
        }

        this._triggerSound(LetterGrid.SOUND_TILE_SELECTED);
        this._invalidate();
    }

    _isContiguous(tile) {
        if(this._selectedTiles.length == 0) {
            return true;
        }
        const prev = this._selectedTiles[this._selectedTiles.length - 1];
        return (tile.pos.y == prev.pos.y && Math.abs(tile.pos.x - prev.pos.x) == 1)
            || (tile.pos.x == prev.pos.x && Math.abs(tile.pos.y - prev.pos.y) == 1);
    }
}

LetterGrid.GRID_SIZE = 8;

LetterGrid.SOUND_GAME_START = 0;
LetterGrid.SOUND_TILE_SELECTED = 1;
LetterGrid.SOUND_WORD_ACCEPTED = 2;
LetterGrid.SOUND_WORD_REJECTED = 3;

LetterGrid.DURATION_FILL = 500;
LetterGrid.DURATION_CLEAR = 200;
