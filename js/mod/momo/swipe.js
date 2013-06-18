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
define('momo/swipe', [
    'mo/lang',
    'momo/base'
], function(_, momoBase){

    var MomoSwipe = _.construct(momoBase.Class);

    _.mix(MomoSwipe.prototype, {

        EVENTS: [
            'swipeup',
            'swipedown',
            'swiperight',
            'swipeleft'
        ],
        DEFAULT_CONFIG: {
            'timeThreshold': 200,
            'distanceThreshold': 20
        },

        press: function(e) {
            var t = this.SUPPORT_TOUCH ? e.touches[0] : e;
            this._startX = t.clientX;
            this._startY = t.clientY;
            this._moveX = NaN;
            this._moveY = NaN;
            this._startTime = e.timeStamp;
        },

        move: function(e) {
            var t = this.SUPPORT_TOUCH ? e.touches[0] : e;
            this._moveX = t.clientX;
            this._moveY = t.clientY;
        },

        release: function(e) {
            var self = this,
                startPos = {
                    x: self._startX,
                    y: self._startY
                },
                movePos = {
                    x: self._moveX,
                    y: self._moveY
                },
                distance = get_distance(startPos, movePos),
                direction = get_direction(startPos, movePos),
                touchTime = e.timeStamp - self._startTime;

            if (touchTime < self._config.timeThreshold &&
                    distance > self._config.distanceThreshold) {
                self.trigger(e, self.event['swipe' + direction]);
            }
        }

    });

    function get_distance(pos1, pos2) {
        var x = pos2.x - pos1.x,
            y = pos2.y - pos1.y;
        return Math.sqrt((x * x) + (y * y));
    }

    function get_angle(pos1, pos2) {
        return Math.atan2(pos2.y - pos1.y, pos2.x - pos1.x) * 180 / Math.PI;
    }

    function get_direction(pos1, pos2) {
        var angle = get_angle(pos1, pos2);
        var directions = {
            down: angle >= 45 && angle < 135, //90
            left: angle >= 135 || angle <= -135, //180
            up: angle < -45 && angle > -135, //270
            right: angle >= -45 && angle <= 45 //0
        };

        var direction, key;
        for(key in directions){
            if(directions[key]){
                direction = key;
                break;
            }
        }
        return direction;
    }

    function exports(elm, opt, cb){
        return new exports.Class(elm, opt, cb);
    }

    exports.Class = MomoSwipe;

    return exports;

});
