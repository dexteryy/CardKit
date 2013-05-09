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
    './bus',
    './render',
    './supports',
    'cardkit/env',
    'mo/domready'
], function($, _, browsers, tpl, easing, soviet, choreo, 
    momoBase, momoTap, momoSwipe, momoDrag, momoScroll, 
    control, picker, stars, modalCard, actionView, growl,
    bus, render, supports, env){

    var window = this,
        history = window.history,
        location = window.location,
        document = window.document,
        body = document.body,
        //back_timeout,
        last_view_for_modal,
        last_view_for_actions,
        gc_id = 0,

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
        
        '.ck-card .ck-post-link': handle_control,

        '.ck-card .ck-post-button': handle_control,
        '.ck-card .ck-post-button span': function tap_ck_post(){
            if (!$(this).hasClass('ck-post-button')) {
                return tap_ck_post.call(this.parentNode);
            }
            handle_control.call(this);
        },

        '.ck-card .ck-switch, .ck-card .ck-switch span': function tap_ck_switch(){
            if (!$(this).hasClass('ck-switch')) {
                return tap_ck_switch.call(this.parentNode);
            }
            toggle_control.call(this);
        },

        '.ck-segment .ck-option': function(){
            var p = picker(this.parentNode, {
                ignoreRepeat: true
            });
            p.select(this);
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

        '.ck-top-title': function(){
            if (this.href) {
                ck.openURL(this.href);
            }
        },

        '.ck-top-create .btn': open_modal_card,

        '.ck-top-action .btn': function(){
        
        }
    
    };

    function open_modal_card(){
        ck.openModal($(this).data());
    }

    function handle_control(){
        var controller = control(this);
        if (!controller.isEnabled) {
            controller.enable();
            mark_gc(controller);
        }
    } 

    function toggle_control(){
        var controller = control(this).toggle();
        mark_gc(controller);
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
            window.scrollTo(0, -1);
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
    }).bind('needclose', function(){
        ck.closeModal();
    });

    bus.bind('actionView:prepareOpen', function(actionCard){
        ck.disableView = true;
        var current = actionCard._wrapper;
        last_view_for_actions = ck.viewport;
        current[0].scrollTop = 0;
        ck.changeView(current, {
            preventRender: true,
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
            this.footer = $('.ck-footer', root);
            this.raw = $('.ck-raw', root);
            this.loadingCard = $('#ckLoading').data('rendered', '1');
            this.defaultCard = $('#ckDefault');
            this.scrollMask = $(TPL_MASK).appendTo(body);
            if (env.showScrollMask) {
                this.scrollMask.css({
                    'opacity': '0.2',
                    'background': '#f00'
                });
            }
            this.controlMask = $(TPL_MASK).appendTo(body);
            if (env.showControlMask) {
                //this.controlMask.css({
                    //'opacity': '0.2',
                    //'background': '#0f0'
                //});
            }
            this.cardMask = $(TPL_CARD_MASK).appendTo(body);
            this.headerHeight = this.header.height();
            this.sizeInited = false;
            this.viewportGarbage = {};
            this.sessionLocked = true;

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

            setTimeout(function(){
                ck.hideAddressbar();
                ck.hideLoadingCard();
                ck.enableControl();
                ck.sessionLocked = false;
            }, 0);

            $(window).bind('resize', function(){
                var current = ck.isLandscape();
                if (current !== ck.landscapeMode) {
                    ck.initWindow();
                    ck.hideAddressbar(); // @TODO 无效
                    if (actionView.current 
                            && !supports.UNIVERSAL_TRANS) {
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
            //}).on('touchstart', {
                //'.ck-mini-unit .ck-list-wrap *': function(){
                    //var self = $(this).closest('.ck-list-wrap'),
                        //aid = self.data('ckSlideAnime');
                    //if (aid) {
                        //choreo(aid).clear();
                    //}
                //}
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
                        e.stopPropagation();
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

            if (supports.UNIVERSAL_TRANS) {

                doc.bind('scroll', function(){
                    if (modalCard.isOpened) {
                        var y = window.scrollY;
                        if (!y && window.innerHeight >= ck.windowFullHeight) {
                            return;
                        }
                        //ck.hideAddressbar();
                        window.scrollTo(0, -1);
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

        initWindow: function(){
            this.landscapeMode = this.isLandscape();
            this.windowFullHeight = Infinity;
        },

        initState: function(){

            var travel_history, restore_state, restore_modal;

            if (supports.UNIVERSAL_TRANS) {
                $(window).bind("popstate", function(e){
                    // alert(['pop', e.state && [e.state.prev, e.state.next].join('-'), ck.viewport && ck.viewport[0].id].join(', '))
                    if (ck.sessionLocked) {
                        window.location.reload(true);
                        return;
                    }
                    //clearTimeout(back_timeout);
                    var loading = ck.viewport[0].id === 'ckLoading'; 
                    if (e.state) {
                        if (e.state.next === '_modal_') {
                            // 11. forward from normal card, show modal card.  alert(11)
                            if (modalCard.isOpened || loading || !ck.viewport) {
                                history.back();
                            } else {
                                modalCard.set(e.state.opt).open();
                            }
                        } else if (modalCard.isOpened) {
                            // 12. back from modal card.  alert(12)
                            ck.closeModal();
                        } else if (loading) {
                            if (e.state.next === 'ckLoading') {
                                // 6. back from other page, no GC. 
                                //    go to 2.  alert(6)
                                history.back();
                            } else if (e.state.next) {
                                // 7. from 6, hide loading immediately.  alert(7)
                                ck.changeView(e.state.next);
                                ck.hideLoadingCard();
                                ck.enableControl();
                            }
                        } else if (e.state.prev === ck.viewport[0].id) {
                            // 3. forward from normal card.  alert(3)
                            link_handler(e.state.next, e.state.link);
                        } else if (e.state.next === ck.viewport[0].id){ // @TODO hotfix for chrome
                            history.back();
                        } else {
                            // 2. back from normal card.  alert(2)
                            back_handler(e.state.next);
                        }
                    } else if (loading) {
                        // 5. forward from other page, no GC.  alert(5)
                        history.forward();
                    } else { 
                        // 4. back to other page, shift left and show loading.
                        //    if no GC: go to 6.
                        //    if no prev page: reload, go to 8
                        //    else: go to 8.  alert(4)
                        back_handler('ckLoading');
                    }
                });

                //console.info('is_back: ', is_back)
                //console.info('is_lastadd: ', is_lastadd)
                //console.info('is_refresh: ', is_refresh)
                //console.info('url: ', url)
                //console.info('ref: ', ref)
                //console.warn('lasturl: ', lasturl)
                //console.info('index: ', current, footprint.indexOf(url))
                //console.info('data: ', footprint)

                travel_history = check_footprint();

                var current_state = history.state;
                restore_state = current_state && current_state.next; // alert(['init', current_state && [current_state.prev, current_state.next].join('-'), ck.viewport && ck.viewport[0].id].join(', '))
                if (restore_state === '_modal_') {
                    restore_state = current_state.prev;
                    restore_modal = true;
                }

                //console.info(travel_history, restore_state, current_state)

            } else if (supports.PREVENT_CACHE) {

                $(window).bind("popstate", function(){
                    ck.hideTopbar();
                    ck.viewport.hide();
                    ck.changeView(ck.loadingCard);
                    setTimeout(function(){
                        window.location.reload();
                    }, 100);
                });

            }

            if (restore_state) {
                // 1. reload from normal card.  alert(1)
                ck.changeView(restore_state);
                if (restore_state === 'ckLoading') {
                    // 9.  alert(9)
                    history.back();
                } else if (restore_modal && !modalCard.isOpened) {
                    modalCard.set(history.state.opt).open();
                }
            } else {
                if (travel_history) {
                    // 8.  alert(8)
                    ck.changeView(ck.loadingCard);
                    history.forward();
                    //setTimeout(function(){
                        //if (ck.viewport === ck.loadingCard) {
                            //ck.initNewPage();
                        //}
                    //}, 100);
                } else {
                    // 0.  alert(0)
                    ck.initNewPage();
                }
            }

        },

        initNewPage: function(){
            ck.changeView(ck.defaultCard);
            push_history(ck.loadingCard[0].id, ck.defaultCard[0].id);
        },

        initView: function(card, opt){
            if (!card.data('rendered') && !opt.preventRender) {
                render.initCard(card, this.raw, this.footer, opt);
                if (!opt.isModal && !opt.isActions) {
                    card.data('rendered', '1');
                }
            }
            this.watchScroll(card);
            //clear_active_item_mask(card);
        },

        releaseView: function(){
            control.gc(check_gc);
            picker.gc(check_gc);
            this.viewportGarbage = {};
            gc_id = 0;
        },

        changeView: function(card, opt){
            opt = opt || {};
            //this.releaseView(); // @TODO release when modal open
            if (typeof card === 'string') {
                card = $('#' + card);
            }
            var is_loading = card === this.loadingCard;
            this.initView(card, opt);
            this.viewport = card.show();
            if (!is_loading) {
                this.updateSize(opt);
            }
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
                position: 'static',
                height: window.innerHeight + 'px'
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
                    window.scrollTo(0, -1);
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
                push_history(ck.viewport[0].id, '_modal_', false, opt);
            }
            modalCard.set(opt).open();
        },

        closeModal: function(){
            modalCard.close();
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

    function link_handler(next_id, true_link){
        if (modalCard.isOpened) {
            modalCard.event.once('close', function(){
                link_handler(next_id, true_link);
            });
            ck.closeModal();
            return;
        }
        var me, is_forward = typeof next_id === 'string';
        if (!is_forward) {
            me = next_id.target;
            next_id = '';
            while (!me.href) {
                me = me.parentNode;
            }
            if ($(me).hasClass('ck-link-extern')) {
                open_url(me.href, {
                    target: '_blank'
                });
                return;
            } else if ($(me).hasClass('ck-link')) {
                next_id = (me.href.replace(location.href, '')
                    .match(/^#(.+)/) || [])[1];
            } else if (/(^|\s)ck-\w+/.test(me.className)) {
                return;
            } else if (me.target) {
                open_url(me.href, me);
                return;
            }
        }
        var next = next_id && $('#' + next_id);
        if (!next) {
            if (me) {
                next_id = 'ckLoading';
                next = ck.loadingCard;
                true_link = me.href;
            } else {
                return;
            }
        }
        if (!supports.UNIVERSAL_TRANS 
                && next === ck.loadingCard) {
            if (true_link) {
                ck.openURL(true_link);
            }
            return;
        }
        ck.hideTopbar();
        ck.sessionLocked = true;
        var current = ck.viewport;
        if (!is_forward) {
            push_history(current[0].id, next_id, true_link);
        }
        ck.disableControl();
        if (!supports.UNIVERSAL_TRANS) {
            ck.loadingCard.addClass('moving').show();
            setTimeout(function(){
                ck.changeView(next);
                current.hide();
                ck.loadingCard.hide().removeClass('moving');
                ck.enableControl();
                ck.sessionLocked = false;
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
            ck.enableControl();
            ck.sessionLocked = false;
            if (true_link) {
                if (is_forward) {
                    history.forward();
                } else {
                    clear_footprint();
                    location.href = true_link;
                }
            } else {
                ck.showTopbar();
            }
        });
    }

    function back_handler(prev_id){
        if (actionView.current) {
            actionView.current.close().event.once('close', function(){
                back_handler(prev_id);
            });
            return;
        }
        ck.hideTopbar();
        ck.sessionLocked = true;
        var prev = $('#' + prev_id);
        var current = ck.viewport;
        //if (supports.PREVENT_CACHE && prev === ck.loadingCard) {
            //ck.sessionLocked = false;
            //history.back();
            //return;
        //}
        ck.disableControl();
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
            ck.enableControl();
            ck.sessionLocked = false;
            if (prev_id === 'ckLoading') {
                history.back();
                if (!document.referrer || document.referrer === location.href) {
                    location.reload(true);
                }
            } else {
                ck.showTopbar();
            }
        });
    }

    function push_history(prev_id, next_id, link, opt){
        if (supports.UNIVERSAL_TRANS) {
            history.pushState({
                prev: prev_id,
                next: next_id,
                link: link,
                opt: opt,
                i: history.length
            }, document.title, location.href);
        }
    }

    function check_footprint(){
        var footprint = sessionStorage['ck_footprint'];
        try {
            footprint = footprint && JSON.parse(footprint) || [];
        } catch(ex) {
            footprint = [];
        }
        var url = location.href,
            ref = document.referrer,
            lasturl = sessionStorage['ck_lasturl'],
            current = footprint.lastIndexOf(url),
            is_refresh = lasturl === url && ref !== url,
            is_first = url === footprint[0],
            is_lastadd = url === footprint[footprint.length - 1],
            is_back = lasturl && lasturl !== ref && !is_refresh;
        if ((is_back || is_refresh) && is_first) {
            return;
        }
        if (ref) {
            if (ref === url) {
                footprint.length = 0;
                footprint.push(url);
            } else if (!is_back && ref === footprint[footprint.length - 1]) {
                if (current !== -1) { 
                    footprint.splice(0, current + 1);
                }
                footprint.push(url);
            } else if (is_back && lasturl === footprint[0]) {
                if (current !== -1) { 
                    footprint.length = current - 1;
                }
                footprint.unshift(url);
            } else if (ref === footprint[current - 1]) {
                return true; // travel_history
            } else if (ref === footprint[footprint.length - 2]
                    && is_lastadd && !is_back) {
                return;
            } else {
                footprint.length = 0;
                footprint.push(url);
            }
        } else if (is_lastadd) {
            return;
        } else {
            footprint.length = 0;
            footprint.push(url);
        }
        sessionStorage['ck_footprint'] = JSON.stringify(footprint);
        //console.warn('changed: ', sessionStorage['ck_footprint'])
    }

    function clear_footprint(){
        var footprint = sessionStorage['ck_footprint'];
        try {
            footprint = footprint && JSON.parse(footprint) || [];
        } catch(ex) {
            footprint = [];
        }
        var url = location.href;
        footprint.length = footprint.indexOf(url) + 1;
        sessionStorage['ck_footprint'] = JSON.stringify(footprint);
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
        if (modalCard.isOpened) {
            modalCard.event.once('close', function(){
                open_url(true_link, opt);
            });
            ck.closeModal();
            return;
        }
        if (opt.target !== '_self') {
            open_window(true_link, opt.target);
        } else {
            if (!supports.UNIVERSAL_TRANS) {
                if (supports.PREVENT_CACHE) {
                    ck.hideTopbar();
                    ck.viewport.hide();
                    ck.changeView(ck.loadingCard);
                }
                location.href = true_link;
                return;
            }
            ck.hideTopbar();
            ck.sessionLocked = true;
            var next_id = 'ckLoading';
            var next = ck.loadingCard;
            var current = ck.viewport;
            ck.disableControl();
            clear_footprint();
            push_history(current[0].id, next_id, true_link);
            ck.changeView(next);
            setTimeout(function(){
                current.hide();
                ck.enableControl();
                ck.sessionLocked = false;
                location.href = true_link;
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

    function check_gc(controller){
        return ck.viewportGarbage[controller.parentId];
    }

    function enable_control(){}

    function disable_control(){ return false; }

    return ck;

});
