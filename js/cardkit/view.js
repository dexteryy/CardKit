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

            var a = $('<div id="yyyyyy">xxxx</div><span>xxx</span><span>zzzz</span>').appendTo(opt.viewport)
                .css({
                    'position': 'absolute',
                    'top': 10,
                    'left': 10,
                    'display': 'none',
                    'marginTop': 20
                })
            $('<div>222</div>').insertAfter($('#yyyyyy'))
            console.info($('#yyyyyy').nextAll('span'), $('#yyyyyy').next('div'))
            console.info(
                opt.wrapper.find('.ck-card').eq(0).nextUntil('[data-type=popup]'), 
                opt.wrapper.find('div').eq(0).nextUntil('[data-type=popup]', '.ck-card'), 
                $('#yyyyyy').siblings('div'))
            $('#yyyyyy').unwrap()
                .nextAll('span')
                .wrapAll('<div class="bbbbb"></div>')
                .wrap(function(i){
                        return '<div class="aaaaa"></div>'
                })
                .wrapInner('<p></p>')
            a.show();

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
