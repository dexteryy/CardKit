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
define('momo/drag', [
    'mo/lang',
    'momo/base'
], function(_, momoBase){

    var MomoDrag = _.construct(momoBase.Class);

    _.mix(MomoDrag.prototype, {

        EVENTS: [
            'drag',
            'dragover',
            'dragstart',
            'dragend'
        ],
        DEFAULT_CONFIG: {
            'dragThreshold': 200
        },

        checkDrag: function(){
            if (this._holding) {
                this._holding = false;
                clearTimeout(this._startTimer);
            }
        },

        press: function(e){
            var self = this,
                t = self.SUPPORT_TOUCH ? e.touches[0] : e,
                src = t.target;
            //if (src.getAttribute('draggable') !== 'true') {
                //return;
            //}
            self._srcTarget = false;
            self._holding = true;
            self._startTimer = setTimeout(function(){
                self._holding = false;
                self._srcTarget = src;
                self.trigger(_.copy(t), self.event.dragstart);
            }, self._config.dragThreshold);
        },

        move: function(e){
            this.checkDrag();
            if (!this._srcTarget) {
                return;
            }
            var t = this.SUPPORT_TOUCH ? e.touches[0] : e;
            this.trigger(_.merge({ 
                target: this._srcTarget 
            }, t), this.event.drag);
            this.trigger(_.copy(t), this.event.dragover);
        },

        release: drag_end,

        cancel: drag_end

    });

    function drag_end(e){
        this.checkDrag();
        if (!this._srcTarget) {
            return;
        }
        var t = this.SUPPORT_TOUCH ? e.changedTouches[0] : e;
        this.trigger(_.merge({ 
            target: this._srcTarget 
        }, t), this.event.dragend);
        this._srcTarget = false;
    }

    function exports(elm, opt, cb){
        return new exports.Class(elm, opt, cb);
    }

    exports.Class = MomoDrag;

    return exports;

});
