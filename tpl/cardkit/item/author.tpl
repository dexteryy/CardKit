{% if (context.authorLink) { %}
<a href="{%= context.authorLink %}" 
    target="{%= (context.authorLinkTarget || '_self') %}" 
    class="ck-author ck-link">{%= content %}</a>
{% } else { %}
<span class="ck-author">{%= content %}</span>
{% } %}
