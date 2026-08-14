// ============================================
// 把你的 YouTube Data API v3 Key 填在这里
// ============================================
const API_KEY = "AIzaSyDJD_Ey1aOwrpgcgKfP0anJlfwc3mYDMY8";

async function ytFetch(endpoint, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  params.key = API_KEY;
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

// 把 YouTube 的 ISO 8601 时长(PT1H2M3S)转成 1:02:03 这类显示格式;
// 直播(PT0S)返回 null,不显示角标
function formatDuration(iso) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!m) return null;
  const total = (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  if (!total) return null;
  const h = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(mm).padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
}

// 批量查视频时长:videos.list 一次最多 50 个 ID,自动分块
async function fetchVideoDurations(videoIds) {
  const map = {};
  for (let i = 0; i < videoIds.length; i += 50) {
    const data = await ytFetch('videos', {
      part: 'contentDetails',
      id: videoIds.slice(i, i + 50).join(',')
    });
    data.items.forEach(v => { map[v.id] = v.contentDetails.duration; });
  }
  return map;
}

// 给网格里已渲染的 .video-card 补时长角标(按卡片上的 data-video-id 对应)
function attachDurations(grid, durationsById) {
  grid.querySelectorAll('.video-card').forEach(card => {
    const t = formatDuration(durationsById[card.dataset.videoId]);
    if (t) {
      card.querySelector('.thumb').insertAdjacentHTML('beforeend', `<span class="duration">${t}</span>`);
    }
  });
}

// 返回链接:来源是同站页面时优先 history.back()
// (浏览器 bfcache 会把原页面连同滚动位置、分页状态原样恢复);
// 直接打开或外站跳入时走 href 兜底
function attachBack(link) {
  link.addEventListener('click', (e) => {
    if (document.referrer && new URL(document.referrer).origin === location.origin) {
      e.preventDefault();
      history.back();
    }
  });
}
