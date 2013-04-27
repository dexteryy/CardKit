define([
    'mo/browsers'
], function(browsers){

    var window = this,
        history = window.history,
        document = window.document,
        body = document.body,
        is_ios5 = browsers.engine === 'webkit' 
            && parseInt(browsers.engineversion, 10) < 536,
        is_desktop = browsers.os === 'mac'
            || browsers.os === 'windows'
            || browsers.os === 'linux';

    var exports = {
    
        HISTORY: 'pushState' in history
            && !browsers.crios 
            && !browsers.aosp
            && !is_ios5,

        NEW_WIN: !is_ios5 && !browsers.aosp,

        SAFARI_OVERFLOWSCROLL: "webkitOverflowScrolling" in body.style,

        SAFARI_TOPBAR: !!browsers.mobilesafari

    };

    exports.PREVENT_CACHE = !exports.HISTORY 
        && !!(browsers.aosp || browsers.mobilesafari);

    exports.OVERFLOWSCROLL = exports.HISTORY
        && !browsers.aosp 
        && !is_ios5
        && !is_desktop;

    return exports;

});
