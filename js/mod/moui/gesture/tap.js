
define('moui/gesture/tap', [
    'mo/lang',
    'moui/gesture/base'
], function(_, gesture){

    var TapGesture = _.construct(gesture.GestureBase, function(elm, opt, cb){
        this._startPos = { x: 0, y: 0 };
        this._movePos = { x: 0, y: 0 };
        return this.superConstructor(elm, opt, cb);
    });

    _.mix(TapGesture.prototype, {

        EVENTS: ['tap', 'doubletap', 'hold'],
        DEFAULT_CONFIG: {
            'tapRadius': 20,
            'doubleTimeout': 300,
            'holdThreshold': 500
        },

        press: function(e){
            clearTimeout(this._doubleTimer);
            this._startTime = +new Date();
            var t = e.touches[0];
            this._startPos.x = t.screenX;
            this._startPos.y = t.screenY;
            this._movePos.x = 0;
            this._movePos.y = 0;
        },

        move: function(e){
            var t = e.touches[0];
            this._movePos.x = t.screenX;
            this._movePos.y = t.screenY;
        },

        release: function(e){
            var self = this,
                is_double = self._isDouble,
                d = +new Date();
            self._isDouble = false;
            if (self._movePos.x - self._startPos.x > self._config.tapRadius
                    || self._movePos.y - self._startPos.y > self._config.tapRadius) {
                return;
            }
            if (d - self._startTime > self._config.holdThreshold) {
                self.trigger(e, self.event.hold);
            } else {
                if (is_double) {
                    self.trigger(e, self.event.doubletap);
                } else {
                    self.trigger(e, self.event.tap);
                    self._isDouble = true;
                    self._doubleTimer = setTimeout(function(){
                        self._isDouble = false;
                    }, 300);
                }
            }
        }
    
    });

    function exports(elm, opt, cb){
        return new exports.TapGesture(elm, opt, cb);
    }

    exports.TapGesture = TapGesture;


    return exports;

});
