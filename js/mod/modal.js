define('modal', [
    'dollar',
    'mo/lang',
    'mo/network',
    'mo/template',
    'eventmaster',
    'uiproxy'
], function($, _, net, tpl, Event, uiproxy) {
    var body = $('body'),
        ID = 'modal-',

        LOADING_DOTS = '<span class="ui-inline-loading"><i>.</i><i>.</i><i>.</i></span>',

        TPL_MODAL =
           '<div id="{{id}}" class="modal-view">\
                <div class="modal-header">\
                    <div class="right-button">\
                    </div>\
                    <div class="left-button">\
                    </div>\
                    <h1 class="modal-title">\
                    </h1>\
                </div>\
                <div class="modal-content"></div>\
            </div>',
        TPL_BTN = '<a class="btn {{type}}">{{text}}</a>';

    var _mid = 0;

    var defaults = {
        title: '',
        buttons: [{
            text: '确定',
            type: 'primary',
            align: 'right',
            method: function(modal) {
                modal.submit(function() {
                    modal.close();
                });
                modal.loading('提交中');
            }
        }, {
            text: '取消',
            align: 'left',
            method: function(modal) {
                modal.close();
            }
        }],
        content: '',
        url: '',
        //TODO: remove async, use url
        async: undefined,
        event: {}
    };

    function Modal(opt) {
        this.id = ID + (_mid++);
        this.event = Event();
        this.config = _.mix({}, defaults, opt);

        body.append(tpl.format(TPL_MODAL, {id: this.id}));
        this.node = $('#' + this.id);
        this.title = this.node.find('.modal-title');
        this.rightButton = this.node.find('.right-button');
        this.leftButton = this.node.find('.left-button');
        this.content = this.node.find('.modal-content');

        this.set(this.config);
    }

    Modal.prototype = {
        set: function(opt) {
            var self = this;

            this.config = _.mix(this.config, opt);

            // Buttons
            if (opt.buttons && opt.buttons.length > 0) {
                opt.events = opt.events || {};
                opt.buttons.forEach(function(btn) {
                    var btnEvent = 'click .' + btn.align + '-button .btn';
                    self[btn.align + 'Button'].html(function() {
                        var btnType = btn.type !== undefined ?
                                ('btn-' + btn.type) :  '';
                        return tpl.format(TPL_BTN, {
                            type: btnType,
                            text: btn.text
                        });
                    });
                    opt.events[btnEvent] = btn.method;
                });
            }

            // Title
            if (typeof opt.title === 'string') {
                this.title.html(opt.title);
            }

            // Content
            if (opt.async) {
                var asyncOpt = _.mix({
                        success: function(content, modal) {
                            modal.set({'content': content});
                        }
                    }, opt.async);

                asyncOpt.success = function(data) {
                    asyncOpt.success(data, self);
                };
                net.ajax(asyncOpt);
            } else if (opt.content) {
                this.content.empty().append($(opt.content));
            }

            // Events
            this.bind(opt.events);

            return this;
        },
        bind: function(events) {
            uiproxy.bind(this.node, events);
        },
        unbind: function(events) {
            uiproxy.unbind(this.node, events);
        },
        loading: function(opt) {
            var text;
            if (typeof opt === 'string') {
                text = opt;
                opt = null;
            } else if (typeof opt == 'object') {
                text = opt.text;
            }
            this.title.html(text + LOADING_DOTS);

            return this;
        },
        open: function() {
            //TODO: fx
            this.node.appendTo(body).show();
            this.event.fire('open', [this]);

            return this;
        },
        close: function() {
            //TODO: fx
            this.node.hide();
            this.event.fire('close', [this]);

            return this;
        },
        destroy: function() {
            this.node.remove();
            this.event.fire('destroy', [this]);

            return this;
        },
        submit: function(opt) {
            var self = this,
                form = this.node.find('form')[0],
                success = _.isFunction(opt) ? opt : opt.success,
                error = _.isFunction(opt) ? undefined : opt.error;

            if (form === undefined) {
                return;
            }
            net.ajax({
                type: form.method,
                data: $(form).serialize(),
                success: success,
                error: error
            });

            return this;
        }
    };

    return function(opt) {
        return new Modal(opt);
    };
});
