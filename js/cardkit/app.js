define([
    'mo/lang',
    './bus',
    './view'
], function(_, bus, view){

    var app = {

        setup: function(opt){

            view.init(opt);

        }
    
    };

    return app;

});
