
require.config({
    baseUrl: 'js/mod/',
    distUrl: 'dist/js/mod/',
    aliases: {
        'cardkit': '../cardkit/'
    }
});

define('mo/lang/es5', [], function(){});
define('mo/mainloop', [], function(){});

define('env', [], function(){
    return {};
});

require([
    'dollar', 
    'cardkit/app',
    'env'
], function($, app, env){

    if (env.enableConsole) {
        require(['mo/console'], function(console){
            init();
            console.config({
                output: $('#console')[0]
            }).enable();
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
