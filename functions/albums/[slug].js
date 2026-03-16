import { notFound } from '../_lib/response.js';
import { pageShell } from '../_lib/layout.js';
import { escapeHtml } from '../_lib/utils.js';
import { getSiteSettings } from '../_lib/settings.js';

export async function onRequestGet(context) {
  const slug = context.params.slug;
  const base = new URL(context.request.url).origin;
  const apiResp = await fetch(`${base}/api/albums/${encodeURIComponent(slug)}`);
  if (!apiResp.ok) return notFound('Album not found');
  const album = await apiResp.json();

  const settings = await getSiteSettings(context.env);
  const categoriesRes = await context.env.DB.prepare(`
    SELECT category, COUNT(*) AS count
    FROM albums
    WHERE is_public = 1
    GROUP BY category
    ORDER BY count DESC, category ASC
  `).all();
  const categories = (categoriesRes.results || []).map((r) => ({ name: r.category, count: r.count }));
  const siteTitle = escapeHtml(settings.siteTitle || 'Photograph');
  const title = escapeHtml(album.title || 'Album');
  const description = escapeHtml(album.description || '');

  const body = `
<div class="content post-album-content">
  <article class="post post-album" itemscope itemtype="http://schema.org/BlogPosting">
    <h1 class="post-title" itemprop="name headline">${title}</h1>
  </article>
  <div class="post-content post row" itemprop="articleBody" id="masonry">
    ${(album.photos || []).map((p) => {
      const photoUrl = escapeHtml(p.url || '');
      return `<a class="post-item col-xs-${settings.colXs} col-sm-${settings.colSm} col-md-${settings.colMd} col-lg-${settings.colLg}" href="${photoUrl}" data-fancybox="gallery"><img class="post-item-img lazy" src="${escapeHtml(settings.lazyImg || '/src/lazy.svg')}" data-original="${photoUrl}" alt="${title}"></a>`;
    }).join('')}
  </div>
  <div class="post-info"><div class="post-info-box"><span class="post-info-title">描述：</span><span class="post-info-text">${description || '暂无描述'}</span></div></div>
</div>
<script>window.__albumData = ${JSON.stringify(album)};</script>`;

  return pageShell({
    title: `${title} - ${siteTitle}`,
    body,
    settings,
    isPostPage: true,
    categories
  });
}
