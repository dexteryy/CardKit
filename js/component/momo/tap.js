/**
 * Momo (MoMotion)
 * A framework and a collection for separate and simple implementation of touch gestures
 * 
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define('momo/tap', [
    'mo/lang',
    'momo/base'
], function(_, momoBase){

    var MomoTap = _.construct(momoBase.Class);

    _.mix(MomoTap.prototype, {

        EVENTS: ['tap', 'doubletap', 'hold', 'tapstart', 'tapcancel'],
        DEFAULT_CONFIG: {
            'tapRadius': 10,
            'doubleTimeout': 300,
            'tapThreshold': 0,
            'holdThreshold': 500
        },

        press: function(e){
            var self = this,
                t = self.SUPPORT_TOUCH ? e.touches[0] : e;
            self._startTime = e.timeStamp;
            self._startTarget = t.target;
            self._startPosX = t.clientX;
            self._startPosY = t.clientY;
            self._movePosX = self._movePosY = self._moveTarget = NaN;
            self._started = false;
            self._pressTrigger = function(){
                self._started = true;
                self.trigger(e, self.event.tapstart);
                self._pressTrigger = nothing;
            };
            self._activeTimer = setTimeout(function(){
                if (!is_moved(self)) {
                    self._pressTrigger();
                }
            }, self._config.tapThreshold);
        },

        move: function(e){
            var t = this.SUPPORT_TOUCH ? e.touches[0] : e;
            this._moveTarget = t.target;
            this._movePosX = t.clientX;
            this._movePosY = t.clientY;
        },

        release: function(e){
            var self = this,
                tm = e.timeStamp,
                moved = is_moved(self);
            clearTimeout(self._activeTimer);
            if (moved || tm - self._startTime < self._config.tapThreshold) {
                if (!moved) {
                    self._firstTap = tm;
                }
                if (self._started) {
                    self.trigger(e, self.event.tapcancel);
                }
                return;
            }
            if (!self._started) {
                self._pressTrigger();
            }
            if (tm - self._startTime > self._config.holdThreshold + self._config.tapThreshold) {
                self.trigger(e, self.event.hold);
            } else {
                if (self._firstTap
                        && (tm - self._firstTap < self._config.doubleTimeout)) {
                    e.preventDefault();
                    self.trigger(e, self.event.doubletap);
                    self._firstTap = 0;
                } else {
                    self.trigger(e, self.event.tap);
                    self._firstTap = tm;
                }
            }
        },

        cancel: function(e){
            clearTimeout(this._activeTimer);
            if (this._started) {
                this.trigger(e, this.event.tapcancel);
            }
        }
    
    });

    function is_moved(self){
        if (self._moveTarget && self._moveTarget !== self._startTarget 
                || Math.abs(self._movePosX - self._startPosX) > self._config.tapRadius
                || Math.abs(self._movePosY - self._startPosY) > self._config.tapRadius) {
            return true;
        }
    }

    function nothing(){}

    function exports(elm, opt, cb){
        return new exports.Class(elm, opt, cb);
    }

    exports.Class = MomoTap;

    return exports;

});
