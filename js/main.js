
require.config({
    baseUrl: 'js/mod/',
    distUrl: 'dist/js/mod/',
    aliases: {
        'cardkit': '../cardkit/'
    }
});

//define('mo/lang/es5', [], function(){});
define('mo/easing/functions', [], function(){});
define('mo/mainloop', [], function(){});

define('cardkit/env', [], function(){
    return {};
});

define('cardkit/pageready', [
    'finish', 
    'cardkit/bus'
], function(finish, bus){
    bus.once('readycardchange', finish);
});

require([
    'dollar', 
    'cardkit/app',
    'cardkit/env'
], function($, app, env){

    if (env.enableConsole) {
        require(['mo/console'], function(console){
            console.config({
                output: $('#console')[0]
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
