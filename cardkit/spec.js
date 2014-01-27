
define(function(require){

    return {
        page: [require('./spec/page'), require('./card/page')],
        box: [require('./spec/box'), require('./card/box')],
        list: [require('./spec/list'), require('./card/list')],
    };

});
