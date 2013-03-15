
require.config({
    baseUrl: 'js/mod/',
    distUrl: 'dist/js/mod/',
    aliases: {
        'cardkit': '../cardkit/'
    }
});

define('mo/lang/es5', [], function(){});
define('mo/mainloop', [], function(){});

require([
    'dollar', 
    'cardkit/app'
], function($, app){

    app.init({
        root: $('.ck-root')
    });

});
