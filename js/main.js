
require.config({
    baseUrl: 'js/mod/',
    distUrl: 'dist/js/mod/',
    aliases: {
        'cardkit': '../cardkit/'
    }
});

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
