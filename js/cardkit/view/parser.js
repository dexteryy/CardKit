define([
    'dollar',
    'mo/lang',
    'mo/template',
    'tpl/items'
], function($, _, tpl, tpl_items){
    
    function exports(wrapper){

        var raw = wrapper.find('.ck-raw'),
            cards = wrapper.find('.ck-card'),
            listContents = wrapper.find('.ck-list');

        wrapper.find('.ck-list').forEach(function(list){
            list = $(list);
            var source = get_source(list);
            if (!source) {
                list.find('.ck-item').forEach(function(item){
                    item = $(item);
                    var source = get_source(item);
                    if (!source || !source[0]) {
                        return;
                    }
                    var link = item.find('.ck-link');
                    if (!link[0]) {
                        link = source.find('.ckd-link').clone();
                        link[0].className = 'ck-link';
                        //link.append()
                    } else {
                        var hd = source.find('.ckd-hd').html();
                        if (hd) {
                            item.find('.ck-link').html(hd.trim());
                        } else {
                            item.remove();
                        }
                    }
                });
            } else if (source[0]) {
                var items = source.find('.ckd-item').map(function(item){
                    var link = $('.ckd-link', item),
                        info = $('.ckd-info', item);
                    return {
                        href: link.attr('href'),
                        title: link.text(),
                        info: info.text()
                    };
                });
                if (!items.length) {
                    return;
                }
                list[0].innerHTML = tpl.convertTpl(tpl_items.template, {
                    items: items
                }, 'mod');
            }
        });

        wrapper.find('.ck-text').forEach(render_content);

        function render_content(mod){
            mod = $(mod);
            var source = get_source(mod);
            if (!source) {
                return mod.find('.ckd-content').forEach(render_content);
            } else if (!source[0]) {
                return;
            }
            var content = source.find('.ckd-content');
            if (!content[0]) {
                content = source.html();
                if (!/<\w+/.test(content)) {
                    return;
                }
            } else {
                content = content.clone();
            }
            if (mod.hasClass('ck-text')) {
                mod.empty().append(content);
            } else {
                mod.replaceWith(content);
            }
        }

        function get_source(me){
            var source_id = me.data('source');
            if (!source_id) {
                return false;
            }
            var source = raw.find('.' + source_id);
            return source;
        }

    }

    return exports;

});
