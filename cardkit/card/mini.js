
define(function(require){

var darkdom = require('darkdom'),
    convert = require('mo/template/micro').convertTpl,
    helper = require('../helper'),
    render_hdwrap = convert(require('../tpl/scaffold/hdwrap').template),
    render_mini = convert(require('../tpl/mini').template),
    item = require('./item'),
    scaffold_components = require('./common/scaffold');

var exports = {

    item: item.item,

    mini: function(){
        var mini = darkdom({
            enableSource: true,
            render: function(data){
                data.hasSplitHd = true;
                data.hdwrap = render_hdwrap(data);
                var l = data.component.item.length;
                data.listWidth = l > 1 ? (l * 100 * 0.94 + '%') : '';
                data.itemWidth = Math.floor(1000/l)/10 + '%';
                return render_mini(data);
            }
        });
        mini.contain(scaffold_components);
        mini.contain('item', exports.item);
        helper.forwardUserEvents(mini);
        return mini;
    }

};

return exports;

});

