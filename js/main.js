
require.config({
    baseUrl: 'js/',
    distUrl: 'dist/js/'
});

require([
    'mod/dollar', 
    'cardkits/app'
], function($, app){

    app.setup({
        viewport: $('.ck-viewport'),
        wrapper: $('.ck-wrapper'),
        cards: $('.ck-card')
    });

});
