define([
    'mo/browsers'
], function(browsers){

    var window = this,
        history = window.history,
        document = window.document,
        body = document.body;

    var exports = {
    
        HISTORY: 'pushState' in history
            && !browsers.crios 
            && !browsers.aosp
            && !(browsers.engine === 'webkit' 
                && parseInt(browsers.engineversion, 10) < 536), // ios5

        OVERFLOWSCROLL: !browsers.aosp 
            && "webkitOverflowScrolling" in body.style,

        SAFARI_TOPBAR: browsers.mobilesafari

    };

    exports.PREVENT_CACHE = !exports.HISTORY 
        && (browsers.aosp || browsers.mobilesafari);

    return exports;

});
