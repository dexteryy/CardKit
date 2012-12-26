
require.config({
    baseUrl: 'js/mod/',
    distUrl: 'dist/js/mod/',
    aliases: {
        'tpl': '../tpl/',
        'cardkit': '../cardkit/'
    }
});

define('mo/lang/es5', [], function(){});
define('mo/mainloop', [], function(){});

require([
    'dollar', 
    'cardkit/app'
], function($, app){

    app.setup({
        header: $('.ck-header'),
        wrapper: $('.ck-wrapper')
    });

});
