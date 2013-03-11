
define('momotion/tap', [
    'mo/lang',
    'momotion/base'
], function(_, momoBase){

    var MomoTap = _.construct(momoBase.Class);

    _.mix(MomoTap.prototype, {

        EVENTS: ['tap', 'doubletap', 'hold'],
        DEFAULT_CONFIG: {
            'tapRadius': 10,
            'doubleTimeout': 300,
            'holdThreshold': 500
        },

        press: function(e){
            var t = e.touches[0];
            this._startTime = e.timeStamp;
            this._startTarget = t.target;
            this._startPosX = t.clientX;
            this._startPosY = t.clientY;
            this._movePosX = this._movePosY = this._moveTarget = NaN;
        },

        move: function(e){
            var t = e.touches[0];
            this._moveTarget = t.target;
            this._movePosX = t.clientX;
            this._movePosY = t.clientY;
        },

        release: function(e){
            var self = this,
                tm = e.timeStamp;
            if (this._moveTarget && this._moveTarget !== this._startTarget 
                    || Math.abs(self._movePosX - self._startPosX) > self._config.tapRadius
                    || Math.abs(self._movePosY - self._startPosY) > self._config.tapRadius) {
                return;
            }
            if (tm - self._startTime > self._config.holdThreshold) {
                self.trigger(e, self.event.hold);
            } else {
                if (self._lastTap 
                        && (tm - self._lastTap < self._config.doubleTimeout)) {
                    e.preventDefault();
                    self.trigger(e, self.event.doubletap);
                    self._lastTap = 0;
                } else {
                    self.trigger(e, self.event.tap);
                    self._lastTap = tm;
                }
            }
        }
    
    });

    function exports(elm, opt, cb){
        return new exports.Class(elm, opt, cb);
    }

    exports.Class = MomoTap;

    return exports;

});
