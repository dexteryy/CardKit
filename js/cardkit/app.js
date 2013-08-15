/**
 * vim: et:ts=4:sw=4:sts=4
 */
define([
    'dollar',
    'mo/lang',
    'mo/browsers',
    'mo/cookie',
    'mo/template',
    'mo/easing/timing',
    'soviet',
    'choreo',
    'momo/base',
    'momo/tap',
    'momo/swipe',
    'momo/scroll',
    //'momo/drag',
    './view/control',
    './view/picker',
    './view/ranger',
    './view/stars',
    './view/modalcard',
    './view/actionview',
    './view/growl',
    './tpl/layout/overflowmenu',
    './tpl/layout/ctlbar',
    './bus',
    './render',
    './supports',
    'cardkit/env',
    'mo/domready'
], function($, _, browsers, cookie, tpl, easing, soviet, choreo, 
    momoBase, momoTap, momoSwipe, momoScroll, 
    //momoDrag,
    control, picker, ranger, stars, modalCard, actionView, growl, 
    tpl_overflowmenu, tpl_ctlbar, 
    bus, render, supports, env){

    var window = this,
        history = window.history,
        location = window.location,
        document = window.document,
        body = document.body,
        last_view_for_modal,
        last_view_for_actions,
        soviet_aliases = {},

        HASH_SEP = '!/',
        CLEARED_HASH = '#' + HASH_SEP + 'i',
        DEFAULT_CARDID = 'ckDefault',
        LOADING_CARDID = 'ckLoading',
        MODAL_CARDID = '_modal_',
        MINI_ITEM_MARGIN = 10,
        MINI_LIST_PADDING = 15,

        TPL_NAVDRAWER = '<div class="ck-navdrawer"></div>',
        TPL_MASK = '<div class="ck-viewmask"></div>',
        TPL_CARD_MASK = '<div class="ck-cardmask"></div>';

    _.mix(momoBase.Class.prototype, {
        bind: function(ev, handler, elm){
            $(elm || this.node).bind(ev, handler);
            return this;
        },
        unbind: function(ev, handler, elm){
            $(elm || this.node).unbind(ev, handler);
            return this;
        },
        trigger: function(e, ev){
            delete e.layerX;
            delete e.layerY;
            $(e.target).trigger(ev, e);
            return this;
        }
    });

    var tap_events = {

        'a': link_handler,
        'a *': link_handler,

        //'.ck-link-mask': function(){
            //clear_active_item_mask(ck.viewport);
        //},
        
        '.ck-link-img': function(){
            var src = $(this).attr('src');
            if (src) {
                ck.openImage(src);
            }
        },

        '.ck-confirm-link': function(){
            var me = $(this);
            if (!this.href) {
                me = me.parent();
            }
            ck.confirm('', function(){
                open_url(me.attr('href'), me[0]);
            }, me.data());
        },

        '.ck-post-link': handle_control,

        '.ck-post-button, .ck-post-button span': tap_ck_post,

        '.ck-switch, .ck-switch span': tap_ck_switch,

        '.ck-segment .ck-option, .ck-segment .ck-option span': function(){
            var btn = $(this);
            if (!btn.hasClass('ck-option')) {
                btn = btn.closest('.ck-option');
            }
            var p = picker(btn.parent());
            p.select(btn);
        },

        '.ck-tagselector .ck-option': function(){
            var p = picker(this.parentNode);
            p.select(this);
        },

        '.ck-actions .ck-option': function(){
            var actions = $(this).closest('.ck-actions');
            var p = picker(actions, {
                ignoreStatus: actions.data("ignoreStatus") !== 'false' && true
            });
            p.select(this);
        },

        '.ck-folder header': function(){
            control(this.parentNode).toggle();
        },

        '.ck-select, .ck-select span, .ck-select .enabled': function(){
            var me = $(this);
            if (!me.hasClass('ck-select')) {
                me = me.parent();
            }
            var p = picker(me);
            show_actions(me);
            bus.bind('actionView:confirmOnThis', function(actions){
                p.select(actions.val());
            });
        },

        '.ck-actions-button, .ck-actions-button span': function(){
            var me = $(this);
            if (!me.hasClass('ck-actions-button')) {
                me = me.parent();
            }
            show_actions(me);
        },

        '.ck-modal-button, .ck-modal-button *': function(){
            var me = $(this);
            if (!me.hasClass('ck-modal-button')) {
              me = me.closest('.ck-modal-button');
            }
            ck.openModal(me.data());
        },

        '.ck-modal-link, .ck-modal-link *': function(){
            var me = $(this);
            if (!me.hasClass('ck-modal-link')) {
                me = me.closest('.ck-modal-link');
            }
            ck.openModal(me.data());
        },

        '.ck-growl-button': function(){
            growl(this).open();
        },

        '.ck-actionview article > .ck-option, .ck-actionview article > .ck-option > *': function(){
            var me = $(this);
            if (!me.hasClass('ck-option')) {
                me = me.parent();
            }
            actionView.current.select(me);
        },

        '.ck-actionview > footer .confirm': function(){
            actionView.current.confirm();
        },

        '.ck-actionview > footer .cancel': function(){
            actionView.current.cancel();
        },

        '.ck-modalview .wrapper > header .confirm': function(){
            modalCard.confirm();
        },

        '.ck-modalview .wrapper > header .cancel': function(){
            modalCard.cancel();
        },

        '.ck-ctl-backward': function(){
            if (ck.viewport[0].id === DEFAULT_CARDID) {
                back_handler(LOADING_CARDID);
            } else {
                back_handler(ck.viewport.data('prevCard') || DEFAULT_CARDID);
            }
        },

        '.ck-ctl-reload': function(){
            window.location.reload();
        },

        '.ck-top-overflow': function(){
            var selector = '.ck-top-overflow-items .ck-item,'
                    + '.ck-top-overflow-items .ck-overflow-item',
                options = $(selector).map(function(item, i){
                    var label = $(item).data('label');
                    if (label) {
                        label = $(label, item)[0];
                    }
                    return $(tpl.convertTpl(this, {
                        i: i,
                        text:  $(label || item).text()
                    }, 'item'))[0];
                }, tpl_overflowmenu.template);
            actionView('ckTopOverflow', {
                options: options
            }).open();
            bus.bind('actionView:confirmOnThis', function(actionCard){
                var i = actionCard.val();
                bus.once('actionView:close', function(){
                    $(selector).eq(i).trigger('tap');
                });
            });
        },

        '.ck-top-title': function(){
            if (supports.FULLSCREEN_MODE) {
                $('.ck-top-nav').trigger('tap');
            } else {
                return true;
            }
        },

        '.ck-top-nav, .ck-top-nav span': function(){
            if (this.href) {
                return;
            }
            ck.openNavDrawer();
        }

    };

    function check_voodoo(me, handler){
        var me = $(me);
        if (me.hasClass('ck-overflow-item')
                || me.hasClass('ck-item')) {
            var voodoo = me.data('voodoo');
            if (voodoo) {
                $(voodoo).forEach(function(elm){
                    if (elm !== this) {
                        handler.call(elm);
                    }
                }, me[0]);
                return true;
            }
        }
        return false;
    }

    function handle_control(){
        var controller = control(this, {
                disableRequest: check_voodoo(this, handle_control)
            }),
            cfg = controller.data();
        if (cfg.disableUrl || cfg.disableJsonUrl) {
            controller.toggle();
        } else if (!controller.isEnabled) {
            controller.enable();
        }
    } 

    function toggle_control(){
        control(this, {
            disableRequest: check_voodoo(this, toggle_control)
        }).toggle();
    } 

    function tap_ck_post(){
        if (!$(this).hasClass('ck-post-button')) {
            return tap_ck_post.call(this.parentNode);
        }
        handle_control.call(this);
    }

    function tap_ck_switch(){
        if (!$(this).hasClass('ck-switch')) {
            return tap_ck_switch.call(this.parentNode);
        }
        toggle_control.call(this);
    }

    function show_actions(me){
        var opt = _.mix({
            confirmText: '确认',
            cancelText: '取消',
            multiselect: false
        }, me.data());
        opt.options = $(opt.options || '.ck-option', me);
        return actionView(me, opt).open();
    }

    function respond_stars(e, method) {
        var rater = stars(this),
            score = rater.calc(e);
        rater[method](score);
    }

    bus.bind('cardkit:updateSize', function(){
        if (modalCard.isOpened) {
            var current = modalCard._contentWrapper;
            var h = window.innerHeight * 2;
            if (modalCard._iframeContent) {
                modalCard._iframeContent.css({
                    minHeight: h + 'px',
                    width: current[0].offsetWidth + 'px',
                    height: current[0].offsetHeight - ck.headerHeight + 'px'
                });
            }
            modalCard._content.css('minHeight', h + 'px');
        }
        var actionCard = actionView.current;
        if (actionCard) {
            var wh = window.innerHeight + 10,
                h = actionCard._wrapperContent.children().map(function(node){
                    return node.offsetHeight || 0;
                }).reduce(function(a, b){
                    return a + b;
                }) + parseFloat(actionCard._wrapperContent
                    .find('article').eq(0).css('bottom'));
            if (h < wh) {
                h = wh;
            }
            actionCard._wrapperContent.css({
                minHeight: h + 'px'
            });
            actionCard._node.css({
                height: h + 'px'
            });
        }
    });

    modalCard.event.bind('prepareOpen', function(){
        ck.disableView = true;
        if (!supports.CARD_SCROLL) {
            ck.resetWindowTop();
        } else {
            $(body).addClass('bg').addClass('modal-view');
        }
    }).bind('cancelOpen', function(){
        ck.disableView = false;
        $(body).removeClass('bg').removeClass('modal-view');
    }).bind('open', function(){
        if (!supports.CARD_SCROLL) {
            $(body).addClass('bg').addClass('modal-view');
        }
        var current = modalCard._contentWrapper;
        last_view_for_modal = ck.viewport;
        ck.changeView(current, { 
            isModal: true 
        });
        ck.enableControl();
        if (modalCard._iframeContent) {
            modalCard.event.done('frameOnload', function(){
                var iframe_body = $(modalCard._iframeWindow[0].document.body);
                iframe_body.bind('touchstart', prevent_window_scroll);
                ck.initView(iframe_body, {
                    isModal: true
                });
            });
        } else if (!modalCard._content.html()) { // @TODO 换更靠谱的方法
            modalCard.event.done('contentchange', when_modal_content_loaded);
        }
    }).bind('prepareClose', function(){
        ck.disableView = false;
        $(body).removeClass('modal-view');
    }).bind('cancelClose', function(){
        ck.disableView = true;
        $(body).addClass('modal-view');
    }).bind('close', function(){
        modalCard.event.cancel('contentchange', when_modal_content_loaded);
        ck.changeView(last_view_for_modal, {
            preventRender: true,
            isModal: ck._navDrawerLastView,
            isNotPrev: true
        });
        $(body).removeClass('bg');
        ck.enableControl();
    //}).bind('needclose', function(){
        //ck.closeModal();
    });

    bus.bind('actionView:prepareOpen', function(actionCard){
        ck.disableView = true;
        var current = actionCard._wrapper;
        last_view_for_actions = ck.viewport;
        current[0].scrollTop = 0;
        ck.changeView(current, {
            preventRender: true,
            preventScroll: true,
            isActions: true
        });
        if (!supports.CARD_SCROLL) {
            $(body).addClass('bg');
        }
    }).bind('actionView:cancelOpen', function(){
        if (!modalCard.isOpened) {
            ck.disableView = false;
        }
        if (!supports.CARD_SCROLL) {
            $(body).removeClass('bg');
        }
        ck.changeView(last_view_for_actions, {
            isNotPrev: true,
            preventRender: true,
            preventScroll: true,
            isModal: modalCard.isOpened || ck._navDrawerLastView
        });
    }).bind('actionView:close', function(){
        if (!modalCard.isOpened) {
            ck.disableView = false;
        }
        if (!supports.CARD_SCROLL) {
            $(body).removeClass('bg');
        }
        ck.changeView(last_view_for_actions, {
            isNotPrev: true,
            preventRender: true,
            preventScroll: true,
            isModal: modalCard.isOpened || ck._navDrawerLastView
        });
    }).bind('actionView:jump', function(actionCard, href, target){
        actionCard.event.once('close', function(){
            ck.openURL(href, { target: target });
        });
    });

    bus.bind('ranger:changed', function(ranger, url){
        if (url) {
            open_url(tpl.format(url, {
                value: ranger.val()
            }));
        }
    });

    var ck = {

        init: function(opt){
            var doc = $(document);
            var root = this.root = opt.root;
            this.mainview = $('.ck-main', root);
            this.wrapper = $('.ck-wrapper', root);
            this.header = $('.ck-header', root);
            if (!supports.BROWSER_CONTROL) {
                this.ctlbar = $(tpl_ctlbar.template).appendTo(this.wrapper);
                $(body).addClass('has-ctlbar');
            }
            this.footer = $('.ck-footer', root);
            this.raw = $('.ck-raw', root);
            this.loadingCard = $('#' + LOADING_CARDID).data('rendered', '1');
            this.defaultCard = $('#' + DEFAULT_CARDID);
            this.scrollMask = $(TPL_MASK).appendTo(body);
            if (env.showScrollMask) {
                this.scrollMask.css({
                    'opacity': '0.2',
                    'background': '#f00'
                });
            }
            this.controlMask = $(TPL_MASK).appendTo(body);
            if (env.showControlMask) {
                this.controlMask.css({
                    'opacity': '0.2',
                    'background': '#0f0'
                });
            }
            this.cardMask = $(TPL_CARD_MASK).appendTo(this.mainview);
            this.navDrawer = $(TPL_NAVDRAWER).prependTo(root);
            this.headerHeight = this.header.height();
            this.sizeInited = false;
            this.viewportGarbage = {};
            this._sessionLocked = true;
            this._unexpectStateWhenGoback = true;

            this.initWindow();

            if (env.enableConsole) {
                console.info('Features:', supports);
                console.info('Platform:', browsers);
            }

            choreo.config({
                easing: easing
            });

            this.scrollGesture = momoScroll(document, {});
            set_alias_events(this.scrollGesture.event);
            var tapGesture = momoTap(document, {
                tapThreshold: browsers.os !== 'android' 
                    || !browsers.chrome && 20 
                    || 0
            });
            set_alias_events(tapGesture.event);
            var swipeGesture = momoSwipe(this.wrapper, {
                timeThreshold: 10000,
                distanceThreshold: 10 
            });
            set_alias_events(swipeGesture.event);
            //var dragGesture = momoDrag(this.mainview);
            //set_alias_events(dragGesture.event);

            if (!supports.CARD_SCROLL) {
                $(body).addClass('no-cardscroll');
            }
            if (!supports.SAFARI_OVERFLOWSCROLL) {
                $(body).addClass('no-overflowscroll');
            }
            if (supports.FOLDABLE_URLBAR) {
                $(body).addClass('mobilesafari-bar');
            }
            if (supports.FIXED_BOTTOM_BUGGY) {
                $(body).addClass('fixed-bottom-buggy');
            }
            if (supports.FULLSCREEN_MODE) {
                $(body).addClass('fullscreen-mode');
            }

            this.initState();

            $(window).bind('resize', function(){
                var current = ck.isLandscape();
                if (current !== ck.landscapeMode) {
                    ck.initWindow();
                    ck.hideAddressbar(); // @TODO 无效
                    if (actionView.current 
                            && !supports.CARD_SCROLL) {
                        ck.viewport[0].innerHTML = ck.viewport[0].innerHTML;
                    }
                }
            });

            this.cardMask.bind('touchstart', function(e){
                e.preventDefault();
                ck.closeNavDrawer();
            });

            this.loadingCard.bind('touchstart', function(e){
                e.preventDefault();
            });

            soviet(document, {
                aliasEvents: soviet_aliases,
                matchesSelector: true,
                preventDefault: true
            }).on('click', {
                'a': nothing,
                'a *': nothing
            //}).on('tapstart', {
                //'.ck-link-mask': function(){
                    //$(this).addClass('ck-link-mask-active');
                //}
            //}).on('tapcancel', {
                //'.ck-link-mask': function(){
                    //clear_active_item_mask(ck.viewport);
                //}
            }).on('change', {
                '.ck-ranger': function(e){
                    ranger(this).val(e.target.value);
                    return true;
                }
            }).on('touchstart', {
                '.ck-ranger': function(e){
                    ranger(this).val(e.target.value);
                    ranger(this).changeStart();
                    return true;
                }
            }).on('touchend', {
                '.ck-ranger': function(){
                    ranger(this).changeEnd();
                    return true;
                },
                '.ck-stars': function(e) {
                    respond_stars.call(this, e, 'val');
                },
                '.ck-stars .slider-selected': function(e) {
                    respond_stars.call(this.parentNode, e, 'val');
                }
            }).on('touchmove', {
                '.ck-stars': function(e) {
                    respond_stars.call(this, e, 'pretend');
                },
                '.ck-stars .slider-selected': function(e) {
                    respond_stars.call(this.parentNode, e, 'pretend');
                }
            }).on('tap', tap_events);

            doc.bind('scrolldown', function(){
                if (topbar_holded) {
                    return;
                }
                setTimeout(function(){
                    ck.hideAddressbar();
                }, 0);
                //if (ck.viewport[0].scrollTop >= ck.headerHeight) {
                    //ck.hideTopbar();
                //} else {
                    //$(document).bind('touchmove', delay_hide_topbar)
                        //.bind('touchend', delay_hide_topbar);
                //}
            //}).bind('scrollup', function(){
                //ck.showTopbar();
            });
            
            var wrapper_delegate = soviet(this.wrapper, {
                aliasEvents: soviet_aliases,
                matchesSelector: true
            }).on('swipeleft', {
                '.ck-mini-unit .ck-list-wrap *': function(){
                    stick_item.call(this, true);
                }
            }).on('swiperight', {
                '.ck-mini-unit .ck-list-wrap *': function(){
                    stick_item.call(this, false);
                }
            });

            //init_card_drag();

            if (!supports.SAFARI_OVERFLOWSCROLL) {

                wrapper_delegate.on('touchend', {
                    '.ck-mini-unit .ck-list-wrap *': function(e){
                        e.preventDefault();
                    }
                });

            }

            if (supports.CARD_SCROLL 
                    && supports.SAFARI_OVERFLOWSCROLL) {

                doc.bind('scrollstart', function(){
                    ck.scrollMask.show();
                }).bind('scrollend', function(){
                    ck.scrollMask.hide();
                });

                doc.bind('touchstart', prevent_window_scroll);

            }

            if (supports.CARD_SCROLL) {

                doc.bind('scroll', function(){
                    if (modalCard.isOpened) {
                        var y = window.scrollY;
                        if (!y && window.innerHeight >= ck.windowFullHeight) {
                            return;
                        }
                        //ck.hideAddressbar();
                        ck.resetWindowTop();
                        body.scrollTop = 0;
                        if (y > 40) {
                            ck.viewport[0].scrollTop = ck.viewport[0].scrollTop + y - 40;
                        }
                    }
                });

            }

            if (supports.CARD_SCROLL
                    && !supports.FULLSCREEN_MODE) {

                var startY,
                    topbar_holded,
                    cancel_hold = function(){
                        topbar_holded = false;
                    },
                    scroll_on_header = function(e){
                        if (this !== e.target) {
                            return;
                        }
                        startY = e.touches[0].clientY;
                        setTimeout(function(){
                            topbar_holded = true;
                            ck.viewport[0].scrollTop = 0;
                        }, 0);
                    };

                this.header.find('.ck-top-title')
                    .bind('touchstart', scroll_on_header);
                this.header.bind('touchstart', scroll_on_header);

                if (supports.FOLDABLE_URLBAR) {

                    this.header.bind('touchmove', function(e){
                        if (topbar_holded && e.touches[0].clientY < startY) {
                            cancel_hold();
                            topbar_holded = true;
                            ck.windowFullHeight = Infinity;
                            ck.hideAddressbar();
                        }
                    }).bind('touchend', cancel_hold)
                        .bind('touchcancel', cancel_hold);

                }

            }

            if (supports.FULLSCREEN_MODE) {
                $(document).on('scrollstart', function(){
                    ck.hideAllBars();
                }).on('scrollend', function(){
                    ck.showAllBars();
                });
            }

        },

        showView: function(){
            $(body).addClass('ck-inited');
            ck.hideAddressbar();
            bus.once('firstRender', function(){
                ck.hideLoadingCard();
                ck.enableControl();
                bus.resolve('inited');
            });
        },

        initWindow: function(){
            this.landscapeMode = this.isLandscape();
            this.windowFullHeight = Infinity;
        },

        initStateWatcher: function(){

            var is_hash_change,
                rewrite_state;

            $(window).bind("hashchange", function(e){
                //alert(location.href + ', \n' 
                 //+ e.newURL + ', \n' + e.oldURL + '\n' 
                 //+ ck._backFromSameUrl + '\n' + ck._preventNextHashEv)
                if (ck._backFromSameUrl) {
                    return;
                }
                is_hash_change = true;
                if (ck._preventNextHashEv 
                        || e.newURL.length >= e.oldURL.length) {
                    ck._preventNextHashEv = false;
                    return;
                }
                if (ck._sessionLocked) {
                    window.location.reload(true);
                    return;
                }
                if (rewrite_state) {
                    //alert(3 + ', ' + rewrite_state)
                    ck.resetWindowTop();
                    push_history(rewrite_state);
                    if (modalCard.isOpened) {
                        modalCard.close();
                    } else if (ck._backFromOtherpage) {
                        //alert(3.1)
                        ck._backFromOtherpage = false;
                        ck.changeView(rewrite_state);
                        ck._sessionLocked = false;
                        ck.showView();
                    } else {
                        //alert(3.2)
                        back_handler(rewrite_state);
                    }
                    rewrite_state = false;
                    return;
                }
                var state = location.hash.split(HASH_SEP).pop();
                if (state && state !== 'i') {
                    //alert(3 + ': ' + state)
                    ck._sessionLocked = false;
                    rewrite_state = state === MODAL_CARDID && DEFAULT_CARDID 
                        || state;
                    if (!$('#' + rewrite_state).hasClass('ck-card')) {
                        //window.location.reload(true);
                        return;
                    }
                    history.back();
                } else {
                    //alert(4)
                    back_handler(LOADING_CARDID);
                }
            });

            bus.once('inited', function(){
                $(window).bind("popstate", when_pop);
            });

            function when_pop(){
                if (ck._backFromSameUrl) {
                    var state = window.location.hash.split(HASH_SEP).pop();
                    //alert('10.2: ' + state)
                    if (!state) {
                        window.location.reload();
                        return;
                    }
                    history.back();
                    return;
                }
                is_hash_change = false;
                setTimeout(function(){
                    //alert(10.1 + ': ' + location.href + ', ' + is_hash_change + ', ' + ck._backFromSameUrl)
                    if (!is_hash_change && !ck._backFromOtherpage) {
                        //alert(10 +': ' + location.href + ', ' + ck._backFromSameUrl)
                        ck._sessionLocked = false;
                        ck._backFromOtherpage = true;
                        if (!ck._unexpectStateWhenGoback) {
                            if (supports.GOBACK_WHEN_POP) {
                                history.back();
                            } else {
                                window.location.reload(true);
                            }
                        }
                    }
                }, 100);
            }

        },

        initState: function(){

            ck._sessionLocked = false;

            if (supports.BROWSER_CONTROL) {
                ck.initStateWatcher();
            } else {
                bus.once('inited', function(){
                    var BACK_EVENT = !supports.NO_POP_ON_CACHED_PAGE ? "popstate" : "resize";
                    $(window).bind(BACK_EVENT, function(){
                        if (supports.RESIZE_WHEN_SCROLL
                                && !ck._pageCached) {
                            return;
                        }
                        ck._pageCached = false;
                        ck.hideTopbar();
                        ck.viewport.hide();
                        ck.changeView(ck.loadingCard);
                        setTimeout(function(){
                            window.location.reload();
                        }, 20);
                    });
                });
            }

            var last_state,
                last_is_modal,
                card_states = location.hash.replace(/^#/, '');
            if (card_states) {
                card_states = card_states.split(HASH_SEP);
            }
            if (card_states) {
                var valid_states = [];
                card_states = card_states.map(function(next_id){
                    if (next_id === MODAL_CARDID
                            || next_id === 'i'
                            || next_id && $('#' + next_id).hasClass('ck-card')) {
                        valid_states.push(HASH_SEP + next_id);
                        return next_id;
                    }
                }).filter(function(next_id){
                    return next_id;
                });
                last_state = card_states.pop();
                valid_states = valid_states.join('');
                if ('#' + valid_states !== location.hash) {
                    replace_hash(CLEARED_HASH + valid_states);
                    if (!supports.REPLACE_HASH) {
                        return window.location.reload();
                    }
                }
                if (!supports.BROWSER_CONTROL) {
                    if (last_state === LOADING_CARDID
                            || last_state === MODAL_CARDID) {
                        last_state = null;
                    }
                }
                if (last_state === MODAL_CARDID) {
                    last_is_modal = true;
                    last_state = DEFAULT_CARDID;
                } else if (last_state === 'i') {
                    last_state = null;
                }
            }
            //alert(0 + ': ' + document.referrer + ' , ' + location.href + ', ' + compare_link(document.referrer))
            if (supports.BROWSER_CONTROL
                    && supports.REPLACE_HASH
                    && !compare_link(document.referrer)) {
                replace_hash(CLEARED_HASH);
                if (last_state) {
                    card_states.forEach(function(next_id){
                        if (next_id !== 'i') {
                            push_history(next_id);
                        }
                    });
                    push_history(last_state);
                }
            }

            if (last_state) {
                //alert(2);
                ck.changeView(last_state);
                if (last_state === LOADING_CARDID || last_is_modal) {
                    //alert(2.1 + ': ' + document.referrer)
                    ck._backFromOtherpage = true;
                    history.back();
                } else {
                    ck.showView();
                }
            } else {
                //alert(1)
                ck.initNewPage();
            }
        
        },

        initNewPage: function(){
            ck.changeView(ck.defaultCard);
            push_history(DEFAULT_CARDID);
            ck.showView();
        },

        initView: function(card, opt){
            render.openCard(card, opt);
            if (!card.data('rendered') && !opt.preventRender) {
                render.initCard(card, this.raw, this.footer, opt);
                if (!opt.isModal && !opt.isActions) {
                    card.data('rendered', '1');
                }
            }
            this.watchScroll(card);
            //clear_active_item_mask(card);
        },

        releaseView: function(opt){
            if (this.viewport) {
                render.closeCard(this.viewport, opt);
            }
        },

        changeView: function(card, opt){
            opt = opt || {};
            if (!supports.CARD_SCROLL && !opt.preventScroll) {
                ck.resetWindowTop();
            }
            this.releaseView(opt);
            if (typeof card === 'string') {
                card = $('#' + card);
            }
            var is_loading = card === this.loadingCard;
            if (this.viewport && !opt.isNotPrev) {
                card.data('prevCard', this.viewport[0].id);
            }
            this.initView(card, opt);
            this.viewport = card.show();
            this.updateSize(opt);
            if (!opt.isModal 
                    && !opt.isActions 
                    && !opt.preventRender) {
                this.updateFrame();
            }
            if (!is_loading) {
                setTimeout(function(){
                    bus.fire('readycardchange', [card]);
                }, 0);
            }
        },

        updateSize: function(opt){
            opt = opt || {};

            if ((supports.CARD_SCROLL || opt.isActions)
                    && this.viewport[0].id !== LOADING_CARDID) {

                this.viewport[0].style.height = (this.sizeInited ? 
                    window.innerHeight : (screen.availHeight + 60)) + 2 + 'px';

                // enable scrollable when height is not enough 
                var ft = this.viewport.find('.ck-footer'),
                    last_unit = find_last_unit(ft);
                if (last_unit) {
                    var d = screen.availHeight - (last_unit.offsetTop + last_unit.offsetHeight + this.viewport[0].scrollTop);
                    if (d > 0) {
                        ft.css('paddingTop', d + 'px');
                    } else {
                        ft.css('paddingTop', '0px');
                    }
                }
            }

            this.viewport.find('.ck-mini-unit').forEach(function(mini){
                var mini_items = this('.ck-item', mini),
                    w = ck.slideItemWidth = window.innerWidth - MINI_ITEM_MARGIN - MINI_LIST_PADDING;
                if (mini_items.length > 1) {
                    mini_items.css('width', w - MINI_ITEM_MARGIN - 2 + 'px');
                    this('.ck-list', mini).css('width', w * mini_items.length + MINI_ITEM_MARGIN + 'px');
                }
            }, $);

            bus.fire('cardkit:updateSize');
        },

        watchScroll: function(card){
            this.scrollGesture.watchScroll(card[0]);
        },

        updateFrame: function(){
            render.setFrame(this.viewport, this.header, 
                this.navDrawer, this.raw);
        },

        renderUnit: function(node){
            render.initUnit(node, this.raw);
        },

        hideLoadingCard: function() {
            ck.loadingCard.hide().css({
                height: window.innerHeight + 60 + 'px',
                position: 'static'
            });
            ck.showTopbar();
        },

        hideAllBars: function(){
            $(body).addClass('allbars-disabled');
        },

        showAllBars: function(){
            $(body).removeClass('allbars-disabled');
        },

        hideTopbar: function(){
            if (this.topbarEnable && !this.disableView) {
                this.topbarEnable = false;
                $(body).removeClass('ck-topbar-enabled');
            }
        },

        showTopbar: function(){
            if (!this.topbarEnable) {
                this.topbarEnable = true;
                $(body).addClass('ck-topbar-enabled');
            }
        },

        hideAddressbar: function(){
            if (this.windowFullHeight > window.innerHeight) {
                this.loadingCard.find('div')[0].style.visibility = 'hidden';
                if (supports.FOLDABLE_URLBAR
                        && (supports.CARD_SCROLL || !this.sizeInited)) {
                    ck.resetWindowTop();
                    body.scrollTop = 0;
                    //if (screen.availHeight - ck.viewport[0].offsetHeight 
                            //> ck.headerHeight + 10) {
                        //location.reload();
                        //return;
                    //}
                }
                if (!this.sizeInited) {
                    this.sizeInited = true;
                }
                this.windowFullHeight = window.innerHeight;
                ck.updateSize();
                this.loadingCard.find('div')[0].style.visibility = '';
            }
        },

        resetWindowTop: function(){
            if (supports.HIDE_ADDRESSBAR) {
                window.scrollTo(0, -1);
            }
        },

        isLandscape: function() {
            return window.innerWidth / window.innerHeight > 1.1;
        },

        enableControl: function(){
            this.controlMask.hide();
            window.ckControl = enable_control;
        },

        disableControl: function(){
            this.controlMask.show();
            window.ckControl = disable_control;
        },

        showLoading: function(text){
            this.disableControl();
            if (!this.loadingTips) {
                this.loadingTips = growl({
                    expires: -1,
                    keepalive: true,
                    corner: 'center'
                });
            }
            this.loadingTips.set({
                content: text || '正在加载...'
            }).open();
            this._loadingStart = +new Date();
        },

        hideLoading: function(opt){
            opt = _.mix({ duration: 800 }, opt);
            var d = +new Date() - this._loadingStart;
            if (d < opt.duration) {
                setTimeout(function(){
                    ck.hideLoading(opt);
                }, opt.duration - d);
            } else {
                if (this.loadingTips) {
                    this.loadingTips.close();
                }
                this.enableControl();
            }
        },

        openNavDrawer: function(){
            if (ck._navDrawerLastView) {
                return;
            }
            ck._navDrawerLastView = ck.viewport;
            ck.navDrawer.show();
            ck.changeView(ck.navDrawer.find('article'), {
                preventRender: true,
                isNotPrev: true,
                isModal: true
            });
            $(body).addClass('nav-view');
            //choreo().play().actor(ck.mainview[0], {
                //'transform': 'translateX(' + (screen.availWidth - 40) + 'px)'
            //}, 400).follow().then(function(){
            //});
        },

        navDrawerScroll: function(pos) {
            var elem = ck.navDrawer.find('article')[0]; 
            if (pos !== undefined) {
                elem.scrollTop = pos;
            }
            return elem.scrollTop;
        },

        closeNavDrawer: function(){
            if (!ck._navDrawerLastView) {
                return;
            }
            ck.changeView(ck._navDrawerLastView, {
                isNotPrev: true
            });
            $(body).removeClass('nav-view');
            setTimeout(function(){
                ck._navDrawerLastView = false;
                ck.navDrawer.hide();
                setTimeout(function(){
                    bus.fire('navdrawer:close');
                }, 50);
            }, 400);
            //choreo().play().actor(ck.mainview[0], {
                //'transform': 'translateX(0px)'
            //}, 400).follow().then(function(){

            //});
            return bus.promise('navdrawer:close');
        },

        openImage: function(src){
            forward_handler(LOADING_CARDID, src);
        },

        openModal: function(opt){
            this.hideAddressbar();
            this.disableControl();
            if (!modalCard.isOpened) {
                push_history(MODAL_CARDID);
            }
            modalCard.set(opt).open();
        },

        closeModal: function(){
            modalCard.cancel();
            return modalCard.event.promise('close');
        },

        alert: function(text, opt) {
            actionView('ckAlert', _.mix({
                title: '提示',
                content: text || '',
                cancelText: '关闭',
                multiselect: false
            }, opt)).open();
        },

        confirm: function(text, cb, opt) {
            actionView('ckAlert', _.mix({
                title: '提示',
                content: text || '',
                confirmText: '确认',
                cancelText: '取消',
                multiselect: true
            }, opt)).open();
            bus.bind('actionView:confirmOnThis', cb);
        },

        notify: function(content, opt) {
            ck.growl(_.mix({
                content: content
            }, opt)).open();
        },

        openURL: open_url,

        delegate: soviet(document, {
            aliasEvents: soviet_aliases,
            autoOverride: true,
            matchesSelector: true,
            preventDefault: true
        }),

        event: bus,

        control: control,
        picker: picker,
        ranger: ranger,
        modalCard: modalCard,
        actionView: actionView, 
        growl: growl

    };

    function nothing(){}

    function when_modal_content_loaded(){
        ck.initView(modalCard._contentWrapper, {
            isModal: true
        });
    }

    function stick_item(is_forward){
        var self = $(this).closest('.ck-list-wrap'),
            aid = self.data('ckSlideAnime');
        if (!aid) {
            aid = self.data('ckSlideAnime', +new Date());
        }
        var w = ck.slideItemWidth,
            x = self[0].scrollLeft,
            n = x / w,
            pos = n - Math.floor(n),
            list = $('.ck-list', self)[0],
            l = $('.ck-item', list).length - 1;
        if (n > 0 && (n < l && l - n > 0.1)) {
            if (is_forward) {
                if (pos < 0.1) {
                    n = Math.floor(n);
                } else {
                    n = Math.ceil(n);
                }
            } else {
                if (pos > 0.9) {
                    n = Math.ceil(n);
                } else {
                    n = Math.floor(n);
                }
            }
            var d = x - n * w 
                + (n === l ? MINI_LIST_PADDING : 0);
            self.addClass('stop-scroll');
            choreo(aid).clear().play().actor(list, {
                transform: 'translateX(' + d + 'px)'
            }, 200, 'easeOutSine').follow().then(function(){
                choreo.transform(list, 'translateX', '0');
                self[0].scrollLeft -= d;
                self.removeClass('stop-scroll');
            });
        }
    }

    //function clear_active_item_mask(card){
        //card.find('.ck-link-mask-active').removeClass('ck-link-mask-active');
    //}
    
    function compare_link(href){
        return href.replace(/#.*/, '') === location.href.replace(/#.*/, '');
    }
    
    function check_inner_link(href){
        var next_id,
            current_id,
            next = href.replace(/#(.*)/, function($0, $1){
                next_id = $1;
                return '';
            }),
            current = location.href.replace(/#(.*)/, function($0, $1){
                current_id = $1 || '';
                return '';
            });
        if (next_id && next === current) {
            if (!next_id 
                    || !$('#' + next_id).hasClass('ck-card')
                    || next_id === ck.viewport[0].id) {
                next_id = DEFAULT_CARDID;
                if (current_id.split(HASH_SEP).pop() === next_id) {
                    return false;
                }
            }
        } else {
            next_id = '';
        }
        return next_id;
    }

    function link_handler(e){
        var me = e.target;
        while (me && !me.href) {
            me = me.parentNode;
        }
        if (!me) {
            return;
        }
        var next_id = check_inner_link(me.href);
        if (next_id === false) {
            return;
        }
        if ($(me).hasClass('ck-link-extern')) {
            open_url(me.href, {
                target: me.target || '_blank'
            });
            return;
        } else if ($(me).hasClass('ck-link-direct')) {
            if (next_id) {
                forward_handler(next_id, null, true);
            } else {
                open_url(me.href, {
                    target: me.target || '_self'
                });
            }
            return;
        } else if ($(me).hasClass('ck-link')
                || $(me).hasClass('ck-link-img')) {
        } else if (/(^|\s)ck-\w+/.test(me.className)) {
            // eg. ck-link-native
            return;
        } else if (me.target) {
            if (next_id && me.target === '_self') {
                forward_handler(next_id, null, true);
            } else {
                open_url(me.href, me);
            }
            return;
        }
        if (next_id) {
            forward_handler(next_id);
        } else {
            forward_handler(LOADING_CARDID, me.href);
        }
    }

    function forward_handler(next_id, true_link, is_load){
        ck.disableControl();
        if (modalCard.isOpened) {
            ck.closeModal().done(function(){
                forward_handler(next_id, true_link);
            });
            return;
        }
        if (ck._navDrawerLastView) {
            ck.closeNavDrawer().then(function(){
                forward_handler(next_id, true_link);
            });
            return;
        }
        ck._sessionLocked = true;
        var next = next_id && $('#' + next_id);
        if (!next.hasClass('ck-card')
                || next_id === ck.viewport[0].id) {
            ck.enableControl();
            ck._sessionLocked = false;
            return;
        }
        ck.hideTopbar();
        var current = ck.viewport;
        push_history(next_id);
        if (is_load) {
            ck.loadingCard.addClass('moving').show();
            setTimeout(function(){
                ck.changeView(next);
                current.hide();
                ck.loadingCard.hide().removeClass('moving');
                ck.enableControl();
                ck._sessionLocked = false;
                ck.showTopbar();
            }, 400);
            return;
        }
        choreo.transform(next[0], 'translateX', window.innerWidth + 'px');
        next.addClass('moving');
        ck.changeView(next);
        ck.cardMask.css('opacity', 0).addClass('moving');
        var moving = choreo('card:moving').clear().play();
        moving.actor(ck.cardMask[0], {
            'opacity': '0.8'
        }, 400, 'ease');
        moving.actor(next[0], {
            'transform': 'translateX(0)'
        }, 450, 'ease');
        moving.follow().then(function(){
            current.hide();
            ck.cardMask.removeClass('moving').css('opacity', 0);
            next.removeClass('moving');
            if (true_link) {
                ck._unexpectStateWhenGoback = false;
                ck._pageCached = true;
                window.location = true_link;
            } else {
                ck.enableControl();
                ck._sessionLocked = false;
                ck.showTopbar();
            }
        });
    }

    function back_handler(prev_id){
        ck._sessionLocked = true;
        ck.disableControl();
        if (ck._navDrawerLastView) {
            ck.closeNavDrawer().then(function(){
                back_handler(prev_id);
            });
            return;
        }
        if (actionView.current) {
            actionView.current.close().event.once('close', function(){
                back_handler(prev_id);
            });
            return;
        }
        ck.hideTopbar();
        var prev = $('#' + prev_id);
        var current = ck.viewport;
        choreo.transform(current[0], 'translateX', '0px');
        current.addClass('moving');
        ck.changeView(prev, {
            isNotPrev: true
        });
        ck.cardMask.css('opacity', '0.8').addClass('moving');
        var moving = choreo('card:moving').clear().play();
        moving.actor(ck.cardMask[0], {
            'opacity': '0'
        }, 400, 'ease');
        moving.actor(current[0], {
            'transform': 'translateX(' + window.innerWidth + 'px)'
        }, 450, 'ease');
        moving.follow().then(function(){
            ck.cardMask.removeClass('moving');
            current.hide().removeClass('moving');
            choreo.transform(current[0], 'translateX', '0px');
            when_back_end(prev_id);
        });
    }

    function when_back_end(prev_id){
        if (prev_id === LOADING_CARDID) {
            //alert('back: ' + document.referrer + '\n' + location.href)
            if (document.referrer
                   && compare_link(document.referrer)
                   || !/#.+/.test(document.referrer)) { // redirect.html
                ck._backFromSameUrl = true;
            }
            history.back();
            var loc = location.href;
            setTimeout(function(){
                if (location.href === loc) {
                    location.reload();
                }
            }, 700);
        } else {
            ck.enableControl();
            ck._sessionLocked = false;
            ck.showTopbar();
        }
    }

    function push_history(next_id){
        if (supports.BROWSER_CONTROL) {
            window.location = location.href.replace(/#(.*)|$/, '#$1' + HASH_SEP + next_id);
        }
    }

    function replace_hash(hash){
        ck._preventNextHashEv = true;
        location.replace(location.href.replace(/#.*/, '') + (hash || CLEARED_HASH));
    }

    function prevent_window_scroll(){
        if (supports.WINDOW_SCROLL) {
            return;
        }
        var vp = ck.viewport[0],
            bottom;
        if (vp.scrollTop < 1) {
            vp.scrollTop = 1;
        } else if (vp.scrollTop > (bottom = vp.scrollHeight 
                - vp.offsetHeight - 1)) {
            vp.scrollTop = bottom;
        }
    }

    //function delay_hide_topbar(){
        //if (ck.viewport[0].scrollTop >= ck.headerHeight) {
            //ck.hideTopbar();
            //$(document).unbind('touchmove', delay_hide_topbar)
                //.unbind('touchend', delay_hide_topbar);
        //}
    //}

    function open_url(true_link, opt){
        opt = opt || { target: '_self' };
        if (opt.target !== '_self') {
            open_window(true_link, opt.target);
        } else {
            ck.disableControl();
            if (modalCard.isOpened) {
                ck.closeModal().done(function(){
                    open_url(true_link, opt);
                });
                return;
            }
            if (ck._navDrawerLastView) {
                ck.closeNavDrawer().then(function(){
                    open_url(true_link, opt);
                });
                return;
            }
            ck._sessionLocked = true;
            ck.hideTopbar();
            var next = ck.loadingCard;
            var current = ck.viewport;
            push_history(LOADING_CARDID);
            next.addClass('moving');
            ck.changeView(next);
            setTimeout(function(){
                current.hide();
                next.removeClass('moving');
                ck._unexpectStateWhenGoback = false;
                ck._pageCached = true;
                window.location = true_link;
            }, 10);
        }
    }

    function open_window(url, target){
        if (supports.NEW_WIN) {
            window.open(url, target);
        } else {
            $('<a href="' + url + '" target="' + target + '"></a>').trigger('click');
        }
    }

    function find_last_unit(ft){
        var last_unit = ft && ft.prev()[0];
        if (last_unit && !last_unit.offsetHeight) {
            return find_last_unit($(last_unit));
        }
        return last_unit;
    }

    function set_alias_events(events) {
        for (var ev in events) {
            $.Event.aliases[ev] = soviet_aliases[ev] = 'ck_' + events[ev];
        }
    }

    //function init_card_drag(){
        //var _startX, _current, _prev, _clone, _hideTimer;
        //ck.mainview.on('dragstart', function(e){
            //_startX = e.clientX;
            //_current = ck.viewport.addClass('moving');
            //_clone = _current.clone().show().prependTo(ck.wrapper);
            //_prev = $('#' + (_current.data('prevCard') || LOADING_CARDID));
            //ck.hideTopbar();
            //ck.changeView(_prev, {
                //isNotPrev: true
            //});
            //ck.cardMask.css('opacity', '0.8').addClass('moving');
            //_hideTimer = setTimeout(function(){
                //_current.addClass('hidding');
            //}, 200);
        //}).on('drag', function(e){
            //var d = e.clientX - _startX;
            //if (d < 0) {
                //d = 0;
            //}
            //choreo.transform(_clone[0], 'translateX', d + 'px');
            //ck.cardMask.css('opacity', (1 - d / window.innerWidth) * 0.8);
        //}).on('dragend', function(e){
            //clearTimeout(_hideTimer);
            //var d = e.clientX - _startX;
            //if (d < 0) {
                //d = 0;
            //}
            //var s = d / window.innerWidth;
            //if (s > 0.3) {
                //choreo().play().actor(_clone[0], {
                    //'transform': 'translateX(' + window.innerWidth + 'px)'
                //}, 100).follow().then(function(){
                    //ck._preventNextHashEv = true;
                    //history.back();
                    //ck.cardMask.removeClass('moving').css('opacity', 0);
                    //_clone.hide().removeClass('moving');
                    //_current.remove();
                    //when_back_end(_prev[0].id);
                //});
            //} else {
                //choreo().play().actor(_clone[0], {
                    //'transform': 'translateX(0px)'
                //}, 100).follow().then(function(){
                    //ck.changeView(_clone);
                    //ck.cardMask.removeClass('moving').css('opacity', 0);
                    //_prev.hide();
                    //_clone.removeClass('moving');
                    //_current.remove();
                    //ck.showTopbar();
                //});
            //}
        //});
    //}

    //function check_gc(controller){
        //return ck.viewportGarbage[controller.parentId];
    //}

    function enable_control(){}

    function disable_control(){ return false; }

    return ck;

});

