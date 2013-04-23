define([
    'mo/lang',
    'dollar',
    'moui/actionview',
    '../bus'
], function(_, $, actionView, bus) {

    var UID = '_ckActionViewUid',
    
        uid = 0,
        lib = {};

    function exports(elm, opt){
        var id = elm;
        if (typeof elm === 'object') {
            elm = $(elm);
            id = elm[0][UID];
        } else {
            elm = false;
        }
        if (id && lib[id]) {
            return lib[id].set(opt);
        }
        if (elm) {
            id = elm[0][UID] = ++uid;
        }
        opt = opt || {};
        opt.className = 'ck-actionview';
        var view = lib[id] = actionView(opt);
        var eprops = {
            component: view
        };
        view.event.bind('open', function(view){
            exports.current = view;
            bus.fire('actionView:open', [view]);
            if (elm) {
                elm.trigger('actionView:open', eprops);
            }
        }).bind('prepareOpen', function(view){
            bus.fire('actionView:prepareOpen', [view]);
        }).bind('cancelOpen', function(view){
            bus.fire('actionView:cancelOpen', [view]);
        }).bind('close', function(){
            bus.fire('actionView:close', [view]);
            if (elm) {
                elm.trigger('actionView:close', eprops);
            }
        }).bind('cancel', function(){
            if (elm) {
                elm.trigger('actionView:cancel', eprops);
            }
        }).bind('confirm', function(view, picker){
            if (elm) {
                elm.trigger('actionView:confirm', eprops);
            }
            if (picker && picker._lastSelected) {
                var target = picker._lastSelected._node.attr('target');
                if (target) {
                    bus.fire('actionView:jump', [view, picker.val(), target]);
                }
            }
        });
        if (elm) {
        }
        return view;
    }

    return exports;

});
