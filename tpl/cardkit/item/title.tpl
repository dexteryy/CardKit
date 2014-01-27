{% if (context.isItemLinkAlone) { %}
<a href="{%= context.itemLink %}" 
    class="ck-link"
    target="{%= (context.itemLinkTarget || '_self') %}">{%= content %}</a>
{% } else { %}
<span class="ck-title">{%= content %}</span>
{% } %}

