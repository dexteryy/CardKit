
{% if (actionbar.overflowItems.length) { %}
<button type="button" class="ck-top-overflow ck-item"></button>
{% } %}

{% actionbar.items.reverse().forEach(function(item){ %}

    {%=(item)%}

{% }); %}

<span class="ck-top-overflow-items">
{% actionbar.overflowItems.forEach(function(item){ %}

    {%=(item)%}

{% }); %}
</span>
