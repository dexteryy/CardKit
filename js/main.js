
require.config({
    baseUrl: 'js/mod/',
    distUrl: 'dist/js/mod/',
    aliases: {
        'cardkit': '../cardkit/'
    }
});

define('iscroll-lite.src', 'iscroll-lite.js');
define('iscroll-lite', ['iscroll-lite.src'], function(){
    return window.iScroll;
});

require([
    'dollar', 
    'cardkit/app'
], function($, app){

    app.setup({
        header: $('.ck-header'),
        viewport: $('.ck-viewport')
    });

});
