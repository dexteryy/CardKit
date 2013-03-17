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
        opt = opt || {};
        opt.className = 'ck-actionview';
        var id = elm[0][UID];
        if (id && lib[id]) {
            return lib[id].set(opt);
        }
        id = elm[0][UID] = ++uid;
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
        }).bind('confirm', function(){
            elm.trigger('actionView:confirm', eprops);
        }).bind('cancel', function(){
            elm.trigger('actionView:cancel', eprops);
        });
        return view;
    }

    return exports;

});
