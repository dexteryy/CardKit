define([
    'mo/lang',
    'cardkit/bus',
    'cardkit/view'
], function(_, bus, view){

    var app = {

        setup: function(opt){
            view.init(opt);
        }
    
    };

    return app;

});
