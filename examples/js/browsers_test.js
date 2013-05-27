
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
    'soviet',
    'history',
    'mo/console'
], function(_, $, browsers, momo, soviet, History, console){

    console.config({
        output: $('#console')[0]
    }).enable();

    console.info('init', 3, navigator.userAgent, location, document);

    console.info('browsers', browsers);

    var soviet_aliases = {};
    var momoTapEvents = momo.tap(document, {
        namespace: 'ck_'
    }).event;
    set_aliases_for_momo(momoTapEvents);
    function set_aliases_for_momo(momoEvents) {
        for (var ev in momoEvents) {
            $.Event.aliases[ev] = soviet_aliases[ev] = momoEvents[ev];
        }
    }

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

    $('.btn6').bind('click', add_hash);

    $('.btn7').bind('click', replace_hash);

    $(window).bind("hashchange", function(){
        console.warn('hashchange', location.hash);
    });

    //add_hash();
    setTimeout(function(){
        //location.href = location.href.replace(/#.*/, '') + '?a=1'
        //add_hash();
    }, 1000);

    //$(window).bind('touchstart', function(){
        //add_hash();
        //$(window).unbind('touchstart', arguments.callee)
    //});

    function add_hash(){
        alert(history.length)
        location.href = location.href.replace(/#(.*)|$/, '#$1' + '!/' + 'cardid');
        alert(history.length)
    }

    function replace_hash(){
        alert(history.length + ', ' + location.href)
        location.replace(location.href.replace(/#(.*)|$/, '#$1' + '*/' + 'cardid'))
        alert(history.length + ', ' + location.href)
    }

    $('.btn8').bind('click', function(){
        alert(history.length)
        history.back();
    });

    $('.btn9').bind('click', function(){
        alert(history.length)
        history.back();
        $(window).bind("hashchange", function(){
            setTimeout(function(){
                alert(history.length)
                history.back();
            }, 500)
        });
    });

    soviet(document, {
        aliasEvents: soviet_aliases,
        matchesSelector: true,
        preventDefault: true
    }).on('tap', {
        '.btn10': function(e){
            alert('tap: ' + e.type)
        }
    });

});

