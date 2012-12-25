define([
    'dollar',
    'mo/lang',
    'mo/template'
], function($, _, tpl){
    
    function exports(wrapper){

        var cards = $('.ck-card', wrapper),
            listContents = $('.ck-list', wrapper);

        listContents.find('.ck-link').forEach(function(item){
            item = $(item);
            var target_id = (item.attr('href')
                    .replace(location.href, '')
                    .match(/^#(.+)/) || [])[1],
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

    return exports;

});
