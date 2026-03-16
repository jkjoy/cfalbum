import { adminShell } from '../_lib/admin-layout.js';

export async function onRequestGet() {
  const body = `
<div class="panel panel-default" style="max-width:420px;margin:30px auto;">
  <div class="panel-heading"><strong>管理员登录</strong></div>
  <div class="panel-body">
    <form id="login-form">
      <div class="form-group">
        <label>用户名</label>
        <input class="form-control" name="username" required autocomplete="username" />
      </div>
      <div class="form-group">
        <label>密码</label>
        <input type="password" class="form-control" name="password" required autocomplete="current-password" />
      </div>
      <button class="btn btn-primary btn-block" type="submit">登录</button>
      <p id="err" style="color:#d9534f;margin-top:10px;"></p>
    </form>
  </div>
</div>
<script>
  document.getElementById('login-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var payload = { username: fd.get('username'), password: fd.get('password') };
    var resp = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (resp.ok) {
      location.href = '/admin';
      return;
    }
    var data = await resp.json().catch(function(){ return { error: '登录失败' }; });
    document.getElementById('err').textContent = data.error || '登录失败';
  });
</script>`;

  return adminShell({ title: 'Admin Login', body });
}
