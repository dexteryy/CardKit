
<ul>
{% mod.items.forEach(function(item){ %}
    <li class="ck-item">
        <a class="ck-link" href="{%= item.href %}">{%= item.title %}</a>
        <span class="info">{%= item.info %}</span>
    </li>
{% }); %}
</ul>
