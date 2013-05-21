define([
    'dollar',
    'mo/lang',
    'mo/browsers',
    'mo/template',
    'mo/easing/timing',
    'soviet',
    'choreo',
    'momo/base',
    'momo/tap',
    'momo/swipe',
    'momo/drag',
    'momo/scroll',
    './view/control',
    './view/picker',
    './view/stars',
    './view/modalcard',
    './view/actionview',
    './view/growl',
    './tpl/layout/ctlbar',
    './bus',
    './render',
    './supports',
    'cardkit/env',
    'mo/domready'
], function($, _, browsers, tpl, easing, soviet, choreo, 
    momoBase, momoTap, momoSwipe, momoDrag, momoScroll, 
    control, picker, stars, modalCard, actionView, growl, 
    tpl_ctlbar, bus, render, supports, env){

    var window = this,
        history = window.history,
        location = window.location,
        document = window.document,
        body = document.body,
        last_view_for_modal,
        last_view_for_actions,
        gc_id = 0,

        HASH_SEP = '!/',
        CLEARED_HASH = '#' + HASH_SEP + 'i',
        DEFAULT_CARDID = 'ckDefault',
        LOADING_CARDID = 'ckLoading',
        MODAL_CARDID = '_modal_',
        MINI_ITEM_MARGIN = 10,
        MINI_LIST_PADDING = 15,

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
            $(e.target).trigger(ev);
            return this;
        }
    });

    var tap_events = {

        'a': link_handler,
        'a *': link_handler,

        //'.ck-link-mask': function(){
            //clear_active_item_mask(ck.viewport);
        //},
        
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

        '.ck-modal-button': open_modal_card,
        '.ck-modal-link': open_modal_card,

        '.ck-growl-button': function(){
            growl(this).open();
        },

        '.ck-actionview article > .ck-option': function(){
            actionView.current.select(this);
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

        '.ck-top-title': function(){
            if (this.href) {
                ck.openURL(this.href);
            }
        },

        '.ck-top-create .btn': open_modal_card,

        '.ck-top-action .btn': function(){
            actionView(this).open();
        }
    
    };

    function open_modal_card(){
        ck.openModal($(this).data());
    }

    function handle_control(){
        var controller = control(this),
            cfg = controller.data();
        if (cfg.disableUrl || cfg.disableJsonUrl) {
            controller.toggle();
        } else if (!controller.isEnabled) {
            controller.enable();
        }
    } 

    function toggle_control(){
        var controller = control(this).toggle();
        mark_gc(controller);
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

    function mark_gc(com){
        if (!com.parentId) {
            com.parentId = ++gc_id;
        }
        ck.viewportGarbage[com.parentId] = 1;
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
        if (modalCard._iframeContent) {
            modalCard.event.done('frameOnload', function(){
                var iframe_body = $(modalCard._iframeWindow[0].document.body);
                iframe_body.bind('touchstart', prevent_window_scroll);
                ck.initView(iframe_body, {
                    isModal: true
                });
                setTimeout(function(){
                    ck.enableControl();
                }, 400);
            });
        } else if (!modalCard._content.html()) { // @TODO 换更靠谱的方法
            modalCard.event.done('contentchange', function(){
                ck.initView(current, {
                    isModal: true
                });
                setTimeout(function(){
                    ck.enableControl();
                }, 400);
            });
        } else {
            setTimeout(function(){
                ck.enableControl();
            }, 400);
        }
    }).bind('prepareClose', function(){
        ck.disableView = false;
        $(body).removeClass('modal-view');
    }).bind('cancelClose', function(){
        ck.disableView = true;
        $(body).addClass('modal-view');
    }).bind('close', function(){
        ck.changeView(last_view_for_modal);
        $(body).removeClass('bg');
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
            preventRender: modalCard.isOpened,
            preventScroll: true,
            isModal: modalCard.isOpened
        });
    }).bind('actionView:close', function(){
        if (!modalCard.isOpened) {
            ck.disableView = false;
        }
        if (!supports.CARD_SCROLL) {
            $(body).removeClass('bg');
        }
        ck.changeView(last_view_for_actions, {
            preventRender: modalCard.isOpened,
            preventScroll: true,
            isModal: modalCard.isOpened
        });
    }).bind('actionView:jump', function(actionCard, href, target){
        actionCard.event.once('close', function(){
            ck.openURL(href, { target: target });
        });
    });

    var ck = {

        init: function(opt){
            var root = this.root = opt.root;
            var doc = $(document);
            this.wrapper = $('.ck-wrapper', root);
            this.header = $('.ck-header', root);
            if (!supports.BROWSER_CONTROL) {
                this.ctlbar = $(tpl_ctlbar.template).appendTo(this.wrapper);
                $(body).addClass('has_ctlbar');
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
            this.cardMask = $(TPL_CARD_MASK).appendTo(body);
            this.headerHeight = this.header.height();
            this.sizeInited = false;
            this.viewportGarbage = {};
            this._sessionLocked = true;

            this.initWindow();

            if (env.enableConsole) {
                console.info('Features:', supports);
                console.info('Platform:', browsers);
            }

            choreo.config({
                easing: easing
            });

            this.scrollGesture = momoScroll(document);
            momoTap(document);
            momoSwipe(this.wrapper, {
                'timeThreshold': 10000,
                'distanceThreshold': 10 
            });

            if (!supports.CARD_SCROLL) {
                $(body).addClass('no-cardscroll');
            }
            if (!supports.SAFARI_OVERFLOWSCROLL) {
                $(body).addClass('no-overflowscroll');
            }
            if (supports.HIDE_TOPBAR) {
                $(body).addClass('mobilesafari-bar');
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

            this.loadingCard.bind('touchstart', function(e){
                e.preventDefault();
            });

            soviet(document, {
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
            }).on('touchend', {
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

            if (supports.HIDE_TOPBAR
                    && supports.CARD_SCROLL) {

                var startY,
                    hold_timer,
                    topbar_holded,
                    topbar_tips = growl({
                        corner: 'center',
                        expires: -1,
                        keepalive: true,
                        content: '向下拖动显示地址栏'
                    }),
                    cancel_hold = function(){
                        clearTimeout(hold_timer);
                        if (topbar_holded) {
                            topbar_holded = false;
                            topbar_tips.close();
                        }
                    };
                this.header.bind('touchstart', function(e){
                    startY = e.touches[0].clientY;
                    hold_timer = setTimeout(function(){
                        topbar_holded = true;
                        ck.viewport[0].scrollTop = 0;
                        topbar_tips.open();
                    }, 510);
                }).bind('touchmove', function(e){
                    clearTimeout(hold_timer);
                    if (topbar_holded && e.touches[0].clientY < startY) {
                        cancel_hold();
                        topbar_holded = true;
                        ck.windowFullHeight = Infinity;
                        ck.hideAddressbar();
                    }
                }).bind('touchend', cancel_hold).bind('touchcancel', cancel_hold);

            }

        },

        showView: function(){
            $(body).addClass('ck-inited');
            ck.hideAddressbar();
            ck.hideLoadingCard();
            ck.enableControl();
            bus.resolve('inited');
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
                    var card = $('#' + rewrite_state) || [];
                    if (!card[0]) {
                        window.location.reload(true);
                        return;
                    }
                    history.back();
                } else {
                    //alert(4)
                    back_handler(LOADING_CARDID);
                }
            });

            $(window).bind("popstate", function(){
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
                        if (supports.GOBACK_WHEN_POP) {
                            history.back();
                        } else {
                            window.location.reload(true);
                        }
                    }
                }, 100);
            });

        },

        initState: function(){

            ck._sessionLocked = false;

            if (supports.BROWSER_CONTROL) {
                ck.initStateWatcher();
            } else {
                bus.once('inited', function(){
                    $(window).bind("popstate", function(){
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
                            || (next_id && $('#' + next_id) || [])[0]) {
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
            //control.gc(check_gc);
            //picker.gc(check_gc);
            //this.viewportGarbage = {};
            //gc_id = 0;
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
            if (this.viewport) {
                card.data('prevCard', this.viewport[0].id);
            }
            this.initView(card, opt);
            this.viewport = card.show();
            this.updateSize(opt);
            if (!opt.isModal && !opt.isActions) {
                this.updateHeader();
            }
            sessionStorage['ck_lasturl'] = location.href;
            if (!is_loading) {
                setTimeout(function(){
                    bus.fire('readycardchange', [card]);
                }, 0);
            }
        },

        updateSize: function(opt){
            opt = opt || {};

            if (supports.CARD_SCROLL || opt.isActions) {

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

        updateHeader: function(){
            var top_submit = this.header.find('.ck-top-create').empty();
            var create_btn = this.viewport.find('.ckd-top-create').html();
            if (create_btn) {
                top_submit.append(create_btn);
            }
        },

        renderUnit: function(node){
            render.initUnit(node, this.raw);
        },

        hideLoadingCard: function() {
            ck.loadingCard.hide().css({
                position: 'static'
            });
            ck.showTopbar();
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
                if (supports.HIDE_TOPBAR
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
            }, opt)).open().event.once('confirm', cb);
        },

        notify: function(content, opt) {
            ck.growl(_.mix({
                content: content
            }, opt)).open();
        },

        openURL: open_url,

        delegate: soviet(document, {
            autoOverride: true,
            matchesSelector: true,
            preventDefault: true
        }),

        event: bus,

        control: control,
        picker: picker,
        modalCard: modalCard,
        actionView: actionView, 
        growl: growl

    };

    function nothing(){}

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
        if (n > 0 && n < l) {
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
        if (next === current) {
            next = next_id && $('#' + next_id) || [];
            if (!next[0]) {
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
        while (!me.href) {
            me = me.parentNode;
        }
        var next_id = check_inner_link(me.href);
        if (next_id === false) {
            return;
        }
        if ($(me).hasClass('ck-link-extern')) {
            open_url(me.href, {
                target: '_blank'
            });
            return;
        } else if ($(me).hasClass('ck-link')) {
        } else if (/(^|\s)ck-\w+/.test(me.className)) {
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
        ck._sessionLocked = true;
        var next = next_id && $('#' + next_id);
        if (!next) {
            ck.enableControl();
            ck._sessionLocked = false;
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
            ck.cardMask.removeClass('moving');
            next.removeClass('moving');
            if (true_link) {
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
        ck.changeView(prev);
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
            if (prev_id === LOADING_CARDID) {
                //alert('back: ' + document.referrer + '\n' + location.href)
                if (compare_link(document.referrer)
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
        });
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

    //function check_gc(controller){
        //return ck.viewportGarbage[controller.parentId];
    //}

    function enable_control(){}

    function disable_control(){ return false; }

    return ck;

});
