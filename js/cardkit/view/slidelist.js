
define([
    'mo/lang',
    'dollar',
    'choreo',
    'eventmaster',
    'momo/swipe'
], function(_, $, choreo, event, momoSwipe) {

    var UID = '_ckMiniUid',
    
        uid = 0,
        lib = {};

    var default_config = {
        items: '.item'
    };

    function Slidelist(elm, opt){
        this.init(elm, opt);
        this.set(this._config);
    }

    Slidelist.prototype = {

        _defaults: default_config,

        init: function(elm, opt){
            this.event = event();
            this._node = $(elm);
            this._items = [];
            opt = _.mix({}, this.data(), opt);
            this._config = _.config({}, opt, this._defaults);
        },

        set: function(opt){
            if (!opt) {
                return this;
            }
            _.mix(this._config, opt);

            if (opt.items) {
                this._items.forEach(this._removeItem, this);
                $(opt.items, this._node).forEach(this._addItem, this);
            }

            return this;
        },

        data: function(){
            return this._node.data();
        },

        _addItem: function(elm){
            elm = $(elm);
            var self = this;
            var item = {
                order: this._items.length,
                node: elm,
                swipeLeft: momoSwipe(elm[0], {
                    event: 'swipeleft'
                }, function(){
                    var n = item.order + 1;
                    if (n > self._items.length - 1) {
                        choreo().play().actor(self._node[0], {
                            'transform': 'translateX(-20px)'
                        }, 100, 'easeOut').follow().done(function(){
                            return choreo().play().actor(self._node[0], {
                                'transform': 'translateX(0px)'
                            }, 100, 'easeIn').follow();
                        });
                        return;
                        //n = 0;
                    }
                    var next = self._items[n].node;
                    next.addClass('moving');
                    choreo.transform(next[0], 'translateX', elm[0].offsetWidth + 'px');
                    choreo().play().actor(self._node[0], {
                        'transform': 'translateX(' + (0 - elm[0].offsetWidth) + 'px)'
                    }, 300, 'easeInOut').follow().done(function(){
                        choreo.transform(next[0], 'translateX', '0');
                        next.addClass('enable').removeClass('moving');
                        elm.removeClass('enable');
                        choreo.transform(self._node[0], 'translateX', '0');
                    });
                    self.event.fire('change', [n]);
                }),
                swipeRight: momoSwipe(elm[0], {
                    event: 'swiperight'
                }, function(){
                    var n = item.order - 1;
                    if (n < 0) {
                        choreo().play().actor(self._node[0], {
                            'transform': 'translateX(20px)'
                        }, 100, 'easeOut').follow().done(function(){
                            return choreo().play().actor(self._node[0], {
                                'transform': 'translateX(0px)'
                            }, 100, 'easeIn').follow();
                        });
                        return;
                        //n = self._items.length - 1;
                    }
                    var next = self._items[n].node;
                    next.addClass('moving');
                    choreo.transform(next[0], 'translateX', 0 - elm[0].offsetWidth + 'px');
                    choreo().play().actor(self._node[0], {
                        'transform': 'translateX(' + elm[0].offsetWidth + 'px)'
                    }, 300, 'easeInOut').follow().done(function(){
                        choreo.transform(next[0], 'translateX', '0');
                        next.addClass('enable').removeClass('moving');
                        elm.removeClass('enable');
                        choreo.transform(self._node[0], 'translateX', '0');
                    });
                    self.event.fire('change', [n]);
                })
            };
            this._items.push(item);
        },

        _removeItem: function(item){
            item.swipeLeft.disable();
            item.swipeRight.disable();
            this._items.splice(this._items.indexOf(item), 1);
        }
    
    };

    function exports(elm, opt){
        elm = $(elm);
        var id = elm[0][UID];
        if (id && lib[id]) {
            return lib[id];
        }
        id = elm[0][UID] = ++uid;
        opt = opt || {};
        opt.items = '.ck-item';
        var slide = lib[id] = new exports.Slidelist(elm, opt);
        return slide;
    }

    exports.Slidelist = Slidelist;

    return exports;

});
