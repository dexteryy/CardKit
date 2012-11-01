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

            console.info("log: ", 1, win_width); // log
            //opt.viewport.css({
                //'width': win_width,
                //'overflow': 'auto'
            //});

            //opt.wrapper.css({
                //'width': win_width * 15,
                //'overflow': 'hidden'
            //});

            opt.cards.each(function(){
                if (!/\S/.test(this.innerHTML)) {
                    $(this).remove();
                }
            }).css({
                'float': 'left',
                'overflow': 'hidden',
                'margin': 0
            }).css('width', function(){
                var me = $(this);
                return win_width - parseFloat(me.css('padding-left')) 
                    - parseFloat(me.css('padding-right'));
            });

            document.addEventListener("touchmove", function(e){
                //e.preventDefault();
            }, false);

        }
    
    };

    return view;

});
