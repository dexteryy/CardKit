define('moui/slider', [
    'mo/lang',
    'dollar',
    'eventmaster'
], function(_, $, event) {
    function Slider(elm, opt) {
        this.init(elm, opt);
    }

    Slider.prototype = {
        init: function(elm) {
            var node = this._node = $(elm),
                field;

            this.event = event();

            if (node.data('init')) {
                return;
            } else {
                node.data('init', true);
            }

            this._field = field = node.find('.slider-field');
            this._hoverArea = node.find('.slider-hover');
            this._selectedArea = node.find('.slider-selected');

            this._step = field.attr('step'),
            this._max = field.attr('max'),
            this._min = field.attr('min');

            this._stepWidth = this._step * node.width() / (this._max - this._min);
        },

        calc: function(event) {
            var pageX = (event.changedTouches) ? event.changedTouches[0].pageX : event.pageX,
                node = this._node,
                stepWidth = this._stepWidth,
                step = this._step,
                offsetX = pageX - node.offset().left;

            if (offsetX > node.width()) {
                offsetX = node.width();
            } else if (offsetX < 0) {
                offsetX = 0;
            }

            return Math.ceil(offsetX / stepWidth) * step;
        },

        val: function(v) {
            if (this._field[0]) {
                var returnValue = this._field.val(v);
                if (v !== undefined) {
                    this.event.fire('change');
                }
                return returnValue;
            }
        },

        show: function(v) {
            var stepWidth = this._stepWidth,
                selectedArea = this._selectedArea,
                hoverArea = this._hoverArea;

            hoverArea.hide();
            selectedArea.css({width:v * stepWidth})
                .show();
        },

        pretend: function(v) {
            var stepWidth = this._stepWidth,
                selectedArea = this._selectedArea,
                hoverArea = this._hoverArea;

            var width = v * stepWidth;

            if (hoverArea.data('width') != width) {
                selectedArea.hide();
                hoverArea.css({width: width})
                    .show()
                    .data('width', width);
            }
        }
    };

    function exports(elm, opt){
        return new exports.Slider(elm, opt);
    }

    exports.Slider = Slider;

    return exports;

});
