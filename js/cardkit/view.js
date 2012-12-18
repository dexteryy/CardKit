define([
    'dollar',
    'mo/lang',
    'mo/template',
    'soviet',
    'choreo',
    './bus',
    './pagesession',
    './view/modal',
    'mo/domready'
], function($, _, tpl, soviet, choreo, bus, pageSession, modal){

    var window = this,
        location = window.location,
        document = window.document,
        body = document.body,

        SUPPORT_ORIENT = "orientation" in window && "onorientationchange" in window,
        SUPPORT_OVERFLOWSCROLL = "overflowScrolling" in body,

        TPL_LOADING_CARD = '<div class="ck-card" cktype="loading" id="ckLoading"><span>加载中...</span></div>';

    var view = {

        init: function(opt){
            var wrapper = this.wrapper = opt.wrapper;
            this.header = opt.header,
            this.footer = $('.ck-footer', wrapper);
            this.cards = $('.ck-card', wrapper);
            this.listContents = $('.ck-list', wrapper);
            this.loadingCard = $(TPL_LOADING_CARD).appendTo(wrapper);
            this.defaultCard = $('#ckDefault');
            this.headerHeight = this.header.height();
            this.windowFullHeight = Infinity;

            if (header.length === 0) {
                return;
            }

            this.render();
            this.showTopbar();

            $(window).bind("popstate", function(e){
                var loading = view.viewport[0].id === 'ckLoading';
                //alert(['pop', 
                //  e.state && [e.state.prev, e.state.next], 
                //  view.viewport && view.viewport[0].id].join(', '))
                if (e.state) {
                    if (e.state.next === 'ckLoading' && loading) {
                        // back from other page
                        history.back();
                    } else if (loading) {
                        // from other page, need hide loading immediately
                        view.showTopbar();
                        view.changeView($('#' + e.state.next));
                        view.loadingCard.hide();
                    } else if (e.state.prev === view.viewport[0].id) {
                        // forward from inner view
                        link_handler(e.state.next, e.state.link);
                    } else {
                        // back from inner view
                        back_handler(e.state.next);
                    }
                } else if (loading) {
                    // forward from other page, need restore (cache mod)
                    history.forward();
                } else { 
                    // back to other page, need show loading first
                    back_handler('ckLoading');
                }
            });

            pageSession.init();
            
            var current_state = history.state;
            //alert(['init', 
            //  current_state && [current_state.prev, current_state.next], 
            //  view.viewport && view.viewport[0].id].join(', '))
            if (current_state && current_state.next) {
                this.changeView($('#' + current_state.next));
                if (current_state.next === 'ckLoading') {
                    history.back();
                }
            } else {
                if (pageSession.indexOf(location.href) !== -1) {
                    view.changeView(view.loadingCard);
                    history.forward();
                } else {
                    view.changeView(view.defaultCard);
                    push_history(view.loadingCard[0].id, view.defaultCard[0].id);
                    pageSession.push(location.href);
                }
            }

            $(window).bind('resize', function(e){
                view.updateSize();
                //console.info('resize', window.pageYOffset, window.scrollY, window.innerHeight);
            });

            this.hideAddressbar();
            this.windowFullHeight = window.innerHeight;

            soviet(document, {
                matchesSelector: true,
                preventDefault: true
            }).on('click', {
                'a': link_handler,
                'a *': link_handler
            });

            var startY, currentY;

            $(body).bind('touchstart', function(e){
                startY = e.touches[0].clientY;
            });

            $(body).bind('touchmove', function(e){
                currentY = e.touches[0].clientY;
            });

            $(body).bind('touchend', function(){
                var direction = currentY - startY;
                if (direction < -20) {
                    view.hideAddressbar();
                    if (view.viewport[0].scrollTop >= view.headerHeight) {
                        view.hideTopbar();
                    }
                } else if (direction > 0) {
                    view.showTopbar();
                }
            });

        },

        changeView: function(pile){
            this.viewport = pile.show();
            pile.append(this.footer);
            this.updateSize();
            pile[0].scrollTop = this.topbarEnable ? 0 : this.headerHeight;
        },

        updateSize: function(){
            this.viewport[0].style.height = window.innerHeight - this.headerHeight + 'px';
        },

        hideTopbar: function(){
            if (this.topbarEnable) {
                this.topbarEnable = false;
                choreo.transform(view.header[0], 'translateY', '-' + this.headerHeight + 'px');
            }
        },

        showTopbar: function(){
            if (!this.topbarEnable) {
                this.topbarEnable = true;
                choreo.transform(view.header[0], 'translateY', '0');
            }
        },

        hideAddressbar: function(){
            if (this.windowFullHeight > window.innerHeight) {
                body.style.height = screen.availHeight + 'px';
                window.scrollTo(0, 1);
                view.updateSize();
                body.style.height = '';
            }
        },

        showAddressbar: function(){
            //setTimeout(function() {
                //window.scrollTo(0, 0);
                //view.updateSize();
            //}, 0);
        },

        getOrientation : function() {
            var is_portrait = true;
            if (SUPPORT_ORIENT) {
                is_portrait = ({ "0": true, "180": true })[window.orientation];
            } else {
                is_portrait = body.clientWidth / body.clientHeight < 1.1;
            }

            return is_portrait ? "portrait" : "landscape";
        },

        render: function(){
            this.listContents.find('.ck-link').forEach(function(item){
                item = $(item);
                var target_id = (item.attr('href')
                        .replace(location.href, '')
                        .match(/^#(.+)/) || [])[1],
                    hd = $('#' + target_id).find('.ck-hd').html();
                if (hd) {
                    item.html(hd.trim());
                } else {
                    var card = item.parent().parent();
                    item.parent().remove();
                    if (!/\S/.test(card.html())) {
                        card.remove();
                    }
                }
            });
        }

    };

    view.modal = modal;

    function link_handler(next_id, true_link){
        var me, is_forward = typeof next_id === 'string';
        if (!is_forward) {
            me = next_id.target;
            next_id = '';
            while (!me.href) {
                me = me.parentNode;
            }
            if ($(me).hasClass('ck-link')) {
                next_id = (me.href.replace(location.href, '')
                    .match(/^#(.+)/) || [])[1];
            }
        }
        var next = next_id && $('#' + next_id);
        if (!next) {
            if (me) {
                next_id = 'ckLoading';
                next = view.loadingCard;
                true_link = me.href;
                pageSession.clear(pageSession.indexOf(location.href));
            } else {
                return;
            }
        }
        var current = view.viewport.addClass('ck-interim');
        if (!is_forward) {
            push_history(current[0].id, next_id, true_link);
        }
        choreo.transform(next[0], 'translateX', window.innerWidth + 'px');
        next.addClass('ck-moving');
        view.showTopbar();
        view.changeView(next);
        choreo().play().actor(next[0], {
            'transform': 'translateX(0)'
        }, 400, 'easeInOut').follow().done(function(){
            next.removeClass('ck-moving');
            current.hide().removeClass('ck-interim');
            if (true_link) {
                if (is_forward) {
                    history.forward();
                } else {
                    location.href = true_link;
                }
            }
            //view.hideTopbar();
        });
    }

    function back_handler(prev_id){
        var prev = $('#' + prev_id);
        var current = view.viewport.addClass('ck-moving');
        prev.addClass('ck-interim');
        view.showTopbar();
        view.changeView(prev);
        choreo().play().actor(current[0], {
            'transform': 'translateX(' + window.innerWidth + 'px)'
        }, 400, 'easeInOut').follow().done(function(){
            current.hide().removeClass('ck-moving');
            choreo.transform(current[0], 'translateX', '0px');
            prev.removeClass('ck-interim');
            if (prev_id === 'ckLoading') {
                history.back();
            }
            //view.hideTopbar();
        });
    }

    function push_history(prev_id, next_id, link){
        history.pushState({
            prev: prev_id,
            next: next_id,
            link: link,
            i: history.length
        }, document.title, location.href);
    }

    return view;

});
