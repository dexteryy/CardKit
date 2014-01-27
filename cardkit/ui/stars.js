define([
    'moui/slider',
    './util'
], function(slider, util) {

return util.singleton({

    flag: '_ckStarsUid',

    factory: function(elm){
        return slider(elm);
    },

    extend: function(o){
        o.event.bind('change', function() {
            var value = o.val();
            o.show(value);
        });
    }

});

});
