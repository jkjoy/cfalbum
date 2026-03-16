import { html } from './response.js';
import { escapeHtml } from './utils.js';

function safeCssText(input) {
  return String(input || '').replace(/<\/style/gi, '<\\/style');
}

function toClassList(input, allow) {
  const set = new Set(Array.isArray(input) ? input : []);
  return allow.filter((x) => set.has(x));
}

function heightBase(cols, wide, narrow) {
  return cols === wide ? narrow : Math.max(16, Math.round((12 / Math.max(cols, 1)) * 4));
}

function dynamicStyle(settings) {
  const coverRadius = toClassList(settings.coverRadius, ['cr_tl', 'cr_tr', 'cr_br', 'cr_bl']);
  const coverTitleBorder = toClassList(settings.coverTitleBorder, ['ctb_t', 'ctb_r', 'ctb_b', 'ctb_l']);
  const coverTitleRadius = toClassList(settings.coverTitleRadius, ['ctr_tl', 'ctr_tr', 'ctr_br', 'ctr_bl']);

  const lgBase = settings.colLg === 3 ? 23 : heightBase(settings.colLg, 3, 16);
  const mdBase = settings.colMd === 4 ? 32 : heightBase(settings.colMd, 4, 23);
  const smBase = settings.colSm === 6 ? 45 : heightBase(settings.colSm, 6, 32);
  const xsBase = settings.colXs === 12 ? 95 : heightBase(settings.colXs, 12, 45);

  let sideOpacity = 1;
  let sideRadius = 20;
  if (settings.sideButton === 1) { sideOpacity = 1; sideRadius = 3; }
  if (settings.sideButton === 2) { sideOpacity = 0.7; sideRadius = 3; }
  if (settings.sideButton === 3) { sideOpacity = 1; sideRadius = 20; }
  if (settings.sideButton === 4) { sideOpacity = 0.7; sideRadius = 20; }

  return `<style>
${settings.noticeColor ? `.notice-top{color:${settings.noticeColor};border-color:${settings.noticeColor};}` : ''}
${coverTitleBorder.includes('ctb_t') && settings.coverOrn === 'co_cat' ? `.item-link-text::before{content:'';display:block;position:absolute;top:-36px;left:-2px;background-image:url('/src/miao.svg');background-size:cover;width:40px;height:45px;}` : ''}
.item-title{opacity:${settings.coverTitle};}
.item-img,.item-title{
  ${coverRadius.includes('cr_tl') ? 'border-top-left-radius:10px;' : ''}
  ${coverRadius.includes('cr_tr') ? 'border-top-right-radius:10px;' : ''}
  ${coverRadius.includes('cr_br') ? 'border-bottom-right-radius:10px;' : ''}
  ${coverRadius.includes('cr_bl') ? 'border-bottom-left-radius:10px;' : ''}
}
.item-link-text{
  ${coverTitleBorder.length ? '' : 'border:none;'}
  ${coverTitleBorder.includes('ctb_t') ? 'border-top:solid 2px white;' : ''}
  ${coverTitleBorder.includes('ctb_r') ? 'border-right:solid 2px white;' : ''}
  ${coverTitleBorder.includes('ctb_b') ? 'border-bottom:solid 2px white;' : ''}
  ${coverTitleBorder.includes('ctb_l') ? 'border-left:solid 2px white;' : ''}
  ${coverTitleRadius.includes('ctr_tl') ? 'border-top-left-radius:10px;' : ''}
  ${coverTitleRadius.includes('ctr_tr') ? 'border-top-right-radius:10px;' : ''}
  ${coverTitleRadius.includes('ctr_br') ? 'border-bottom-right-radius:10px;' : ''}
  ${coverTitleRadius.includes('ctr_bl') ? 'border-bottom-left-radius:10px;' : ''}
}
.item{height:calc(${settings.coverHeightTimes} * ${lgBase}vw);}
@media screen and (max-width:1199px){.item{height:calc(${settings.coverHeightTimes} * ${mdBase}vw);}}
@media screen and (max-width:991px){.item{height:calc(${settings.coverHeightTimes} * ${smBase}vw);}}
@media screen and (max-width:767px){.item{height:calc(${settings.coverHeightTimes} * ${xsBase}vw);}}
.post-album-content{width:100%;}
article.post.post-album{max-width:none;width:calc(100% - 20px);padding:10px 10px 0;margin:0 auto;}
.post-album .post-title{margin:8px 0 14px;}
.post-album-content #masonry.post-content.post.row{margin:0 10px 10px;}
.post-album #masonry .post-item{padding:5px;}
.row .post-item,.post-content.row .post-item{height:calc(${settings.imgHeightTimes} * ${lgBase}vw);}
@media screen and (max-width:1199px){.row .post-item,.post-content.row .post-item{height:calc(${settings.imgHeightTimes} * ${mdBase}vw);}}
@media screen and (max-width:991px){.row .post-item,.post-content.row .post-item{height:calc(${settings.imgHeightTimes} * ${smBase}vw);}}
@media screen and (max-width:767px){.row .post-item,.post-content.row .post-item{height:calc(${settings.imgHeightTimes} * ${xsBase}vw);}}
.post-item-img{height:100%;object-fit:cover;}
#side-button li{opacity:${sideOpacity};border-radius:${sideRadius}px;}
${safeCssText(settings.diyCss)}
</style>`;
}

function renderInsHeader(settings, isPostPage) {
  const title = escapeHtml(settings.siteTitle || 'Photograph');
  const logo = String(settings.logo || '').trim();
  const titleHtml = logo ? `<img class="header-logo" src="${escapeHtml(logo)}" alt="${title}">` : title;
  return `<header class="header">
  ${isPostPage ? '<a class="header-post-back" href="javascript:history.go(-1);"><span class="glyphicon glyphicon-share-alt" aria-hidden="true"></span></a>' : ''}
  <h1 class="header-title anti-select"><a href="/">${titleHtml}</a></h1>
</header>`;
}

function renderBootHeader(settings, categories = []) {
  const title = escapeHtml(settings.siteTitle || 'Photograph');
  const logo = String(settings.logo || '').trim();
  const titleHtml = logo ? `<img class="nav-logo" src="${escapeHtml(logo)}" alt="${title}">` : title;
  const randomItem = settings.randomPostPt === 1 ? '<li><a href="javascript:;" onclick="window.Photograph && window.Photograph.goRandomPost();" title="随机相册">随机</a></li>' : '';
  const cateItems = (categories || []).map((c) => `<li><a href="/?category=${encodeURIComponent(c.name)}">${escapeHtml(c.name)}</a></li>`).join('');

  return `<nav class="navbar navbar-default navbar-fixed-top">
  <div class="container-fluid">
    <div class="navbar-header">
      <button type="button" class="navbar-toggle collapsed" data-toggle="collapse" data-target="#bs-navbar" aria-expanded="false">
        <span class="sr-only">Toggle navigation</span>
        <span class="glyphicon glyphicon-th-large" aria-hidden="true"></span>
      </button>
      <a class="navbar-brand" href="/">${titleHtml}</a>
    </div>
    <div class="collapse navbar-collapse" id="bs-navbar">
      <ul class="nav navbar-nav">
        <li><a href="/">首页</a></li>
        ${randomItem}
        ${cateItems}
      </ul>
      <ul class="nav navbar-nav navbar-right">
        <li><a href="/admin">管理</a></li>
      </ul>
    </div>
  </div>
</nav>`;
}

export function pageShell({ title, body, settings, isPostPage = false, categories = [], runtimeConfig = {} }) {
  const safeTitle = escapeHtml(title || settings.siteTitle || 'Photograph');
  const favicon = String(settings.favicon || '').trim() || '/favicon.png';
  const navStyle = settings.navStyle === 'boot' ? 'boot' : 'ins';
  const header = navStyle === 'boot' ? renderBootHeader(settings, categories) : renderInsHeader(settings, isPostPage);

  const topNotice = settings.notice && settings.noticeStyle === 'top'
    ? `<div class="notice-top"><b>网站公告：</b>${escapeHtml(settings.notice)}</div>`
    : '';
  const bottomNotice = settings.notice && settings.noticeStyle === 'bottom'
    ? `<div class="notice-top"><b>网站公告：</b>${escapeHtml(settings.notice)}</div>`
    : '';

  const mergedRuntime = {
    lazyImg: settings.lazyImg || '/src/lazy.svg',
    infiniteScroll: !!settings.infiniteScroll,
    fancyBox3Opt: Array.isArray(settings.fancyBox3Opt) ? settings.fancyBox3Opt : [],
    randomPostPt: settings.randomPostPt || 0,
    enableQrcode: settings.enableQrcode !== false,
    hotKeys: !!settings.hotKeys,
    pageSize: settings.pageSize || 24,
    ...runtimeConfig
  };

  const sideButtons = `<div id="side-button"><ul>
  <li id="go-top" title="返回顶部"><span class="glyphicon glyphicon-chevron-up"></span></li>
  <li id="go-bottom" title="前往底部"><span class="glyphicon glyphicon-chevron-down"></span></li>
  <li id="show-qrcode" title="二维码"><span class="glyphicon glyphicon-qrcode"></span></li>
  <li id="go-random" title="随机相册"><span class="glyphicon glyphicon-random"></span></li>
</ul></div>`;

  return html(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <link rel="icon" href="${escapeHtml(favicon)}" />
  <link rel="stylesheet" href="/bootstrap3/css/bootstrap.min.css" />
  <link rel="stylesheet" href="/fancybox3/jquery.fancybox.min.css" />
  <link rel="stylesheet" href="/style.css" />
  ${dynamicStyle(settings)}
</head>
<body data-nav-style="${navStyle}">
${topNotice}
${header}
${body}
${sideButtons}
${bottomNotice}
<script>window.__siteConfig=${JSON.stringify(mergedRuntime)};</script>
<script src="/js/jquery-3.3.1.min.js"></script>
<script src="/bootstrap3/js/bootstrap.min.js"></script>
<script src="/js/jquery.lazyload.js"></script>
<script src="/js/masonry-docs.min.js"></script>
<script src="/js/infinite-scroll.pkgd.min.js"></script>
<script src="/fancybox3/jquery.fancybox.min.js"></script>
<script src="/js/qrcode.js"></script>
<script src="/js/shortcut.js"></script>
<script src="/js/photograph-runtime.js"></script>
</body>
</html>`);
}
