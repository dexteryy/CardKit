define('moui/slider', [
    'mo/lang',
    'dollar',
    'eventmaster'
], function(_, $, event) {
    function Slider(elm, opt) {
        this.init(elm, opt);
    }

    Slider.prototype = {
        init: function(elm, opt) {
            var node = this._node = $(elm),
                field,
                hoverArea,
                selectedArea,
                self = this;

            if (node.data('init')) {
                return;
            } else {
                node.data('init', true);
            }

            opt = _.mix(this.data(), opt);

            this._field = field = node.find('.slider-field');
            this._hoverArea = hoverArea = node.find('.slider-hover');
            this._selectedArea = selectedArea = node.find('.slider-selected');

            var step = field.attr('step'),
                max = field.attr('max'),
                min = field.attr('min');

            var stepWidth = step * node.width() / (max - min);

            node.bind('touchmove', function(e) {
                var score = calcRawScore(e),
                    width = score * stepWidth;

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
                selectedArea.css({width:score * stepWidth})
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

                return Math.ceil(offsetX / stepWidth);
            }
        },

        val: function(v) {
            if (this._field[0]) {
                if (v !== undefined) {
                    this._field.trigger('change');
                }
                return this._field.val(v);
            }
        },

        data: function() {
            return this._node.data();
        }
    };


    function exports(elm, opt){
        return new exports.Slider(elm, opt);
    }

    exports.Slider = Slider;

    return exports;

});
