define([
    'moui/modalview'
], function(Modal) {

    var modal = Modal({
        buttons: [{
            type: 'cancel',
            method: function(modal){
                modal.event.fire('cancel', [modal]);
                history.back();
            }
        }, {
            type: 'confirm',
            method: function(modal){
                modal.event.fire('confirm', [modal]);
                modal.submit(function() {
                    modal.hideLoading();
                    history.back();
                });
                modal.showLoading('提交中');
            }
        }]
    });

    return modal;

});
