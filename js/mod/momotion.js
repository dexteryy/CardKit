
define('momotion', [
    'mo/lang',
    'dollar',
    'momotion/base',
    'momotion/tap',
    'momotion/swipe',
    'momotion/drag',
    'momotion/scroll'
], function(_, $, momoBase,
    momoTap, momoSwipe, momoDrag, momoScroll){

    _.mix(momoBase.Class.prototype, {
        bind: function(ev, handler, elm){
            $(elm || this.node).bind(ev, handler);
            return this;
        },
        unbind: function(ev, handler, elm){
            $(elm || this.node).unbind(ev, handler);
            return this;
        },
        trigger: function(e, ev){
            $(e.target).trigger(ev);
            return this;
        }
    });

    var lib = {
        tap: momoTap,
        swipe: momoSwipe,
        drag: momoDrag,
        scroll: momoScroll
    };

    var exports = {
        base: momoBase
    };

    for (var name in lib) {
        exports[name] = lib[name];
    }

    exports.init = function(elm, opt, cb){
        for (var name in lib) {
            exports[name](elm, opt, cb);
        }
    };

    return exports;

});
