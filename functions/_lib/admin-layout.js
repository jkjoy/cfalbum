import { pageShell } from './layout.js';
import { escapeHtml } from './utils.js';

const adminSettings = {
  siteTitle: 'Admin',
  logo: '',
  favicon: '',
  description: '',
  navStyle: 'ins',
  pageSize: 24,
  colXs: 12,
  colSm: 6,
  colMd: 4,
  colLg: 3,
  coverHeightTimes: 1,
  imgHeightTimes: 1,
  coverTitle: 1,
  coverRadius: ['cr_tl', 'cr_tr', 'cr_br', 'cr_bl'],
  coverTitleBorder: ['ctb_t', 'ctb_r', 'ctb_b', 'ctb_l'],
  coverTitleRadius: ['ctr_tl', 'ctr_tr', 'ctr_br', 'ctr_bl'],
  coverOrn: 'co_none',
  sideButton: 3,
  notice: '',
  noticeStyle: 'bottom',
  noticeColor: '',
  diyCss: '',
  infiniteScroll: false,
  fancyBox3Opt: ['fb3_download', 'fb3_thumbs', 'fb3_close'],
  lazyImg: '/src/lazy.svg',
  mobileCate: false,
  randomPostPt: 0,
  enableQrcode: false,
  hotKeys: false
};

export function adminShell({ title, body }) {
  const safeTitle = escapeHtml(title || 'Admin');
  return pageShell({
    title: safeTitle,
    settings: adminSettings,
    body: `
<header class="header">
  <h1 class="header-title anti-select"><a href="/admin">Admin</a></h1>
</header>
<div class="content" style="max-width:1100px;margin:20px auto;padding:0 10px;">
  ${body}
</div>`
  });
}
