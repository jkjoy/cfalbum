import { pageShell } from './_lib/layout.js';
import { escapeHtml } from './_lib/utils.js';
import { getSiteSettings } from './_lib/settings.js';

export async function onRequestGet(context) {
  const settings = await getSiteSettings(context.env);
  const siteTitle = escapeHtml(settings.siteTitle || 'Photograph');

  const categoriesRes = await context.env.DB.prepare(`
    SELECT category, COUNT(*) AS count
    FROM albums
    WHERE is_public = 1
    GROUP BY category
    ORDER BY count DESC, category ASC
  `).all();

  const categories = (categoriesRes.results || []).map((r) => ({ name: r.category, count: r.count }));

  const randomRes = await context.env.DB.prepare(`
    SELECT slug
    FROM albums
    WHERE is_public = 1
    ORDER BY created_at DESC, id DESC
    LIMIT 300
  `).all();
  const randomPool = (randomRes.results || []).map((r) => `/albums/${encodeURIComponent(r.slug)}`);

  const body = `
<div class="content">
  <div id="masonry" class="row"></div>
  <ol class="page-navigator" id="pager"></ol>
  <div id="no-data"></div>
</div>
<script>
(function(){
  var page = Number(new URLSearchParams(location.search).get('page') || 1);
  var pageSize = Number((window.__siteConfig && window.__siteConfig.pageSize) || ${settings.pageSize});
  window.__randomPool = ${JSON.stringify(randomPool)};

  function itemHtml(item){
    var safeTitle = String(item.title || '').replace(/[&<>\"']/g, function (s) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' })[s]; });
    return '<div class="item col-xs-' + ${settings.colXs} + ' col-sm-' + ${settings.colSm} + ' col-md-' + ${settings.colMd} + ' col-lg-' + ${settings.colLg} + '">'
      + '<img class="item-img lazy" src="' + ((window.__siteConfig && window.__siteConfig.lazyImg) || '/src/lazy.svg') + '" data-original="' + item.cover + '" alt="' + safeTitle + '">'
      + '<div class="item-title"><a class="item-link" href="/albums/' + item.slug + '"><div class="item-link-text">' + safeTitle + '</div></a>'
      + '<span class="item-num">[' + (item.photoCount || 0) + 'P] <span class="glyphicon glyphicon-picture"></span></span></div></div>';
  }

  function pagerHtml(data){
    var totalPages = data.totalPages || 1;
    var html = '';
    if (page > 1) html += '<li><a href="/?page=' + (page - 1) + '">上一页</a></li>';
    html += '<li class="current"><span>' + page + ' / ' + totalPages + '</span></li>';
    if (page < totalPages) html += '<li class="next"><a href="/?page=' + (page + 1) + '">下一页</a></li>';
    return html;
  }

  fetch('/api/albums?page=' + page + '&pageSize=' + pageSize)
    .then(function(resp){ return resp.json(); })
    .then(function(data){
      var masonry = document.getElementById('masonry');
      masonry.innerHTML = (data.items || []).map(itemHtml).join('');
      document.getElementById('pager').innerHTML = pagerHtml(data);
      if (window.Photograph && window.Photograph.initListPage) window.Photograph.initListPage();
    });
})();
</script>`;

  return pageShell({
    title: siteTitle,
    body,
    settings,
    categories,
    runtimeConfig: { randomPool }
  });
}
