define([
    'mod/lang',
    'cardkits/bus',
    'cardkits/view'
], function(_, bus, view){

    var app = {

        setup: function(opt){
            view.init(opt);
        }
    
    };

    return app;

});
