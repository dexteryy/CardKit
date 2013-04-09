
define('dollar', [
    'dollar/android23'
], function($){
    return $;
});

require([
    'mo/lang',
    'dollar', 
    'mo/browsers',
    'momo',
    'mo/console'
], function(_, $, browsers, momo, console){

    console.config({
        output: $('#console')[0]
    }).enable();

    console.info('init', 3, navigator.userAgent);

    console.info('browsers', browsers);

    console.run(function(){
        return $('.btn1')[0];
    }, { showStack: true });

    var test = $('#test');

    console.run(function(){
        return test[0].dataset.a;
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

});

