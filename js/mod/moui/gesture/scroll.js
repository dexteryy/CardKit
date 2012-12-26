
define('moui/gesture/scroll', [
    'mo/lang',
    'moui/gesture/base'
], function(_, gesture){

    var ScrollGesture = _.construct(gesture.GestureBase, function(elm, opt, cb){
        this._startPos = { x: 0, y: 0 };
        this._movePos = { x: 0, y: 0 };
        return this.superConstructor(elm, opt, cb);
    });

    _.mix(ScrollGesture.prototype, {

        EVENTS: ['scrolldown', 'scrollup'],
        DEFAULT_CONFIG: {
            'directThreshold': 20
        },

        press: function(e){
            this._startTime = +new Date();
            var t = e.touches[0];
            this._startPos.y = t.clientY;
            this._movePos.y = 0;
        },

        move: function(e){
            var t = e.touches[0];
            this._movePos.y = t.clientY;
        },

        release: function(e){
            var self = this;
            var d = self._movePos.y - self._startPos.y,
                threshold = this._config.directThreshold;
            if (d < 0 - threshold) {
                self.trigger(e, self.event.scrolldown);
            } else if (d > threshold) {
                self.trigger(e, self.event.scrollup);
            }
        }
    
    });

    function exports(elm, opt, cb){
        return new exports.ScrollGesture(elm, opt, cb);
    }

    exports.ScrollGesture = ScrollGesture;

    return exports;

});
