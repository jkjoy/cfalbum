import { adminShell } from '../_lib/admin-layout.js';
import { requireAdmin } from '../_lib/auth.js';
import { escapeHtml } from '../_lib/utils.js';

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return Response.redirect(new URL('/admin/login', context.request.url), 302);

  const body = `
<div style="margin-bottom:15px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
  <div>已登录：<strong>${escapeHtml(auth.admin.username)}</strong></div>
  <div>
    <a class="btn btn-primary" href="/admin/settings">站点设置</a>
    <a class="btn btn-success" href="/admin/albums/new">新建相册</a>
    <button class="btn btn-default" id="logout-btn">退出登录</button>
  </div>
</div>
<div class="panel panel-default">
  <div class="panel-heading"><strong>相册管理</strong></div>
  <div class="table-responsive">
    <table class="table table-striped table-hover">
      <thead><tr><th>ID</th><th>标题</th><th>分类</th><th>图片数</th><th>公开</th><th>操作</th></tr></thead>
      <tbody id="album-table"><tr><td colspan="6">加载中...</td></tr></tbody>
    </table>
  </div>
</div>
<script>
(function(){
  async function load() {
    var resp = await fetch('/api/admin/albums');
    if (resp.status === 401) { location.href = '/admin/login'; return; }
    var data = await resp.json();
    var rows = (data.items || []).map(function(a){
      return '<tr>'
        + '<td>' + a.id + '</td>'
        + '<td>' + a.title + '</td>'
        + '<td>' + (a.category || '') + '</td>'
        + '<td>' + (a.photoCount || 0) + '</td>'
        + '<td>' + (a.isPublic ? '是' : '否') + '</td>'
        + '<td>'
        + '<a class="btn btn-xs btn-info" href="/admin/albums/' + a.id + '/edit">编辑</a> '
        + '<button class="btn btn-xs btn-danger" onclick="window.delAlbum(' + a.id + ')">删除</button>'
        + '</td>'
        + '</tr>';
    }).join('');
    document.getElementById('album-table').innerHTML = rows || '<tr><td colspan="6">暂无相册</td></tr>';
  }

  window.delAlbum = async function(id) {
    if (!confirm('确认删除该相册及其所有图片？')) return;
    var resp = await fetch('/api/admin/albums/' + id, { method: 'DELETE' });
    if (resp.ok) load();
  };

  document.getElementById('logout-btn').addEventListener('click', async function(){
    await fetch('/api/admin/logout', { method: 'POST' });
    location.href = '/admin/login';
  });

  load();
})();
</script>`;

  return adminShell({ title: 'Admin', body });
}
