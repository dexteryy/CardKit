
define(['mo/browsers'], function(browsers){

    var div = document.createElement('div');

    var exports = {
        touch: browsers.isTouch,
        overflowScroll: "webkitOverflowScrolling" in document.body.style,
        JSON: !!window.JSON,
        dataset: 'dataset' in div
    };

    return exports;

});

