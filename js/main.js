
require.config({
    baseUrl: 'js/component/',
    distUrl: 'dist/js/component/',
    aliases: {
        'cardkit': '../cardkit/'
    }
});

//define('mo/lang/es5', [], function(){});
define('mo/easing/functions', [], function(){});
define('mo/mainloop', [], function(){});

define('cardkit/env', ['mo/browsers'], function(){
    return {};
});

define('cardkit/pageready', [
    'finish', 
    'cardkit/bus'
], function(finish, bus){
    bus.once('readycardchange', function(){
        setTimeout(finish, 500);
    });
});

require([
    'dollar', 
    'cardkit/bus',
    'cardkit/app',
    'cardkit/env'
], function($, bus, app, env){

    if (env.enableConsole) {
        require([
            'mo/console'
        ], function(console){

            console.config({
                record: true
            }).enable();

            init();

        });
    } else {
        init();
    }

    function init(){
        app.init({
            root: $('.ck-root')
        });
    }

});
