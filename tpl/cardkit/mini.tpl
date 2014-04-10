<div class="ck-mini-card {%= (state.blankText === 'false' ? 'no-blank' : '') %} {%= state.customClass %}"
        data-style="{%= state.subtype %}">

    {% if (hasSplitHd) { %}
        {%= hdwrap %}
    {% } %}

    <article class="ck-card-wrap {%= (component.item.length > 1 ? 'slide' : '') %}">

        {% if (!hasSplitHd) { %}
            {%= hdwrap %}
        {% } %}
        
        <div class="ck-list-wrap">

            {% if (component.item.length) { %}

                <div class="ck-list" style="width:{%= listWidth %};">
                {% component.item.forEach(function(item){ %}
                    <div class="ck-col" style="width:{%= itemWidth %};">
                        {%= item %}
                    </div>
                {% }); %}
                </div>

            {% } else { %}

                <div class="ck-list">
                    <div class="ck-item blank">
                        <div class="ck-initem">
                        {% if (component.blank) { %}
                            {%= component.blank %}
                        {% } else { %}
                            {%=(state.blankText || '目前还没有内容')%}
                        {% } %}
                        </div>
                    </div>
                </div>

            {% } %}

        </div>

        {%= component.ft %}

    </article>

</div>

