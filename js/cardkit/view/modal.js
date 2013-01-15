define([
    'moui/modalview'
], function(Modal) {

    var modal = Modal({
        buttons: ['cancel', 'confirm']
    });

    modal.done = function(){
        if (!history.state) {
            history.go(-2);
        } else {
            history.back();
        }
    };

    return modal;

});
