define('moui/slider', [
    'mo/lang',
    'dollar',
    'eventmaster'
], function(_, $, event) {
    var default_config = {
        starwidth: 25
    };

    function Slider(elm, opt) {
        this.init(elm, opt);
    }

    Slider.prototype = {
        init: function(elm, opt) {
            var node = this._node = $(elm),
                hoverArea,
                selectedArea,
                self = this;

            if (node.data('init')) {
                return;
            } else {
                node.data('init', true);
            }

            opt = _.mix(this.data(), opt);

            this._field = node.find('.slider-field');
            this._hoverArea = hoverArea = node.find('.slider-hover');
            this._selectedArea = selectedArea = node.find('.slider-selected');

            node.bind('touchmove', function(e) {
                var score = calcRawScore(e),
                    width = score * opt.starwidth;

                if (hoverArea.data('width') != width) {
                    selectedArea.hide();
                    hoverArea.css({width: width})
                        .show()
                        .data('width', width);
                }
            });

            node.bind('touchend', function(e) {
                var score = calcRawScore(e);
                self.val(score);
            });

            this._field.bind('change', function(e) {
                var score = this.value;
                hoverArea.hide();
                selectedArea.css({width:score * opt.starwidth})
                    .show();
            });

            function calcRawScore(event) {
                var pageX = (event.changedTouches) ? event.changedTouches[0].pageX : event.pageX,
                    offsetX = pageX - node.offset().left;

                if (offsetX > node.width()) {
                    offsetX = node.width();
                } else if (offsetX < 0) {
                    offsetX = 0;
                }

                return Math.ceil(offsetX / opt.starwidth);
            }
        },

        val: function(v) {
            if (this._field[0]) {
                return this._field.val(v).trigger('change');
            }
        },

        data: function() {
            return this._node.data();
        }
    };


    function exports(elm, opt){
        return new exports.Slider(elm, opt);
    }

    exports.Slider= Slider;

    return exports;

});
