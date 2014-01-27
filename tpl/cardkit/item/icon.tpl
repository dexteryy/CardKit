{% if (state.imgUrl) { %}
    {% if (context.isItemLinkAlone) { %}
    <a href="{%= context.itemLink %}" 
            target="{%= (context.itemLinkTarget || '_self') %}" 
            class="ck-icon ck-link">
        <img src="{%= state.imgUrl %}"/>
    </a>
    {% } else { %}
    <span class="ck-icon">
        <img src="{%= state.imgUrl %}"/>
    </span>
    {% } %}
{% } %}
