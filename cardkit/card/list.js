
define(function(require){

var darkdom = require('darkdom'),
    convert = require('mo/template/micro').convertTpl,
    helper = require('../helper'),
    render_hdwrap = convert(require('../tpl/scaffold/hdwrap').template),
    render_list = convert(require('../tpl/list').template),
    item = require('./item'),
    scaffold_components = require('./common/scaffold');

var exports = {

    item: item.item,

    list: function(){
        var list = darkdom({
            enableSource: true,
            render: function(data){
                var s = data.state;
                data.hasSplitHd = s.plainStyle === 'true' 
                    || s.plainHdStyle === 'true'
                    || s.subtype === 'split';
                data.hdwrap = render_hdwrap(data);
                return render_list(data);
            }
        });
        list.contain(scaffold_components);
        list.contain('item', exports.item);
        helper.forwardUserEvents(list);
        return list;
    }

};

return exports;

});

