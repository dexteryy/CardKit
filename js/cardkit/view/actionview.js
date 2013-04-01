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
        elm = $(elm);
        var id = elm[0][UID];
        if (id && lib[id]) {
            return lib[id].set(opt);
        }
        id = elm[0][UID] = ++uid;
        opt = opt || {};
        opt.className = 'ck-actionview';
        var view = lib[id] = actionView(opt);
        var eprops = {
            component: view
        };
        view.event.bind('open', function(view){
            exports.current = view;
            bus.fire('actionView:open', [view]);
            elm.trigger('actionView:open', eprops);
        }).bind('close', function(){
            elm.trigger('actionView:close', eprops);
        }).bind('confirm', function(view, picker){
            elm.trigger('actionView:confirm', eprops);
            if (picker._lastSelected) {
                var target = picker._lastSelected._node.attr('target');
                if (target) {
                    bus.fire('actionView:jump', [view, picker.val(), target]);
                }
            }
        }).bind('cancel', function(){
            elm.trigger('actionView:cancel', eprops);
        });
        return view;
    }

    return exports;

});
