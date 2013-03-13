
define('momotion/scroll', [
    'mo/lang',
    'momotion/base'
], function(_, momoBase){

    var MomoScroll = _.construct(momoBase.Class);

    _.mix(MomoScroll.prototype, {

        EVENTS: [
            'scrolldown', 
            'scrollup', 
            'scrollstart', 
            'scrollend'
        ],
        DEFAULT_CONFIG: {
            'directThreshold': 5,
            'scrollEndGap': 5
        },

        watchScroll: function(elm){
            this.scrollingNode = elm;
        },

        checkScollDirection: function(y){
            var node = { target: this.node },
                d = y - this._lastY,
                threshold = this._config.directThreshold;
            if (d < 0 - threshold) {
                if (this._scrollDown !== true) {
                    this.trigger(node, this.event.scrolldown);
                }
                this._lastY = y;
                this._scrollDown = true;
            } else if (d > threshold) {
                if (this._scrollDown !== false) {
                    this.trigger(node, this.event.scrollup);
                }
                this._lastY = y;
                this._scrollDown = false;
            }
        },

        press: function(e){
            var self = this;
            var t = e.touches[0];
            self._scrollDown = null;
            self._lastY = t.clientY;
            self._scrollY = null;
            if (self.scrollingNode) {
                var scrolling = self._scrolling;
                self._scrolling = false;
                var tm = self._tm = e.timeStamp;
                self.once(self.MOVE, function(){
                    self.once('scroll', function(){
                        if (tm === self._tm) {
                            self._scrollY = self.scrollingNode.scrollTop;
                            if (!scrolling) {
                                self._started = true;
                                self.trigger({ target: self.node }, self.event.scrollstart);
                            }
                        }
                    }, self.scrollingNode);
                });
            }
        },

        move: function(e){
            var t = e.touches[0];
            this.checkScollDirection(t.clientY);
            //this._lastY = t.clientY;
            if (this.scrollingNode) {
                this._scrollY = this.scrollingNode.scrollTop;
            }
        },

        release: function(e){
            var self = this, 
                t = e.changedTouches[0],
                node = { target: self.node };
            // up/down
            this.checkScollDirection(t.clientY);
            // end
            if (self._scrollY !== null) {
                var vp = self.scrollingNode,
                    gap = Math.abs(vp.scrollTop - self._scrollY);
                if (self._scrollY >= 0 && (self._scrollY <= vp.scrollHeight + vp.offsetHeight)
                        && (gap && gap < self._config.scrollEndGap)) {
                    self._started = false;
                    self.trigger(node, self.event.scrollend);
                } else {
                    var tm = self._tm;
                    self._scrolling = true;
                    self.once('scroll', function(){
                        if (tm === self._tm) {
                            self._scrolling = false;
                            self._started = false;
                            self.trigger(node, self.event.scrollend);
                        }
                    }, vp);
                }
                self._scrollY = null;
            } else if (self._started) {
                self._started = false;
                self.trigger(node, self.event.scrollend);
            }
        }
    
    });

    function exports(elm, opt, cb){
        return new exports.Class(elm, opt, cb);
    }

    exports.Class = MomoScroll;

    return exports;

});
