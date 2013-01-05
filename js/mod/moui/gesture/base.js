
define('moui/gesture/base', [
    'mo/lang/es5',
    'mo/lang/type',
    'mo/lang/mix'
], function(es5, type, _){

    var isFunction = type.isFunction,
        gid = 0;

    function GestureBase(elm, opt, cb){
        if (isFunction(opt)) {
            cb = opt;
            opt = {};
        }
        this._listener = cb;
        var eid = cb && ++gid;
        this.event = {};
        this.EVENTS.forEach(function(ev){
            this[ev] = ev + (cb ? '_' + eid : '');
        }, this.event);
        this.node = elm;
        this._config = {
            event: this.EVENTS[0]
        };
        this.config(opt);
        this.enable();
    }

    GestureBase.prototype = {

        PRESS: 'touchstart',
        MOVE: 'touchmove',
        RELEASE: 'touchend',
        //CANCEL: 'touchcancel',

        EVENTS: [],
        DEFAULT_CONFIG: {},

        config: function(opt){
            _.merge(_.mix(this._config, opt), this.DEFAULT_CONFIG);
            return this;
        },

        enable: function(){
            var self = this;
            self.bind(self.PRESS, 
                    self._press || (self._press = self.press.bind(self)))
                .bind(self.MOVE, 
                    self._move || (self._move = self.move.bind(self)))
                //.bind(self.CANCEL, 
                    //self._cancel || (self._cancel = self.cancel.bind(self)))
                .bind(self.RELEASE, 
                    self._release || (self._release = self.release.bind(self)));
            if (self._listener) {
                self.bind(this.event[this._config.event], self._listener);
            }
            return self;
        },

        disable: function(){
            var self = this;
            self.unbind(self.PRESS, self._press)
                .unbind(self.MOVE, self._move)
                //.unbind(self.CANCEL, self._cancel)
                .unbind(self.RELEASE, self._release);
            if (self._listener) {
                self.unbind(this.event[this._config.event], self._listener);
            }
            return self;
        },

        once: function(ev, handler, node){
            var self = this;
            this.bind(ev, function(){
                self.unbind(ev, arguments.callee, node);
                handler.apply(this, arguments);
            }, node);
        },

        // implement

        bind: nothing,

        unbind: nothing,

        trigger: nothing,

        // extension

        press: nothing,

        move: nothing,

        release: nothing,

        cancel: nothing
    
    };

    function nothing(){}

    function exports(elm, opt, cb){
        return new exports.GestureBase(elm, opt, cb);
    }

    exports.GestureBase = GestureBase;

    return exports;

});
