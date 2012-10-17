
require.config({
    baseUrl: 'js/',
    distUrl: 'dist/js/'
});

require([
    'mod/dollar', 
    'cardkit/app'
], function($, app){

    app.setup({
        viewport: $('.ck-viewport'),
        wrapper: $('.ck-wrapper'),
        cards: $('.ck-card')
    });

});
