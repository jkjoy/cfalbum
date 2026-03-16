import { adminShell } from '../../../_lib/admin-layout.js';
import { requireAdmin } from '../../../_lib/auth.js';
import { escapeHtml } from '../../../_lib/utils.js';

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return Response.redirect(new URL('/admin/login', context.request.url), 302);

  const id = Number.parseInt(context.params.id, 10);
  if (!Number.isFinite(id)) return Response.redirect(new URL('/admin', context.request.url), 302);

  const body = `
<div style="margin-bottom:10px;"><a class="btn btn-default" href="/admin">返回列表</a></div>
<div class="panel panel-default" style="margin-bottom:15px;">
  <div class="panel-heading"><strong>编辑相册 #${id}</strong></div>
  <div class="panel-body">
    <form id="album-form">
      <div class="form-group"><label>标题</label><input class="form-control" name="title" required /></div>
      <div class="form-group"><label>Slug</label><input class="form-control" name="slug" /></div>
      <div class="form-group"><label>分类</label><input class="form-control" name="category" /></div>
      <div class="form-group"><label>标签（逗号分隔）</label><input class="form-control" name="tags" /></div>
      <div class="form-group"><label>封面 key（可空）</label><input class="form-control" name="coverKey" /></div>
      <div class="form-group"><label>描述</label><textarea class="form-control" name="description" rows="4"></textarea></div>
      <div class="checkbox"><label><input type="checkbox" name="isPublic" /> 公开展示</label></div>
      <button class="btn btn-primary" type="submit">保存</button>
    </form>
  </div>
</div>
<div class="panel panel-default">
  <div class="panel-heading"><strong>上传图片</strong></div>
  <div class="panel-body">
    <form id="upload-form">
      <input type="file" class="form-control" name="photos" accept="image/*" multiple required />
      <button class="btn btn-success" type="submit" style="margin-top:10px;">上传</button>
    </form>
  </div>
</div>
<div class="panel panel-default">
  <div class="panel-heading"><strong>图片列表</strong></div>
  <div class="panel-body"><div id="photos" class="row">加载中...</div></div>
</div>
<script>
(function(){
  var albumId = ${id};
  var album = null;

  function esc(s){
    return String(s || '').replace(/[&<>\"']/g, function (x) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' })[x]; });
  }

  async function load() {
    var resp = await fetch('/api/admin/albums/' + albumId);
    if (resp.status === 401) { location.href = '/admin/login'; return; }
    if (!resp.ok) { alert('加载失败'); return; }

    var data = await resp.json();
    album = data.album;

    var form = document.getElementById('album-form');
    form.title.value = album.title || '';
    form.slug.value = album.slug || '';
    form.category.value = album.category || '';
    form.tags.value = (album.tags || []).join(', ');
    form.coverKey.value = album.cover_key || '';
    form.description.value = album.description || '';
    form.isPublic.checked = album.is_public === 1;

    var photos = data.photos || [];
    document.getElementById('photos').innerHTML = photos.map(function(p){
      var src = '/api/object/' + encodeURIComponent(p.r2_key);
      return '<div class="col-xs-6 col-sm-4 col-md-3" style="margin-bottom:10px;">'
        + '<div class="thumbnail">'
        + '<img src="' + src + '" alt="' + esc(p.r2_key) + '">'
        + '<div class="caption" style="padding:8px 4px;">'
        + '<div style="font-size:12px;word-break:break-all;height:36px;overflow:hidden;">' + esc(p.r2_key) + '</div>'
        + '<button class="btn btn-xs btn-danger" onclick="window.delPhoto(' + p.id + ')">删除</button>'
        + '</div></div></div>';
    }).join('') || '<p>暂无图片</p>';
  }

  window.delPhoto = async function(photoId){
    if (!confirm('确认删除该图片？')) return;
    var resp = await fetch('/api/admin/photos/' + photoId, { method: 'DELETE' });
    if (!resp.ok) { alert('删除失败'); return; }
    load();
  };

  document.getElementById('album-form').addEventListener('submit', async function(e){
    e.preventDefault();
    var fd = new FormData(e.target);
    var payload = {
      title: fd.get('title'),
      slug: fd.get('slug'),
      category: fd.get('category'),
      tags: String(fd.get('tags') || '').split(',').map(function(x){ return x.trim(); }).filter(Boolean),
      coverKey: fd.get('coverKey'),
      description: fd.get('description'),
      isPublic: fd.get('isPublic') === 'on'
    };
    var resp = await fetch('/api/admin/albums/' + albumId, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      var data = await resp.json().catch(function(){ return { error: '保存失败' }; });
      alert(data.error || '保存失败');
      return;
    }
    alert('保存成功');
    load();
  });

  document.getElementById('upload-form').addEventListener('submit', async function(e){
    e.preventDefault();
    var fd = new FormData(e.target);
    var resp = await fetch('/api/admin/albums/' + albumId + '/photos', { method: 'POST', body: fd });
    if (!resp.ok) {
      var data = await resp.json().catch(function(){ return { error: '上传失败' }; });
      alert(data.error || '上传失败');
      return;
    }
    e.target.reset();
    load();
  });

  load();
})();
</script>`;

  return adminShell({ title: `Edit Album ${id}`, body: body.replace(/__USER__/g, escapeHtml(auth.admin.username)) });
}
