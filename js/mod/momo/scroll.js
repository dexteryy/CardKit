
define('momo/scroll', [
    'mo/lang',
    'momo/base'
], function(_, momoBase){

    var MomoScroll = _.construct(momoBase.Class);

    _.mix(MomoScroll.prototype, {

        EVENTS: [
            'scrolldown', 
            'scrollup', 
            'scrollright', 
            'scrollleft', 
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

        checkScollDirection: function(x, y){
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
            d = x - this._lastX;
            if (d < 0 - threshold) {
                if (this._scrollRight !== true) {
                    this.trigger(node, this.event.scrollright);
                }
                this._lastX = x;
                this._scrollRight = true;
            } else if (d > threshold) {
                if (this._scrollRight !== false) {
                    this.trigger(node, this.event.scrollleft);
                }
                this._lastX = x;
                this._scrollRight = false;
            }
        },

        press: function(e){
            var self = this,
                t = this.SUPPORT_TOUCH ? e.touches[0] : e;
            self._scrollDown = null;
            self._scrollRight = null;
            self._lastY = t.clientY;
            self._lastX = t.clientX;
            self._scrollY = null;
            self._scrollX = null;
            if (self.scrollingNode) {
                var scrolling = self._scrolling;
                self._scrolling = false;
                var tm = self._tm = e.timeStamp;
                self.once(self.MOVE, function(){
                    self.once('scroll', function(){
                        if (tm === self._tm) {
                            self._scrollY = self.scrollingNode.scrollTop;
                            self._scrollX = self.scrollingNode.scrollLeft;
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
            var t = this.SUPPORT_TOUCH ? e.touches[0] : e;
            this.checkScollDirection(t.clientX, t.clientY);
            //this._lastY = t.clientY;
            if (this.scrollingNode) {
                this._scrollY = this.scrollingNode.scrollTop;
                this._scrollX = this.scrollingNode.scrollLeft;
            }
        },

        release: function(e){
            var self = this, 
                t = this.SUPPORT_TOUCH ? e.changedTouches[0] : e,
                node = { target: self.node };
            // up/down
            this.checkScollDirection(t.clientX, t.clientY);
            // end
            var gap, wait_scroll, vp = self.scrollingNode;
            if (self._scrollY !== null) {
                gap = Math.abs(vp.scrollTop - self._scrollY);
                wait_scroll = 1;
                if (self._scrollY >= 0 && (self._scrollY <= vp.scrollHeight + vp.offsetHeight)
                        && (gap && gap < self._config.scrollEndGap)) {
                    self._started = false;
                    self.trigger(node, self.event.scrollend);
                } else {
                    wait_scroll = 2;
                }
                self._scrollY = null;
            } else if (self._scrollX !== null) {
                gap = Math.abs(vp.scrollLeft - self._scrollX);
                wait_scroll = 1;
                if (self._scrollX >= 0 && (self._scrollX <= vp.scrollWidth + vp.offsetWidth)
                        && (gap && gap < self._config.scrollEndGap)) {
                    self._started = false;
                    self.trigger(node, self.event.scrollend);
                } else {
                    wait_scroll = 2;
                }
                self._scrollX = null;
            } 
            if (wait_scroll === 2) {
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
            if (!wait_scroll && self._started) {
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
