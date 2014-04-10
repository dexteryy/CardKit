
define(['mo/browsers'], function(browsers){

    var exports = {
        touch: browsers.isTouch,
        webview: browsers.webview,
        noBugWhenFixed: browsers.os !== 'android'
            || browsers.shell !== 'ucbrowser'
    };

    return exports;

});

