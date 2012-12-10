define([
    'dollar',
    'mo/lang',
    'mo/template',
    'cardkit/bus',
    'cardkit/view/modal',
    'iscroll-lite',
    'mo/domready'
], function($, _, tpl, bus, modal, iScroll){

    var view = {

        init: function(opt){
            var win = $(window),
                //win_width = win.width(),
                //win_height = win.height(),
                header = $('.ck-header'),
                viewport = this.viewport = $('.ck-viewport');
            this.piles = $('.ck-pile', viewport);
            this.cards = $('.ck-card', viewport);

            if (header.length === 0) {
                return;
            }

            this.render();

            var currentY,
                direction,
                count = 0,
                _abs = Math.abs,
                header_height = header.height();
            document.addEventListener('touchmove', function (e) {
                e.preventDefault(); 
                var y = e.touches[0].pageY;
                direction = y - currentY;
                currentY = y;
                if (direction > 0) {
                    if (direction > 50) {
                        count = 10;
                    } else {
                        if (count < 0) {
                            count = 0;
                        }
                        count++;
                    }
                } else if (direction < 0) {
                    if (direction < -50) {
                        count = 10;
                    } else {
                        if (count > 0) {
                            count = 0;
                        }
                        count--;
                    }
                }
                if (_abs(count) === 10) {
                    if (direction > 0) {
                        header.css('top', 0);
                    } else {
                        header.css('top', 0 - header_height + 'px');
                    }
                }
            }, false);

            this.scroll = new iScroll(viewport[0], {
                hScroll: false,
                hScrollbar: false
            });
        },

        render: function(){
            this.cards.find('.ck-link').forEach(function(item){
                item = $(item);
                var target_id = item.attr('href').replace(/^.*#/, ''),
                    hd = $('#' + target_id).find('.ck-hd').html();
                if (hd) {
                    item.html(hd.trim());
                } else {
                    var card = item.parent().parent();
                    item.parent().remove();
                    if (!/\S/.test(card.html())) {
                        card.remove();
                    }
                }
            });
        }

    };

    view.modal = modal;

    return view;

});
