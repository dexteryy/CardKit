
define('dollar', [
    'dollar/android23'
], function($){
    return $;
});

define('history.src', 'history.js');
define('history', [
   'dollar', 
   'history.src', 
   'mo/domready'
], function($){
    var History = this.History;
    History.Adapter = $;
    History.Adapter.onDomLoad = function(fn){
        fn();
    };
    History.init();
    return History;
});

require([
    'mo/lang',
    'dollar', 
    'mo/browsers',
    'momo',
    'history',
    'mo/console'
], function(_, $, browsers, momo, History, console){

    console.config({
        output: $('#console')[0]
    }).enable();

    console.info('init', 3, navigator.userAgent, location, document);

    console.info('browsers', browsers);

    console.run(function(){
        return $('.btn1')[0];
    }, { showStack: true });

    var test = $('#test');

    console.run(function(){
        return test[0].dataset.a;
    });
    console.run(function(){
        return Array.prototype.push.apply([], test);
    });
    console.run(function(){
        return Array.prototype.push.apply($(), test);
    });
    console.run(function(){
        return Array.prototype.push.apply([], test[0].children);
    });
    console.run(function(){
        return Array.prototype.slice.call(test[0].children);
    });
    console.run(function(){
        return Array.prototype.push.apply([], Array.prototype.slice.call(test[0].children));
    });
    console.run(function(){
        return test[0].getAttribute('data-a');
    });
    console.run(function(){
        return test[0]['data-a'];
    });
    console.run(function(){
        return test[0].classList.contains;
    });
    console.run(function(){
        return document.defaultView.getComputedStyle(test[0], '').getPropertyValue('padding-top');
    });
    console.run(function(){
        return typeof function(){}.bind;
    });

    momo.init(document);

    //$(document).bind('tap', function(e){
        //console.info(e)
    //});

    $('.btn1').bind('click', function(){
        console.info('before toggleClass: ', test[0].className);
        test.toggleClass('yy');
        console.info('after toggleClass: ', test[0].className);
    });

    $('.btn2').bind('click', function(){
        test.data('enable-url', 1);
    });

    $('.btn3').bind('click', function(){
        test.data('enableUrl', 2);
    });

    $('.btn4').bind('click', function(){
        console.info('data: ', test.data());
        console.info('data("enable-url"): ', test.data('enable-url'));
        console.info('data("enableUrl"): ', test.data('enableUrl'));
    });

    var n = 0;

    $('.btn5').bind('click', function(){
        push_history();
    });

    $(window).bind("popstate", function(e){
        console.warn('popstate', e, e.state, history, history.state);
    });

    console.warn('init history', history, history.state);

    //if (History.enabled) {
    
        //$(window).bind("statechange", function(){
            //var state = History.getState();
            //console.warn('statechange', state, state.data);
        //});

        //console.warn('init History', History, History.getState().data);

    //}

    function push_history(){
        var data = {
            prev: n,
            next: ++n,
            i: history.length
        };
        history.pushState(_.mix({}, data), document.title, location.href);
        console.warn('push history', history, history.state);
        //if (History.enabled) {
            //History.pushState(_.mix({}, data), document.title, location.href);
            //console.warn('push History', History, History.getState().data);
        //}
    }

});

