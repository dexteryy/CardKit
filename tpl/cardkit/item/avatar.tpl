{% if (state.imgUrl) { %}
    {% if (context.authorLink) { %}
    <a href="{%= context.authorLink %}" 
            target="{%= (context.authorLinkTarget || '_self') %}" 
            class="ck-avatar ck-link">
        <img src="{%= state.imgUrl %}"/>
    </a>
    {% } else { %}
    <span class="ck-avatar">
        <img src="{%= state.imgUrl %}"/>
    </span>
    {% } %}
{% } %}
