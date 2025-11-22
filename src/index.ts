/**
 * Cloudflare Workers 相册系统
 * 功能：图片上传、展示、管理、缩略图生成
 * 本版本仅把首页 gallery 换成 Lightbox2 图库，其余不动
 */

// 简单的认证检查
function checkAuth(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const sessionMatch = cookie.match(/session=([^;]+)/);
  if (!sessionMatch) return false;

  const session = sessionMatch[1];
  // 简单验证：session 应该是密码的 hash
  const expectedSession = btoa(env.ADMIN_PASSWORD || 'admin123');
  return session === expectedSession;
}

// 生成 session
function generateSession(password) {
  return btoa(password);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS 头部
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // 处理 OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 路由处理
      if (path === '/' || path === '/index.html') {
        return handleHome(env);
      } else if (path === '/admin/login') {
        return handleLoginPage(env);
      } else if (path === '/api/login' && request.method === 'POST') {
        return handleLogin(request, env);
      } else if (path === '/api/logout' && request.method === 'POST') {
        return handleLogout();
      } else if (path === '/admin') {
        if (!checkAuth(request, env)) {
          return Response.redirect(new URL('/admin/login', request.url).toString(), 302);
        }
        return handleAdmin(env);
      } else if (path === '/api/photos' && request.method === 'GET') {
        return handleGetPhotos(env, corsHeaders);
      } else if (path === '/api/photos' && request.method === 'POST') {
        if (!checkAuth(request, env)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return handleUploadPhoto(request, env, corsHeaders);
      } else if (path.startsWith('/api/photos/') && request.method === 'DELETE') {
        if (!checkAuth(request, env)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return handleDeletePhoto(request, env, corsHeaders);
      } else if (path.startsWith('/api/photos/') && request.method === 'PUT') {
        if (!checkAuth(request, env)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return handleUpdatePhoto(request, env, corsHeaders);
      } else if (path.startsWith('/images/')) {
        return handleGetImage(path, env, url, corsHeaders);
      } else {
        return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

/* -------------------------------------------------
 * 以下所有函数与原版完全一致，仅 getHomeHTML() 被替换
 * ------------------------------------------------- */
async function handleLogin(request, env) {
  const formData = await request.formData();
  const password = formData.get('password');
  const correctPassword = env.ADMIN_PASSWORD || 'admin123';
  if (password === correctPassword) {
    const session = generateSession(password);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `session=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`,
      },
    });
  } else {
    return new Response(JSON.stringify({ error: 'Invalid password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function handleLogout() {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
    },
  });
}

async function handleGetPhotos(env, corsHeaders) {
  const list = await env.PHOTO_METADATA.list();
  const photos = [];
  for (const key of list.keys) {
    const metadata = await env.PHOTO_METADATA.get(key.name, 'json');
    if (metadata) photos.push({ id: key.name, ...metadata });
  }
  photos.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  return new Response(JSON.stringify(photos), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleUploadPhoto(request, env, corsHeaders) {
  const formData = await request.formData();
  const file = formData.get('file');
  const title = formData.get('title') || '';
  const description = formData.get('description') || '';
  if (!file) {
    return new Response(JSON.stringify({ error: 'No file uploaded' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const photoId = crypto.randomUUID();
  const fileExtension = file.name.split('.').pop();
  const fileName = `${photoId}.${fileExtension}`;
  const arrayBuffer = await file.arrayBuffer();
  await env.PHOTO_BUCKET.put(`originals/${fileName}`, arrayBuffer, {
    httpMetadata: { contentType: file.type },
  });
  const metadata = {
    fileName,
    originalName: file.name,
    size: file.size,
    type: file.type,
    title: title || file.name,
    description: description || '',
    uploadedAt: new Date().toISOString(),
  };
  await env.PHOTO_METADATA.put(photoId, JSON.stringify(metadata));
  return new Response(JSON.stringify({ success: true, photoId, metadata }), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleDeletePhoto(request, env, corsHeaders) {
  const photoId = request.url.split('/').pop();
  const metadata = await env.PHOTO_METADATA.get(photoId, 'json');
  if (!metadata) {
    return new Response(JSON.stringify({ error: 'Photo not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  await env.PHOTO_BUCKET.delete(`originals/${metadata.fileName}`);
  await env.PHOTO_BUCKET.delete(`thumbnails/${metadata.fileName}`);
  await env.PHOTO_METADATA.delete(photoId);
  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleUpdatePhoto(request, env, corsHeaders) {
  const photoId = request.url.split('/').pop();
  const updates = await request.json();
  const metadata = await env.PHOTO_METADATA.get(photoId, 'json');
  if (!metadata) {
    return new Response(JSON.stringify({ error: 'Photo not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (updates.title !== undefined) metadata.title = updates.title;
  if (updates.description !== undefined) metadata.description = updates.description;
  metadata.updatedAt = new Date().toISOString();
  await env.PHOTO_METADATA.put(photoId, JSON.stringify(metadata));
  return new Response(JSON.stringify({ success: true, metadata }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleGetImage(path, env, url, corsHeaders) {
  const parts = path.split('/').filter(p => p);
  if (parts.length < 3) return new Response('Invalid image path', { status: 400 });
  const type = parts[1]; // 'originals' or 'thumbnails'
  const filename = parts[2];
  const size = url.searchParams.get('size'); // 'thumbnail', 'medium', 'large'
  const object = await env.PHOTO_BUCKET.get(`originals/${filename}`);
  if (!object) return new Response('Image not found', { status: 404 });
  const headers = {
    ...corsHeaders,
    'Content-Type': object.httpMetadata.contentType,
    'Cache-Control': 'public, max-age=31536000',
    ETag: object.etag,
  };
  if (size === 'thumbnail') {
    headers['CF-Image-Fit'] = 'cover';
    headers['CF-Image-Width'] = '300';
    headers['CF-Image-Height'] = '300';
  } else if (size === 'medium') {
    headers['CF-Image-Fit'] = 'scale-down';
    headers['CF-Image-Width'] = '800';
  }
  return new Response(object.body, { headers });
}

function handleHome(env) {
  return new Response(getHomeHTML(), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function handleAdmin(env) {
  return new Response(getAdminHTML(), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function handleLoginPage(env) {
  return new Response(getLoginHTML(), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/* ==========================================
 * 以下 3 个 HTML 函数：仅 getHomeHTML() 换成 Lightbox2 图库
 * ========================================== */
function getHomeHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>我的相册</title>
    <!-- Lightbox2 -->
    <link href="https://cdn.staticfile.org/lightbox2/2.11.3/css/lightbox.min.css" rel="stylesheet">
    <style>
        body{
            margin:0;
            font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
            background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height:100vh;
            padding:20px;
        }
        .header{
            text-align:center;
            margin-bottom:40px;
            padding:60px 20px;
            background:rgba(255,255,255,.95);
            border-radius:20px;
            box-shadow:0 10px 40px rgba(0,0,0,.2);
        }
        h1{margin:0 0 15px;font-size:3em;font-weight:700;color:#333}
        .subtitle{color:#666;font-size:1.1em}
        /* 图库容器：照搬用户给出的样式 */
        #main .inner .gallery-container{
            width:100%;
            display:flex;
            flex-flow:wrap;
            gap:10px 20px;
            padding-bottom:30px;
        }
        #main .inner .gallery-container .picture-container{
            min-width:200px;
            flex:0 0 calc(33.333% - 13.333px);
        }
        @media screen and (max-width:736px){
            #main .inner .gallery-container .picture-container{flex:0 0 calc(50% - 20px)}
        }
        @media screen and (max-width:480px){
            #main .inner .gallery-container .picture-container{flex:0 0 100%}
        }
        #main .inner .gallery-container .picture-container a{border:none}
        #main .inner .gallery-container .picture-container a .img-thumbnail{
            border-radius:4px;
            width:100%;
            display:block;
        }
        .admin-link{
            position:fixed;
            bottom:30px;
            right:30px;
            background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color:#fff;
            padding:15px 25px;
            border-radius:50px;
            text-decoration:none;
            box-shadow:0 8px 25px rgba(102,126,234,.4);
            transition:all .3s;
            font-weight:600;
            z-index:100;
        }
        .admin-link:hover{transform:translateY(-3px);box-shadow:0 12px 35px rgba(102,126,234,.6)}
    </style>
</head>
<body>
    <div class="header">
        <h1>📸 我的相册</h1>
        <p class="subtitle">精心收藏的每一个瞬间</p>
    </div>

    <div id="main">
        <div class="inner">
            <div class="gallery-container" id="gallery">
                <div class="loading">✨ 加载中...</div>
            </div>
        </div>
    </div>

    <a href="/admin" class="admin-link">🔧 管理后台</a>

    <script src="https://cdn.staticfile.org/lightbox2/2.11.3/js/lightbox-plus-jquery.min.js"></script>
    <script>
        async function loadPhotos(){
            try{
                const photos = await fetch('/api/photos').then(r=>r.json());
                const box = document.getElementById('gallery');
                if(!photos.length){
                    box.innerHTML='<div class="loading">📷 暂无照片<br><small>请前往管理后台上传第一张照片</small></div>';
                    return;
                }
                box.innerHTML = photos.map((p,i)=>{
                    const title = p.title || p.originalName;
                    const desc  = p.description || '';
                    const thumb = '/images/originals/'+ p.fileName + '?size=thumbnail';
                    const full  = '/images/originals/'+ p.fileName;
                    return `
                    <div class="picture-container">
                        <a href="${full}" data-lightbox="album" data-title="${title} - ${desc}">
                            <img src="${thumb}" class="img-thumbnail" loading="lazy" alt="${title}">
                        </a>
                    </div>`;
                }).join('');
            }catch(e){
                console.error(e);
                document.getElementById('gallery').innerHTML='<div class="loading">❌ 加载失败</div>';
            }
        }
        loadPhotos();
    </script>
</body>
</html>`;
}

function getAdminHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>相册管理后台</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f5f5f5;padding:20px}
        .header{background:#fff;padding:20px;border-radius:10px;margin-bottom:20px;box-shadow:0 2px 10px rgba(0,0,0,.1);display:flex;justify-content:space-between;align-items:center}
        h1{margin:0}
        .logout-btn{background:#6c757d;color:#fff;padding:10px 20px;border:none;border-radius:5px;cursor:pointer;font-size:14px;transition:background .3s}
        .logout-btn:hover{background:#5a6268}
        .upload-section{background:#fff;padding:30px;border-radius:10px;margin-bottom:20px;box-shadow:0 2px 10px rgba(0,0,0,.1)}
        .form-group{margin-bottom:15px}
        label{display:block;margin-bottom:5px;font-weight:500;color:#333}
        input[type="text"],textarea,input[type="file"]{width:100%;padding:10px;border:1px solid #ddd;border-radius:5px;font-size:14px}
        textarea{min-height:80px;resize:vertical}
        .btn{background:#007bff;color:#fff;padding:12px 30px;border:none;border-radius:5px;cursor:pointer;font-size:16px;transition:background .3s}
        .btn:hover{background:#0056b3}
        .btn-danger{background:#dc3545}
        .btn-danger:hover{background:#c82333}
        .btn-small{padding:8px 15px;font-size:14px;margin-right:5px}
        .photo-list{background:#fff;padding:20px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.1)}
        .photo-item{display:flex;gap:20px;padding:15px;border-bottom:1px solid #eee;align-items:center}
        .photo-item:last-child{border-bottom:none}
        .photo-thumb{width:100px;height:100px;object-fit:cover;border-radius:5px}
        .photo-details{flex:1}
        .photo-actions{display:flex;gap:10px}
        .status{padding:10px 15px;border-radius:5px;margin-bottom:20px;display:none}
        .status.success{background:#d4edda;color:#155724;border:1px solid #c3e6cb}
        .status.error{background:#f8d7da;color:#721c24;border:1px solid #f5c6cb}
        .back-link{color:#007bff;text-decoration:none;display:inline-block;margin-bottom:20px}
        .preview-section{margin-top:15px}
        .preview-img{max-width:300px;max-height:300px;border-radius:5px;margin-top:10px}
        .file-info{background:#f8f9fa;padding:10px;border-radius:5px;margin-top:10px;font-size:12px;color:#666}
    </style>
</head>
<body>
    <a href="/" class="back-link">← 返回相册</a>
    <div class="header">
        <h1>相册管理后台</h1>
        <button class="logout-btn" onclick="logout()">退出登录</button>
    </div>
    <div id="status" class="status"></div>
    <div class="upload-section">
        <h2>上传照片</h2>
        <form id="uploadForm">
            <div class="form-group">
                <label>选择图片</label>
                <input type="file" id="fileInput" accept="image/*" required>
            </div>
            <div class="preview-section" id="previewSection" style="display:none;">
                <img id="previewImg" class="preview-img">
                <div id="fileInfo" class="file-info"></div>
            </div>
            <div class="form-group">
                <label>标题（可选）</label>
                <input type="text" id="title" placeholder="照片标题">
            </div>
            <div class="form-group">
                <label>描述（可选）</label>
                <textarea id="description" placeholder="照片描述"></textarea>
            </div>
            <button type="submit" class="btn">上传照片</button>
        </form>
    </div>
    <div class="photo-list">
        <h2>已上传的照片</h2>
        <div id="photoList">加载中...</div>
    </div>
    <script>
        document.getElementById('fileInput').addEventListener('change', async function(e){
            const file = e.target.files[0];
            if(!file)return;
            const reader=new FileReader();
            reader.onload=function(e){
                document.getElementById('previewImg').src=e.target.result;
                document.getElementById('previewSection').style.display='block';
            };
            reader.readAsDataURL(file);
            document.getElementById('fileInfo').innerHTML=
                `文件名: ${file.name}<br>大小: ${(file.size/1024/1024).toFixed(2)} MB<br>类型: ${file.type}`;
        });
        document.getElementById('uploadForm').addEventListener('submit',async function(e){
            e.preventDefault();
            const file=document.getElementById('fileInput').files[0];
            if(!file){showStatus('请选择文件','error');return;}
            const formData=new FormData();
            formData.append('file',file);
            formData.append('title',document.getElementById('title').value);
            formData.append('description',document.getElementById('description').value);
            try{
                showStatus('上传中...','success');
                const res=await fetch('/api/photos',{method:'POST',body:formData});
                const json=await res.json();
                if(res.ok){showStatus('上传成功！','success');document.getElementById('uploadForm').reset();document.getElementById('previewSection').style.display='none';loadPhotos();}
                else showStatus('上传失败: '+json.error,'error');
            }catch(err){showStatus('上传失败: '+err.message,'error');}
        });
        async function loadPhotos(){
            try{
                const photos=await fetch('/api/photos').then(r=>r.json());
                const list=document.getElementById('photoList');
                if(!photos.length){list.innerHTML='<p>暂无照片</p>';return;}
                list.innerHTML=photos.map(p=>`
                    <div class="photo-item">
                        <img class="photo-thumb" src="/images/originals/${p.fileName}?size=thumbnail" alt="${p.title}">
                        <div class="photo-details">
                            <strong>${p.title||p.originalName}</strong><br>
                            <small>${p.description||'无描述'}</small><br>
                            <small style="color:#999;">
                                上传时间: ${new Date(p.uploadedAt).toLocaleString('zh-CN')}<br>
                                文件大小: ${(p.size/1024/1024).toFixed(2)} MB
                            </small>
                        </div>
                        <div class="photo-actions">
                            <button class="btn btn-small" onclick="editPhoto('${p.id}','${escape(p.title||'')}','${escape(p.description||'')}')">编辑</button>
                            <button class="btn btn-danger btn-small" onclick="deletePhoto('${p.id}')">删除</button>
                        </div>
                    </div>`).join('');
            }catch(e){document.getElementById('photoList').innerHTML='<p>加载失败</p>';}
        }
        function editPhoto(id,title,desc){
            const newTitle=prompt('修改标题:',title);
            if(newTitle===null)return;
            const newDesc=prompt('修改描述:',desc);
            if(newDesc===null)return;
            fetch(`/api/photos/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:newTitle,description:newDesc})})
                .then(r=>r.json()).then(()=>{showStatus('更新成功','success');loadPhotos();})
                .catch(e=>showStatus('更新失败: '+e.message,'error'));
        }
        function deletePhoto(id){
            if(!confirm('确定要删除这张照片吗？'))return;
            fetch(`/api/photos/${id}`,{method:'DELETE'})
                .then(r=>r.json()).then(()=>{showStatus('删除成功','success');loadPhotos();})
                .catch(e=>showStatus('删除失败: '+e.message,'error'));
        }
        function showStatus(msg,type){
            const s=document.getElementById('status');
            s.textContent=msg;s.className='status '+type;s.style.display='block';
            setTimeout(()=>s.style.display='none',3000);
        }
        function escape(str){return str.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
        async function logout(){
            if(!confirm('确定要退出登录吗？'))return;
            try{await fetch('/api/logout',{method:'POST'});window.location.href='/admin/login';}
            catch(e){alert('登出失败：'+e.message);}
        }
        loadPhotos();
    </script>
</body>
</html>`;
}

function getLoginHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>登录 - 相册管理</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);min-height:100vh;display:flex;justify-content:center;align-items:center;padding:20px}
        .login-container{background:#fff;padding:40px;border-radius:15px;box-shadow:0 20px 60px rgba(0,0,0,.3);max-width:400px;width:100%}
        h1{text-align:center;margin-bottom:10px;color:#333}
        .subtitle{text-align:center;color:#666;margin-bottom:30px;font-size:14px}
        .form-group{margin-bottom:20px}
        label{display:block;margin-bottom:8px;font-weight:500;color:#333}
        input[type="password"]{width:100%;padding:12px;border:2px solid #e0e0e0;border-radius:8px;font-size:16px;transition:border-color .3s}
        input[type="password"]:focus{outline:none;border-color:#667eea}
        .btn{width:100%;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:#fff;padding:14px;border:none;border-radius:8px;cursor:pointer;font-size:16px;font-weight:600;transition:transform .2s}
        .btn:hover{transform:translateY(-2px)}
        .btn:active{transform:translateY(0)}
        .error{background:#fee;color:#c33;padding:12px;border-radius:8px;margin-bottom:20px;display:none;border:1px solid #fcc}
        .back-link{text-align:center;margin-top:20px}
        .back-link a{color:#667eea;text-decoration:none}
        .back-link a:hover{text-decoration:underline}
    </style>
</head>
<body>
    <div class="login-container">
        <h1>🔐 管理员登录</h1>
        <p class="subtitle">请输入密码访问相册管理后台</p>
        <div id="error" class="error"></div>
        <form id="loginForm">
            <div class="form-group">
                <label for="password">密码</label>
                <input type="password" id="password" name="password" required autofocus placeholder="请输入管理员密码">
            </div>
            <button type="submit" class="btn">登录</button>
        </form>
        <div class="back-link">
            <a href="/">← 返回相册首页</a>
        </div>
    </div>
    <script>
        document.getElementById('loginForm').addEventListener('submit',async function(e){
            e.preventDefault();
            const password=document.getElementById('password').value;
            const errorDiv=document.getElementById('error');
            try{
                const formData=new FormData();
                formData.append('password',password);
                const res=await fetch('/api/login',{method:'POST',body:formData});
                const json=await res.json();
                if(res.ok&&json.success){window.location.href='/admin';}
                else{errorDiv.textContent='密码错误，请重试';errorDiv.style.display='block';document.getElementById('password').value='';document.getElementById('password').focus();}
            }catch(err){errorDiv.textContent='登录失败：'+err.message;errorDiv.style.display='block';}
        });
    </script>
</body>
</html>`;
}