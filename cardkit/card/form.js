
define(function(require){

var darkdom = require('darkdom'),
    convert = require('mo/template/micro').convertTpl,
    render_item = convert(require('../tpl/form/item').template),
    render_content = convert(require('../tpl/box/content').template),
    render_hdwrap = convert(require('../tpl/scaffold/hdwrap').template),
    render_form = convert(require('../tpl/form').template),
    scaffold_components = require('./common/scaffold');

var exports = {

    content: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_content
        });
    },

    item: function(){
        return darkdom({
            enableSource: true,
            render: render_item
        }).contain('content', exports.content, {
            content: true
        });
    },

    form: function(){
        var form = darkdom({
            enableSource: true,
            render: function(data){
                data.hasSplitHd = data.state.plainStyle === 'true'
                    || data.state.plainHdStyle === 'true';
                data.hdwrap = render_hdwrap(data);
                return render_form(data);
            }
        });
        form.contain(scaffold_components);
        form.contain('item', exports.item);
        return form;
    }

};

return exports;

});

