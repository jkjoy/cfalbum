import { adminShell } from '../../_lib/admin-layout.js';
import { requireAdmin } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (auth.error) return Response.redirect(new URL('/admin/login', context.request.url), 302);

  const body = `
<div class="panel panel-default" style="max-width:700px;margin:10px auto;">
  <div class="panel-heading"><strong>新建相册</strong></div>
  <div class="panel-body">
    <form id="album-form">
      <div class="form-group"><label>标题</label><input class="form-control" name="title" required /></div>
      <div class="form-group"><label>Slug（可留空自动生成）</label><input class="form-control" name="slug" /></div>
      <div class="form-group"><label>分类</label><input class="form-control" name="category" value="默认分类" /></div>
      <div class="form-group"><label>标签（逗号分隔）</label><input class="form-control" name="tags" /></div>
      <div class="form-group"><label>描述</label><textarea class="form-control" name="description" rows="4"></textarea></div>
      <div class="checkbox"><label><input type="checkbox" name="isPublic" checked /> 公开展示</label></div>
      <button class="btn btn-primary" type="submit">创建</button>
      <a class="btn btn-default" href="/admin">返回</a>
    </form>
  </div>
</div>
<script>
  document.getElementById('album-form').addEventListener('submit', async function(e){
    e.preventDefault();
    var fd = new FormData(e.target);
    var payload = {
      title: fd.get('title'),
      slug: fd.get('slug'),
      category: fd.get('category'),
      tags: String(fd.get('tags') || '').split(',').map(function(x){ return x.trim(); }).filter(Boolean),
      description: fd.get('description'),
      isPublic: fd.get('isPublic') === 'on'
    };
    var resp = await fetch('/api/admin/albums', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      var data = await resp.json().catch(function(){ return { error: '创建失败' }; });
      alert(data.error || '创建失败');
      return;
    }
    var data = await resp.json();
    location.href = '/admin/albums/' + data.album.id + '/edit';
  });
</script>`;

  return adminShell({ title: 'Create Album', body });
}
