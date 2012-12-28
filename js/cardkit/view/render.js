
define([
    'dollar',
    'mo/lang',
    'mo/template',
    '../tpl/box',
    '../tpl/list',
    '../tpl/mini',
    '../tpl/form',
    '../parser/box',
    '../parser/list',
    '../parser/mini',
    '../parser/form'
], function($, _, tpl, 
    tpl_box, tpl_list, tpl_mini, tpl_form,
    boxParser, listParser, miniParser, formParser){

    function exports(wrapper) {

        var raw = wrapper.find('.ck-raw');

        wrapper.find('.ck-cell-box').forEach(function(cell){
            var data = boxParser(cell, raw);
            if (data.content) {
                cell.innerHTML = tpl.convertTpl(tpl_box.template, data, 'data');
            }
        });

        wrapper.find('.ck-cell-list').forEach(function(cell){
            var data = listParser(cell, raw);
            if (data.config.limit) {
                data.items.length = data.config.limit;
            }
            if (data.items.length) {
                cell.innerHTML = tpl.convertTpl(tpl_list.template, data, 'data');
            }
        });

        var footer = wrapper.find('.ck-footer');
        wrapper.find('.ck-card').forEach(function(card){
            this.clone().appendTo(card);
        }, footer);
        footer.remove();

    }

    return exports;

});
