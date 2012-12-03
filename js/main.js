
require.config({
    baseUrl: 'js/mod/',
    distUrl: 'dist/js/mod/',
    aliases: {
        'cardkit': '../cardkit/'
    }
});

require([
    'dollar', 
    'cardkit/app'
], function($, app){

    app.setup({
        viewport: $('.ck-viewport'),
        wrapper: $('.ck-wrapper'),
        cards: $('.ck-card')
    });

});
