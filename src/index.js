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
        return handleGetPhotos(request, env, corsHeaders);
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
      } else if (path === '/api/settings' && request.method === 'GET') {
        return handleGetSettings(env, corsHeaders);
      } else if (path === '/api/settings' && request.method === 'PUT') {
        if (!checkAuth(request, env)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return handleUpdateSettings(request, env, corsHeaders);
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

async function handleGetPhotos(request, env, corsHeaders) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page')) || 1;
  const pageSize = parseInt(url.searchParams.get('pageSize')) || 6;

  const list = await env.PHOTO_METADATA.list();
  const photos = [];
  for (const key of list.keys) {
    // 排除系统设置项
    if (key.name === 'site_settings') continue;
    const metadata = await env.PHOTO_METADATA.get(key.name, 'json');
    if (metadata) photos.push({ id: key.name, ...metadata });
  }
  photos.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

  // 分页处理
  const total = photos.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paginatedPhotos = photos.slice(start, end);

  return new Response(JSON.stringify({
    photos: paginatedPhotos,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasMore: page < totalPages
    }
  }), {
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

async function handleGetSettings(env, corsHeaders) {
  const settings = await env.PHOTO_METADATA.get('site_settings', 'json');
  return new Response(JSON.stringify(settings || {}), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleUpdateSettings(request, env, corsHeaders) {
  const settings = await request.json();
  await env.PHOTO_METADATA.put('site_settings', JSON.stringify(settings));
  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleHome(env) {
  const settings = await env.PHOTO_METADATA.get('site_settings', 'json') || {};
  return new Response(getHomeHTML(settings), {
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
 * 以下 3 个 HTML 函数：仅 getHomeHTML() 换成优雅深色主题
 * ========================================== */
function getHomeHTML(settings = {}) {
  const siteTitle = settings.siteTitle || '我的相册';
  const siteKeywords = settings.siteKeywords || '相册,照片,图片';
  const siteDescription = settings.siteDescription || '精心收藏的每一个瞬间';
  const headCode = settings.headCode || '';
  const footerCode = settings.footerCode || '';
  const copyright = settings.copyright || '';
  const loadMode = settings.loadMode || 'pagination';
  const pageSize = settings.pageSize || 6;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="keywords" content="${siteKeywords}">
    <meta name="description" content="${siteDescription}">
    <title>${siteTitle}</title>
    ${headCode}
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Arial', sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            padding: 20px;
            color: #e6e6e6;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        h1 {
            text-align: center;
            color: #ffffff;
            margin-bottom: 40px;
            font-size: 2.5rem;
            font-weight: 300;
            letter-spacing: 2px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        .gallery {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            padding: 20px 0;
        }

        .photo-card {
            position: relative;
            overflow: hidden;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            transition: all 0.4s ease;
            cursor: pointer;
            background: rgba(30, 30, 46, 0.7);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .photo-card:hover {
            transform: translateY(-10px) scale(1.02);
            box-shadow: 0 15px 40px rgba(98, 0, 234, 0.4);
            border-color: rgba(98, 0, 234, 0.3);
        }

        .photo-card img {
            width: 100%;
            height: 250px;
            object-fit: cover;
            display: block;
            transition: transform 0.5s ease;
        }

        .photo-card:hover img {
            transform: scale(1.05);
        }

        .photo-info {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(to top, rgba(10, 10, 20, 0.9), transparent);
            color: white;
            padding: 20px;
            transform: translateY(100%);
            transition: transform 0.4s ease;
        }

        .photo-card:hover .photo-info {
            transform: translateY(0);
        }

        .photo-title {
            font-size: 1.2rem;
            margin-bottom: 5px;
            color: #ffffff;
        }

        .photo-date {
            font-size: 0.9rem;
            opacity: 0.8;
            color: #bbbbbb;
        }

        .loading {
            text-align: center;
            padding: 40px;
            color: #bbbbbb;
            font-size: 1.2rem;
        }

        @media (max-width: 768px) {
            .gallery {
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: 15px;
            }
            h1 {
                font-size: 2rem;
            }
        }

        .photo-card {
            animation: fadeIn 0.6s ease-out;
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.92);
            animation: fadeIn 0.3s ease;
        }

        .modal-content {
            position: relative;
            margin: auto;
            display: block;
            max-width: 90%;
            max-height: 90%;
            top: 50%;
            transform: translateY(-50%);
            box-shadow: 0 0 40px rgba(98, 0, 234, 0.5);
            border-radius: 10px;
            overflow: hidden;
        }

        .close {
            position: absolute;
            top: 20px;
            right: 35px;
            color: #f1f1f1;
            font-size: 40px;
            font-weight: bold;
            cursor: pointer;
            transition: color 0.3s ease;
            text-shadow: 0 2px 4px rgba(0,0,0,0.5);
            z-index: 1001;
        }

        .close:hover {
            color: #6200ea;
        }

        .admin-link {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(98, 0, 234, 0.8);
            color: #fff;
            padding: 12px 24px;
            border-radius: 50px;
            text-decoration: none;
            font-size: 14px;
            z-index: 100;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: all 0.3s ease;
        }

        .admin-link:hover {
            background: rgba(98, 0, 234, 1);
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(98, 0, 234, 0.4);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${siteTitle}</h1>
        <div class="gallery" id="gallery">
            <div class="loading">加载中...</div>
        </div>
        <div id="pagination" style="display: none; text-align: center; padding: 30px 20px;">
            <div style="display: inline-flex; gap: 10px; align-items: center;">
                <button id="prevBtn" class="page-btn" style="padding: 10px 20px; background: rgba(98, 0, 234, 0.8); color: #fff; border: none; border-radius: 5px; cursor: pointer; transition: all 0.3s;">上一页</button>
                <span id="pageInfo" style="color: #aaa; min-width: 100px;"></span>
                <button id="nextBtn" class="page-btn" style="padding: 10px 20px; background: rgba(98, 0, 234, 0.8); color: #fff; border: none; border-radius: 5px; cursor: pointer; transition: all 0.3s;">下一页</button>
            </div>
        </div>
        <div id="loadMore" style="display: none; text-align: center; padding: 30px 20px;">
            <button id="loadMoreBtn" style="padding: 12px 30px; background: rgba(98, 0, 234, 0.8); color: #fff; border: none; border-radius: 5px; cursor: pointer; transition: all 0.3s; font-size: 16px;">加载更多</button>
        </div>
        ${copyright ? `<div style="text-align: center; padding: 30px 20px; color: #888; font-size: 14px;">${copyright}</div>` : ''}
    </div>

    <a href="/admin" class="admin-link">管理后台</a>

    <div id="myModal" class="modal">
        <span class="close" onclick="closeModal()">&times;</span>
        <img class="modal-content" id="modalImg">
    </div>

    <script>
        const loadMode = '${loadMode}';
        const pageSize = ${pageSize};
        let currentPage = 1;
        let loadedPhotos = [];

        function openModal(imgSrc) {
            const modal = document.getElementById("myModal");
            const modalImg = document.getElementById("modalImg");
            modal.style.display = "block";
            modalImg.src = imgSrc;
        }

        function closeModal() {
            document.getElementById("myModal").style.display = "none";
        }

        window.onclick = function(event) {
            const modal = document.getElementById("myModal");
            if (event.target == modal) {
                modal.style.display = "none";
            }
        }

        function renderPhotos(photos, append = false) {
            const box = document.getElementById('gallery');
            if(!photos.length && !append){
                box.innerHTML='<div class="loading">暂无照片</div>';
                return;
            }

            const html = photos.map((p,i)=>{
                const title = p.title || p.originalName;
                const desc  = p.description || '';
                const thumb = '/images/originals/'+ p.fileName + '?size=thumbnail';
                const full  = '/images/originals/'+ p.fileName;
                const date = new Date(p.uploadedAt).toLocaleDateString('zh-CN', {
                    year: 'numeric', month: 'long', day: 'numeric'
                });
                return \`
                <div class="photo-card" onclick="openModal('\${full}')">
                    <picture>
                        <source srcset="\${thumb}&format=avif" type="image/avif">
                        <source srcset="\${thumb}&format=webp" type="image/webp">
                        <img src="\${thumb}" alt="\${title}" loading="lazy">
                    </picture>
                    <div class="photo-info">
                        <div class="photo-title">\${title}</div>
                        <div class="photo-date">\${date}</div>
                    </div>
                </div>\`;
            }).join('');

            if(append) {
                box.innerHTML += html;
            } else {
                box.innerHTML = html;
            }
        }

        async function loadPhotos(page = 1, append = false){
            try{
                const res = await fetch(\`/api/photos?page=\${page}&pageSize=\${pageSize}\`);
                const data = await res.json();

                if(append) {
                    loadedPhotos = loadedPhotos.concat(data.photos);
                } else {
                    loadedPhotos = data.photos;
                }

                renderPhotos(data.photos, append);

                if(loadMode === 'pagination') {
                    updatePagination(data.pagination);
                } else {
                    updateLoadMore(data.pagination);
                }
            }catch(e){
                console.error(e);
                document.getElementById('gallery').innerHTML='<div class="loading">加载失败</div>';
            }
        }

        function updatePagination(pagination) {
            const paginationDiv = document.getElementById('pagination');
            const prevBtn = document.getElementById('prevBtn');
            const nextBtn = document.getElementById('nextBtn');
            const pageInfo = document.getElementById('pageInfo');

            paginationDiv.style.display = pagination.totalPages > 1 ? 'block' : 'none';
            pageInfo.textContent = \`第 \${pagination.page} / \${pagination.totalPages} 页\`;

            prevBtn.disabled = pagination.page <= 1;
            nextBtn.disabled = !pagination.hasMore;

            prevBtn.style.opacity = prevBtn.disabled ? '0.5' : '1';
            nextBtn.style.opacity = nextBtn.disabled ? '0.5' : '1';
            prevBtn.style.cursor = prevBtn.disabled ? 'not-allowed' : 'pointer';
            nextBtn.style.cursor = nextBtn.disabled ? 'not-allowed' : 'pointer';
        }

        function updateLoadMore(pagination) {
            const loadMoreDiv = document.getElementById('loadMore');
            const loadMoreBtn = document.getElementById('loadMoreBtn');

            if(pagination.hasMore) {
                loadMoreDiv.style.display = 'block';
                loadMoreBtn.onclick = function() {
                    currentPage++;
                    loadPhotos(currentPage, true);
                };
            } else {
                loadMoreDiv.style.display = 'none';
            }
        }

        if(loadMode === 'pagination') {
            document.getElementById('prevBtn').onclick = function() {
                if(currentPage > 1) {
                    currentPage--;
                    loadPhotos(currentPage);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            };

            document.getElementById('nextBtn').onclick = function() {
                currentPage++;
                loadPhotos(currentPage);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
        }

        loadPhotos(currentPage);
    </script>
    ${footerCode}
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
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            padding: 20px;
            color: #e6e6e6;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            background: rgba(30, 30, 46, 0.7);
            backdrop-filter: blur(10px);
            padding: 20px 30px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            display: flex;
            justify-content: space-between;
            align-items: center;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        h1 {
            margin: 0;
            color: #ffffff;
            font-weight: 300;
            font-size: 1.8rem;
        }
        .logout-btn {
            background: rgba(220, 53, 69, 0.8);
            color: #fff;
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .logout-btn:hover {
            background: rgba(220, 53, 69, 1);
            transform: translateY(-2px);
        }
        .back-link {
            color: #6200ea;
            text-decoration: none;
            display: inline-block;
            margin-bottom: 20px;
            font-size: 14px;
            transition: color 0.3s;
        }
        .back-link:hover {
            color: #8e24aa;
        }
        .tabs {
            background: rgba(30, 30, 46, 0.7);
            backdrop-filter: blur(10px);
            border-radius: 10px;
            padding: 10px;
            margin-bottom: 20px;
            display: flex;
            gap: 10px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .tab-btn {
            flex: 1;
            padding: 12px 24px;
            background: transparent;
            color: #aaa;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.3s;
        }
        .tab-btn.active {
            background: rgba(98, 0, 234, 0.8);
            color: #fff;
        }
        .tab-btn:hover:not(.active) {
            background: rgba(255, 255, 255, 0.05);
            color: #fff;
        }
        .tab-content {
            display: none;
        }
        .tab-content.active {
            display: block;
        }
        .content-box {
            background: rgba(30, 30, 46, 0.7);
            backdrop-filter: blur(10px);
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #e6e6e6;
        }
        input[type="text"],
        textarea,
        input[type="file"] {
            width: 100%;
            padding: 12px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 5px;
            font-size: 14px;
            background: rgba(255, 255, 255, 0.05);
            color: #e6e6e6;
            transition: all 0.3s;
        }
        input[type="text"]:focus,
        textarea:focus {
            outline: none;
            border-color: rgba(98, 0, 234, 0.5);
            background: rgba(255, 255, 255, 0.08);
        }
        textarea {
            min-height: 100px;
            resize: vertical;
        }
        .btn {
            background: rgba(98, 0, 234, 0.8);
            color: #fff;
            padding: 12px 30px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.3s;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .btn:hover {
            background: rgba(98, 0, 234, 1);
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(98, 0, 234, 0.4);
        }
        .btn-danger {
            background: rgba(220, 53, 69, 0.8);
        }
        .btn-danger:hover {
            background: rgba(220, 53, 69, 1);
            box-shadow: 0 5px 20px rgba(220, 53, 69, 0.4);
        }
        .btn-small {
            padding: 8px 16px;
            font-size: 14px;
            margin-right: 5px;
        }
        .photo-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .photo-card {
            background: rgba(40, 40, 60, 0.6);
            border-radius: 10px;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: all 0.3s;
        }
        .photo-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 25px rgba(98, 0, 234, 0.3);
        }
        .photo-card img {
            width: 100%;
            height: 200px;
            object-fit: cover;
        }
        .photo-card-body {
            padding: 15px;
        }
        .photo-card-title {
            font-weight: 600;
            margin-bottom: 8px;
            color: #fff;
            font-size: 16px;
        }
        .photo-card-desc {
            font-size: 13px;
            color: #bbb;
            margin-bottom: 10px;
        }
        .photo-card-info {
            font-size: 12px;
            color: #888;
            margin-bottom: 15px;
        }
        .photo-card-actions {
            display: flex;
            gap: 8px;
        }
        .status {
            padding: 12px 20px;
            border-radius: 5px;
            margin-bottom: 20px;
            display: none;
            border: 1px solid;
        }
        .status.success {
            background: rgba(40, 167, 69, 0.2);
            color: #4caf50;
            border-color: rgba(40, 167, 69, 0.4);
        }
        .status.error {
            background: rgba(220, 53, 69, 0.2);
            color: #f44336;
            border-color: rgba(220, 53, 69, 0.4);
        }
        .preview-section {
            margin-top: 15px;
        }
        .preview-img {
            max-width: 100%;
            max-height: 300px;
            border-radius: 8px;
            margin-top: 10px;
        }
        .file-info {
            background: rgba(255, 255, 255, 0.05);
            padding: 12px;
            border-radius: 5px;
            margin-top: 10px;
            font-size: 13px;
            color: #bbb;
        }
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #888;
        }
        @media (max-width: 768px) {
            .photo-grid {
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            }
        }
    /* 通知系统样式 */
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        border-radius: 8px;
        color: #fff;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        transform: translateX(400px);
        transition: transform 0.3s ease, opacity 0.3s ease;
        opacity: 0;
        max-width: 350px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .notification.show {
        transform: translateX(0);
        opacity: 1;
    }

    .notification.error {
        background: rgba(220, 53, 69, 0.9);
        border-color: rgba(220, 53, 69, 0.3);
    }

    .notification.success {
        background: rgba(40, 167, 69, 0.9);
        border-color: rgba(40, 167, 69, 0.3);
    }

    .notification.warning {
        background: rgba(255, 193, 7, 0.9);
        border-color: rgba(255, 193, 7, 0.3);
        color: #333;
    }

    .notification.info {
        background: rgba(23, 162, 184, 0.9);
        border-color: rgba(23, 162, 184, 0.3);
    }

    /* 模态框样式 */
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
    }

    .modal-overlay.show {
        opacity: 1;
        visibility: visible;
    }

    .modal-dialog {
        background: rgba(30, 30, 46, 0.95);
        border-radius: 12px;
        padding: 24px;
        max-width: 400px;
        width: 90%;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        transform: scale(0.9) translateY(-20px);
        transition: transform 0.3s ease;
    }

    .modal-overlay.show .modal-dialog {
        transform: scale(1) translateY(0);
    }

    .modal-title {
        font-size: 18px;
        font-weight: 600;
        color: #fff;
        margin-bottom: 16px;
    }

    .modal-body {
        color: #ccc;
        margin-bottom: 20px;
        font-size: 14px;
        line-height: 1.5;
    }

    .modal-input {
        width: 100%;
        padding: 12px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        font-size: 14px;
        background: rgba(255, 255, 255, 0.05);
        color: #e6e6e6;
        margin-bottom: 12px;
        transition: all 0.3s;
    }

    .modal-input:focus {
        outline: none;
        border-color: rgba(98, 0, 234, 0.5);
        background: rgba(255, 255, 255, 0.08);
    }

    .modal-input-label {
        display: block;
        font-size: 13px;
        color: #aaa;
        margin-bottom: 6px;
    }

    .modal-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
    }

    .modal-btn {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.3s;
    }

    .modal-btn-cancel {
        background: rgba(255, 255, 255, 0.1);
        color: #ccc;
    }

    .modal-btn-cancel:hover {
        background: rgba(255, 255, 255, 0.15);
        color: #fff;
    }

    .modal-btn-confirm {
        background: rgba(98, 0, 234, 0.8);
        color: #fff;
    }

    .modal-btn-confirm:hover {
        background: rgba(98, 0, 234, 1);
    }

    .modal-btn-danger {
        background: rgba(220, 53, 69, 0.8);
        color: #fff;
    }

    .modal-btn-danger:hover {
        background: rgba(220, 53, 69, 1);
    }
    </style>
</head>
<body>
    <div class="container">
        <a href="/" class="back-link">← 返回相册</a>
        <div class="header">
            <h1>相册管理后台</h1>
            <button class="logout-btn" onclick="logout()">退出登录</button>
        </div>

        <div id="status" class="status"></div>

        <div class="tabs">
            <button class="tab-btn active" onclick="switchTab('upload')">上传照片</button>
            <button class="tab-btn" onclick="switchTab('manage')">图片管理</button>
            <button class="tab-btn" onclick="switchTab('settings')">系统设置</button>
        </div>

        <!-- 上传页面 -->
        <div id="uploadTab" class="tab-content active">
            <div class="content-box">
                <h2 style="margin-bottom: 25px; color: #fff; font-weight: 300;">上传新照片</h2>
                <form id="uploadForm">
                    <div class="form-group">
                        <label>选择图片（支持批量上传）</label>
                        <input type="file" id="fileInput" accept="image/*" multiple required>
                    </div>
                    <div class="preview-section" id="previewSection" style="display:none;">
                        <div id="previewGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 10px;"></div>
                        <div id="fileInfo" class="file-info"></div>
                    </div>
                    <div class="form-group">
                        <label>默认标题前缀（可选）</label>
                        <input type="text" id="title" placeholder="批量上传时的标题前缀">
                    </div>
                    <div class="form-group">
                        <label>默认描述（可选）</label>
                        <textarea id="description" placeholder="批量上传时的描述"></textarea>
                    </div>
                    <div id="uploadProgress" style="display:none; margin-bottom: 15px;">
                        <div style="background: rgba(255,255,255,0.1); border-radius: 5px; height: 30px; overflow: hidden;">
                            <div id="progressBar" style="background: rgba(98, 0, 234, 0.8); height: 100%; width: 0%; transition: width 0.3s; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 12px;"></div>
                        </div>
                        <div id="progressText" style="margin-top: 5px; font-size: 13px; color: #bbb;"></div>
                    </div>
                    <button type="submit" class="btn">上传照片</button>
                </form>
            </div>
        </div>

        <!-- 管理页面 -->
        <div id="manageTab" class="tab-content">
            <div class="content-box">
                <h2 style="margin-bottom: 25px; color: #fff; font-weight: 300;">已上传的照片</h2>
                <div id="photoList" class="photo-grid">
                    <div class="empty-state">加载中...</div>
                </div>
            </div>
        </div>

        <!-- 系统设置页面 -->
        <div id="settingsTab" class="tab-content">
            <div class="content-box">
                <h2 style="margin-bottom: 25px; color: #fff; font-weight: 300;">系统设置</h2>
                <form id="settingsForm">
                    <div class="form-group">
                        <label>网站标题</label>
                        <input type="text" id="siteTitle" placeholder="我的相册">
                    </div>
                    <div class="form-group">
                        <label>网站关键词</label>
                        <input type="text" id="siteKeywords" placeholder="相册,照片,图片">
                    </div>
                    <div class="form-group">
                        <label>网站描述</label>
                        <textarea id="siteDescription" placeholder="精心收藏的每一个瞬间"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Head 验证代码（如 Google Search Console）</label>
                        <textarea id="headCode" placeholder='<meta name="google-site-verification" content="..."/>'></textarea>
                    </div>
                    <div class="form-group">
                        <label>Footer 代码（统计代码等）</label>
                        <textarea id="footerCode" placeholder="<!-- 统计代码 -->"></textarea>
                    </div>
                    <div class="form-group">
                        <label>版权信息</label>
                        <input type="text" id="copyright" placeholder="© 2024 我的相册. All rights reserved.">
                    </div>
                    <div class="form-group">
                        <label>加载模式</label>
                        <select id="loadMode" style="width: 100%; padding: 12px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 5px; font-size: 14px; background: rgba(255, 255, 255, 0.05); color: #e6e6e6;">
                            <option value="pagination">页码翻页</option>
                            <option value="infinite">无限加载</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>每页显示数量</label>
                        <input type="number" id="pageSize" placeholder="6" min="1" max="50" value="6">
                    </div>
                    <button type="submit" class="btn">保存设置</button>
                </form>
            </div>
        </div>
    </div>

    <!-- 通用模态框 -->
    <div id="modalOverlay" class="modal-overlay">
        <div class="modal-dialog">
            <div class="modal-title" id="modalTitle"></div>
            <div class="modal-body" id="modalBody"></div>
            <div class="modal-actions" id="modalActions"></div>
        </div>
    </div>

    <script>
        function switchTab(tabName) {
            // 移除所有激活状态
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            // 激活选中的标签页
            if (tabName === 'upload') {
                document.querySelector('.tab-btn:nth-child(1)').classList.add('active');
                document.getElementById('uploadTab').classList.add('active');
            } else if (tabName === 'manage') {
                document.querySelector('.tab-btn:nth-child(2)').classList.add('active');
                document.getElementById('manageTab').classList.add('active');
                loadPhotos();
            } else if (tabName === 'settings') {
                document.querySelector('.tab-btn:nth-child(3)').classList.add('active');
                document.getElementById('settingsTab').classList.add('active');
                loadSettings();
            }
        }

        document.getElementById('fileInput').addEventListener('change', async function(e){
            const files = Array.from(e.target.files);
            if(!files.length) return;

            const previewGrid = document.getElementById('previewGrid');
            previewGrid.innerHTML = '';

            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = function(e){
                    const div = document.createElement('div');
                    div.innerHTML = \`<img src="\${e.target.result}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 5px;">\`;
                    previewGrid.appendChild(div);
                };
                reader.readAsDataURL(file);
            });

            document.getElementById('previewSection').style.display='block';
            const totalSize = files.reduce((sum, f) => sum + f.size, 0);
            document.getElementById('fileInfo').innerHTML=
                \`共选择 \${files.length} 个文件<br>总大小: \${(totalSize/1024/1024).toFixed(2)} MB\`;
        });

        document.getElementById('uploadForm').addEventListener('submit',async function(e){
            e.preventDefault();
            const files = Array.from(document.getElementById('fileInput').files);
            if(!files.length){showStatus('请选择文件','error');return;}

            const titlePrefix = document.getElementById('title').value;
            const description = document.getElementById('description').value;
            const progressDiv = document.getElementById('uploadProgress');
            const progressBar = document.getElementById('progressBar');
            const progressText = document.getElementById('progressText');

            progressDiv.style.display = 'block';
            let uploaded = 0;
            let failed = 0;

            for(let i = 0; i < files.length; i++){
                const file = files[i];
                const formData = new FormData();
                formData.append('file', file);
                formData.append('title', titlePrefix ? \`\${titlePrefix} \${i+1}\` : file.name);
                formData.append('description', description);

                try{
                    const res = await fetch('/api/photos', {method:'POST', body:formData});
                    const json = await res.json();
                    if(res.ok){
                        uploaded++;
                    } else {
                        failed++;
                    }
                }catch(err){
                    failed++;
                }

                const progress = Math.round(((i + 1) / files.length) * 100);
                progressBar.style.width = progress + '%';
                progressBar.textContent = progress + '%';
                progressText.textContent = \`已上传 \${uploaded} 个，失败 \${failed} 个，共 \${files.length} 个\`;
            }

            showStatus(\`上传完成！成功 \${uploaded} 个，失败 \${failed} 个\`, failed > 0 ? 'error' : 'success');
            document.getElementById('uploadForm').reset();
            document.getElementById('previewSection').style.display='none';

            setTimeout(() => {
                progressDiv.style.display = 'none';
                progressBar.style.width = '0%';
                if(uploaded > 0) switchTab('manage');
            }, 2000);
        });

        async function loadPhotos(){
            try{
                const data = await fetch('/api/photos?pageSize=999').then(r=>r.json());
                const photos = data.photos || [];
                const list=document.getElementById('photoList');
                if(!photos.length){
                    list.innerHTML='<div class="empty-state">暂无照片<br><small style="color:#666;">请前往上传页面添加第一张照片</small></div>';
                    return;
                }
                list.innerHTML=photos.map(p=>\`
                    <div class="photo-card">
                        <img src="/images/originals/\${p.fileName}?size=thumbnail" alt="\${p.title||p.originalName}">
                        <div class="photo-card-body">
                            <div class="photo-card-title">\${p.title||p.originalName}</div>
                            <div class="photo-card-desc">\${p.description||'无描述'}</div>
                            <div class="photo-card-info">
                                上传时间: \${new Date(p.uploadedAt).toLocaleDateString('zh-CN')}<br>
                                文件大小: \${(p.size/1024/1024).toFixed(2)} MB
                            </div>
                            <div class="photo-card-actions">
                                <button class="btn btn-small" onclick="editPhoto('\${p.id}','\${escape(p.title||'')}','\${escape(p.description||'')}')">编辑</button>
                                <button class="btn btn-danger btn-small" onclick="deletePhoto('\${p.id}')">删除</button>
                            </div>
                        </div>
                    </div>\`).join('');
            }catch(e){
                document.getElementById('photoList').innerHTML='<div class="empty-state">加载失败</div>';
            }
        }

        async function loadSettings(){
            try{
                const res = await fetch('/api/settings');
                if(res.ok){
                    const settings = await res.json();
                    document.getElementById('siteTitle').value = settings.siteTitle || '';
                    document.getElementById('siteKeywords').value = settings.siteKeywords || '';
                    document.getElementById('siteDescription').value = settings.siteDescription || '';
                    document.getElementById('headCode').value = settings.headCode || '';
                    document.getElementById('footerCode').value = settings.footerCode || '';
                    document.getElementById('copyright').value = settings.copyright || '';
                    document.getElementById('loadMode').value = settings.loadMode || 'pagination';
                    document.getElementById('pageSize').value = settings.pageSize || 6;
                }
            }catch(e){
                console.error('加载设置失败:', e);
            }
        }

        document.getElementById('settingsForm').addEventListener('submit', async function(e){
            e.preventDefault();
            const settings = {
                siteTitle: document.getElementById('siteTitle').value,
                siteKeywords: document.getElementById('siteKeywords').value,
                siteDescription: document.getElementById('siteDescription').value,
                headCode: document.getElementById('headCode').value,
                footerCode: document.getElementById('footerCode').value,
                copyright: document.getElementById('copyright').value,
                loadMode: document.getElementById('loadMode').value,
                pageSize: parseInt(document.getElementById('pageSize').value) || 6
            };

            try{
                const res = await fetch('/api/settings', {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(settings)
                });
                const json = await res.json();
                if(res.ok){
                    showStatus('设置保存成功！', 'success');
                } else {
                    showStatus('保存失败: ' + json.error, 'error');
                }
            }catch(err){
                showStatus('保存失败: ' + err.message, 'error');
            }
        });

        function editPhoto(id,title,desc){
            showEditModal(id, unescape(title), unescape(desc));
        }

        function showEditModal(id, currentTitle, currentDesc) {
            const overlay = document.getElementById('modalOverlay');
            const titleEl = document.getElementById('modalTitle');
            const bodyEl = document.getElementById('modalBody');
            const actionsEl = document.getElementById('modalActions');

            titleEl.textContent = '编辑照片信息';
            bodyEl.innerHTML = \`
                <label class="modal-input-label">标题</label>
                <input type="text" id="editTitleInput" class="modal-input" value="\${currentTitle}" placeholder="请输入标题">
                <label class="modal-input-label">描述</label>
                <textarea id="editDescInput" class="modal-input" placeholder="请输入描述" style="min-height: 80px;">\${currentDesc}</textarea>
            \`;
            actionsEl.innerHTML = \`
                <button class="modal-btn modal-btn-cancel" onclick="closeModal()">取消</button>
                <button class="modal-btn modal-btn-confirm" onclick="confirmEdit('\${id}')">保存</button>
            \`;

            overlay.classList.add('show');
            document.getElementById('editTitleInput').focus();
        }

        function confirmEdit(id) {
            const newTitle = document.getElementById('editTitleInput').value;
            const newDesc = document.getElementById('editDescInput').value;
            closeModal();

            fetch(\`/api/photos/\${id}\`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:newTitle,description:newDesc})})
                .then(r=>r.json()).then(()=>{showStatus('更新成功','success');loadPhotos();})
                .catch(e=>showStatus('更新失败: '+e.message,'error'));
        }

        function deletePhoto(id){
            showConfirmModal(
                '确认删除',
                '确定要删除这张照片吗？此操作无法撤销。',
                function() {
                    fetch(\`/api/photos/\${id}\`,{method:'DELETE'})
                        .then(r=>r.json()).then(()=>{showStatus('删除成功','success');loadPhotos();})
                        .catch(e=>showStatus('删除失败: '+e.message,'error'));
                },
                true
            );
        }

        function showConfirmModal(title, message, onConfirm, isDanger) {
            const overlay = document.getElementById('modalOverlay');
            const titleEl = document.getElementById('modalTitle');
            const bodyEl = document.getElementById('modalBody');
            const actionsEl = document.getElementById('modalActions');

            titleEl.textContent = title;
            bodyEl.innerHTML = \`<p>\${message}</p>\`;

            const confirmBtnClass = isDanger ? 'modal-btn-danger' : 'modal-btn-confirm';
            actionsEl.innerHTML = \`
                <button class="modal-btn modal-btn-cancel" onclick="closeModal()">取消</button>
                <button class="modal-btn \${confirmBtnClass}" id="confirmBtn">确定</button>
            \`;

            document.getElementById('confirmBtn').onclick = function() {
                closeModal();
                if (onConfirm) onConfirm();
            };

            overlay.classList.add('show');
        }

        function closeModal() {
            document.getElementById('modalOverlay').classList.remove('show');
        }

        // 点击遮罩层关闭
        document.getElementById('modalOverlay').addEventListener('click', function(e) {
            if (e.target === this) closeModal();
        });

        // ESC 键关闭
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') closeModal();
        });

        function showStatus(msg,type){
            const s=document.getElementById('status');
            s.textContent=msg;s.className='status '+type;s.style.display='block';
            setTimeout(()=>s.style.display='none',3000);
        }

        function escape(str){return str.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
        function unescape(str){return str.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");}

        // 优雅的通知系统
        function showNotification(message, type = 'info', duration = 3000) {
            // 创建通知元素
            const notification = document.createElement('div');
            notification.className = 'notification ' + type;
            notification.textContent = message;
            
            // 添加到body
            document.body.appendChild(notification);
            
            // 触发显示动画
            setTimeout(function() {
                notification.classList.add('show');
            }, 100);
            
            // 自动隐藏
            setTimeout(function() {
                notification.classList.remove('show');
                setTimeout(function() {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, duration);
        }

        async function logout(){
            showConfirmModal(
                '退出登录',
                '确定要退出登录吗？',
                async function() {
                    try{
                        await fetch('/api/logout',{method:'POST'});
                        window.location.href='/admin/login';
                    }
                    catch(e){
                        showNotification('登出失败：' + e.message, 'error');
                    }
                },
                false
            );
        }
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