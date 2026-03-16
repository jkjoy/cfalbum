import { adminShell } from '../_lib/admin-layout.js';
import { requireAdmin } from '../_lib/auth.js';

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return Response.redirect(new URL('/admin/login', context.request.url), 302);

  const body = `
<div style="margin-bottom:10px;"><a class="btn btn-default" href="/admin">返回控制台</a></div>
<div class="panel panel-default" style="max-width:980px;margin:0 auto;">
  <div class="panel-heading"><strong>站点设置</strong></div>
  <div class="panel-body">
    <form id="settings-form">
      <h4>基础信息</h4>
      <div class="row">
        <div class="col-sm-6 form-group"><label>站点标题</label><input class="form-control" name="siteTitle"></div>
        <div class="col-sm-6 form-group"><label>导航样式</label>
          <select class="form-control" name="navStyle">
            <option value="ins">ins</option><option value="boot">boot</option>
          </select>
        </div>
      </div>
      <div class="row">
        <div class="col-sm-6 form-group"><label>站点 Logo 地址</label><input class="form-control" name="logo"></div>
        <div class="col-sm-6 form-group"><label>网站图标地址（Favicon）</label><input class="form-control" name="favicon"></div>
      </div>
      <div class="form-group"><label>站点描述</label><textarea class="form-control" name="description" rows="2"></textarea></div>
      <div class="form-group"><label>每页数量（pageSize）</label><input class="form-control" type="number" min="1" max="60" name="pageSize"></div>

      <hr><h4>布局网格</h4>
      <div class="row">
        <div class="col-sm-3 form-group"><label>手机端列宽（colXs）</label><input class="form-control" type="number" min="1" max="12" name="colXs"></div>
        <div class="col-sm-3 form-group"><label>小屏列宽（colSm）</label><input class="form-control" type="number" min="1" max="12" name="colSm"></div>
        <div class="col-sm-3 form-group"><label>中屏列宽（colMd）</label><input class="form-control" type="number" min="1" max="12" name="colMd"></div>
        <div class="col-sm-3 form-group"><label>大屏列宽（colLg）</label><input class="form-control" type="number" min="1" max="12" name="colLg"></div>
      </div>
      <div class="row">
        <div class="col-sm-6 form-group"><label>封面高度倍率（coverHeightTimes）</label><input class="form-control" type="number" step="0.1" min="0.2" max="4" name="coverHeightTimes"></div>
        <div class="col-sm-6 form-group"><label>图片高度倍率（imgHeightTimes）</label><input class="form-control" type="number" step="0.1" min="0.2" max="4" name="imgHeightTimes"></div>
      </div>

      <hr><h4>封面样式</h4>
      <div class="row">
        <div class="col-sm-4 form-group"><label>封面标题透明度（coverTitle，0-1）</label><input class="form-control" type="number" step="0.1" min="0" max="1" name="coverTitle"></div>
        <div class="col-sm-4 form-group"><label>封面装饰（coverOrn）</label>
          <select class="form-control" name="coverOrn"><option value="co_none">无装饰（co_none）</option><option value="co_cat">猫咪装饰（co_cat）</option></select>
        </div>
        <div class="col-sm-4 form-group"><label>侧边按钮样式（sideButton，1-4）</label><input class="form-control" type="number" min="1" max="4" name="sideButton"></div>
      </div>
      <div class="form-group"><label>封面圆角位置（coverRadius）</label><div id="coverRadiusWrap"></div></div>
      <div class="form-group"><label>标题边框位置（coverTitleBorder）</label><div id="coverTitleBorderWrap"></div></div>
      <div class="form-group"><label>标题圆角位置（coverTitleRadius）</label><div id="coverTitleRadiusWrap"></div></div>

      <hr><h4>交互功能</h4>
      <div class="checkbox"><label><input type="checkbox" name="infiniteScroll"> 启用无限滚动（infiniteScroll）</label></div>
      <div class="checkbox"><label><input type="checkbox" name="mobileCate"> 启用移动端分类（mobileCate）</label></div>
      <div class="checkbox"><label><input type="checkbox" name="enableQrcode"> 启用二维码（enableQrcode）</label></div>
      <div class="checkbox"><label><input type="checkbox" name="hotKeys"> 启用快捷键（hotKeys）</label></div>
      <div class="form-group"><label>随机入口位置（randomPostPt）</label>
        <select class="form-control" name="randomPostPt"><option value="0">关闭（0）</option><option value="1">导航栏显示（1）</option></select>
      </div>
      <div class="form-group"><label>懒加载占位图地址（lazyImg）</label><input class="form-control" name="lazyImg"></div>
      <div class="form-group"><label>灯箱按钮（fancyBox3Opt）</label><div id="fancyboxWrap"></div></div>

      <hr><h4>公告 + 自定义 CSS</h4>
      <div class="form-group"><label>公告内容（notice）</label><textarea class="form-control" name="notice" rows="2"></textarea></div>
      <div class="row">
        <div class="col-sm-6 form-group"><label>公告位置（noticeStyle）</label><select class="form-control" name="noticeStyle"><option value="bottom">底部（bottom）</option><option value="top">顶部（top）</option></select></div>
        <div class="col-sm-6 form-group"><label>公告颜色（noticeColor）</label><input class="form-control" name="noticeColor" placeholder="#333"></div>
      </div>
      <div class="form-group"><label>自定义样式（diyCss）</label><textarea class="form-control" name="diyCss" rows="6"></textarea></div>

      <button class="btn btn-primary" type="submit">保存设置</button>
    </form>
  </div>
</div>
<script>
(function(){
  var fancyOpts = [
    { value: 'fb3_zoom', label: '缩放（zoom）' },
    { value: 'fb3_share', label: '分享（share）' },
    { value: 'fb3_slideShow', label: '幻灯片（slideShow）' },
    { value: 'fb3_fullScreen', label: '全屏（fullScreen）' },
    { value: 'fb3_download', label: '下载（download）' },
    { value: 'fb3_thumbs', label: '缩略图（thumbs）' },
    { value: 'fb3_close', label: '关闭（close）' }
  ];
  var radiusOpts = [
    { value: 'cr_tl', label: '左上圆角（cr_tl）' },
    { value: 'cr_tr', label: '右上圆角（cr_tr）' },
    { value: 'cr_br', label: '右下圆角（cr_br）' },
    { value: 'cr_bl', label: '左下圆角（cr_bl）' }
  ];
  var borderOpts = [
    { value: 'ctb_t', label: '上边框（ctb_t）' },
    { value: 'ctb_r', label: '右边框（ctb_r）' },
    { value: 'ctb_b', label: '下边框（ctb_b）' },
    { value: 'ctb_l', label: '左边框（ctb_l）' }
  ];
  var titleRadiusOpts = [
    { value: 'ctr_tl', label: '标题左上圆角（ctr_tl）' },
    { value: 'ctr_tr', label: '标题右上圆角（ctr_tr）' },
    { value: 'ctr_br', label: '标题右下圆角（ctr_br）' },
    { value: 'ctr_bl', label: '标题左下圆角（ctr_bl）' }
  ];

  function renderChecks(containerId, name, options, selected){
    var set = new Set(Array.isArray(selected) ? selected : []);
    document.getElementById(containerId).innerHTML = options.map(function(opt){
      return '<label class="checkbox-inline" style="margin-right:10px;"><input type="checkbox" name="' + name + '" value="' + opt.value + '" ' + (set.has(opt.value) ? 'checked' : '') + '> ' + opt.label + '</label>';
    }).join('');
  }

  function pickArray(fd, name){
    return fd.getAll(name).map(function(x){ return String(x || '').trim(); }).filter(Boolean);
  }

  function toNum(v){
    var n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  async function load(){
    var resp = await fetch('/api/admin/settings');
    if (resp.status === 401) { location.href = '/admin/login'; return; }
    var data = await resp.json();
    var s = data.settings || {};
    var f = document.getElementById('settings-form');

    Object.keys(s).forEach(function(k){
      var el = f.elements[k];
      if (!el) return;
      if (el.type === 'checkbox') {
        el.checked = !!s[k];
      } else {
        el.value = s[k] == null ? '' : s[k];
      }
    });

    renderChecks('fancyboxWrap', 'fancyBox3Opt', fancyOpts, s.fancyBox3Opt || []);
    renderChecks('coverRadiusWrap', 'coverRadius', radiusOpts, s.coverRadius || []);
    renderChecks('coverTitleBorderWrap', 'coverTitleBorder', borderOpts, s.coverTitleBorder || []);
    renderChecks('coverTitleRadiusWrap', 'coverTitleRadius', titleRadiusOpts, s.coverTitleRadius || []);
  }

  document.getElementById('settings-form').addEventListener('submit', async function(e){
    e.preventDefault();
    var fd = new FormData(e.target);
    var payload = {
      siteTitle: String(fd.get('siteTitle') || ''),
      logo: String(fd.get('logo') || ''),
      favicon: String(fd.get('favicon') || ''),
      description: String(fd.get('description') || ''),
      navStyle: String(fd.get('navStyle') || 'ins'),
      pageSize: toNum(fd.get('pageSize')),
      colXs: toNum(fd.get('colXs')),
      colSm: toNum(fd.get('colSm')),
      colMd: toNum(fd.get('colMd')),
      colLg: toNum(fd.get('colLg')),
      coverHeightTimes: toNum(fd.get('coverHeightTimes')),
      imgHeightTimes: toNum(fd.get('imgHeightTimes')),
      coverTitle: toNum(fd.get('coverTitle')),
      coverRadius: pickArray(fd, 'coverRadius'),
      coverTitleBorder: pickArray(fd, 'coverTitleBorder'),
      coverTitleRadius: pickArray(fd, 'coverTitleRadius'),
      coverOrn: String(fd.get('coverOrn') || 'co_none'),
      sideButton: toNum(fd.get('sideButton')),
      infiniteScroll: fd.get('infiniteScroll') === 'on',
      fancyBox3Opt: pickArray(fd, 'fancyBox3Opt'),
      lazyImg: String(fd.get('lazyImg') || ''),
      mobileCate: fd.get('mobileCate') === 'on',
      randomPostPt: toNum(fd.get('randomPostPt')),
      enableQrcode: fd.get('enableQrcode') === 'on',
      hotKeys: fd.get('hotKeys') === 'on',
      notice: String(fd.get('notice') || ''),
      noticeStyle: String(fd.get('noticeStyle') || 'bottom'),
      noticeColor: String(fd.get('noticeColor') || ''),
      diyCss: String(fd.get('diyCss') || '')
    };

    var resp = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    var data = await resp.json().catch(function(){ return { error: '保存失败' }; });
    if (!resp.ok) {
      alert(data.error || '保存失败');
      return;
    }
    alert('保存成功，前台刷新后生效');
  });

  load();
})();
</script>`;

  return adminShell({ title: 'Site Settings', body });
}
