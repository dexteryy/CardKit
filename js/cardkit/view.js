define([
    'mod/dollar',
    'mod/lang',
    'mod/template',
    'cardkit/bus'
], function($, _, tpl, bus){

    var view = {

        init: function(opt){

            var win = $(window),
                win_width = win.width();

            opt.viewport.css({
                'width': win_width,
                'overflow': 'auto'
            });

            opt.wrapper.css({
                'width': win_width * 15,
                'overflow': 'hidden'
            });

            opt.cards.css({
                'width': win_width,
                'height': 10000,
                'float': 'left',
                'overflow': 'hidden',
                'margin': 0
            });

            document.addEventListener("touchmove", function(e){
                //e.preventDefault();
            }, false);

        }
    
    };

    return view;

});
