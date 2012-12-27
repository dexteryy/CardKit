
define('moui/gesture/scroll', [
    'mo/lang',
    'moui/gesture/base'
], function(_, gesture){

    var ScrollGesture = _.construct(gesture.GestureBase);

    _.mix(ScrollGesture.prototype, {

        EVENTS: ['scrolldown', 'scrollup'],
        DEFAULT_CONFIG: {
            'directThreshold': 20
        },

        press: function(e){
            var t = e.touches[0];
            this._startY = t.clientY;
            this._moveY = NaN;
        },

        move: function(e){
            var t = e.touches[0];
            this._moveY = t.clientY;
        },

        release: function(e){
            var self = this;
            var d = self._moveY - self._startY,
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
