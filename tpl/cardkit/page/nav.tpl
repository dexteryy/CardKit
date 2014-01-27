{% if (content) { %}
<span class="ck-top-nav">{%= content %}</span>
{% } else { %}
<a class="ck-top-nav ck-link" href="{%= state.link %}"></a>
{% } %}
