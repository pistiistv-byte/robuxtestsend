export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  const username = String(req.query.username || "").trim();
  if (username.length < 3) return res.status(200).json({ users: [] });

  const found = new Map();

  async function safeJson(url, options = {}) {
    try {
      const r = await fetch(url, {
        ...options,
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json",
          ...(options.headers || {})
        }
      });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) {
      return null;
    }
  }

  async function getAvatar(userId) {
    const urls = [
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`,
      `https://thumbnails.roproxy.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
    ];

    for (const url of urls) {
      const j = await safeJson(url);
      const img = j?.data?.[0]?.imageUrl;
      if (img) return img;
    }

    // Direct Roblox thumbnail endpoint fallback using real Roblox userId.
    return `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`;
  }

  async function add(user) {
    if (!user || !user.id || !user.name || found.has(user.id)) return;
    const avatar = await getAvatar(user.id);
    found.set(user.id, {
      id: user.id,
      name: user.name,
      displayName: user.displayName || user.name,
      avatar
    });
  }

  const exactUrls = [
    "https://users.roblox.com/v1/usernames/users",
    "https://users.roproxy.com/v1/usernames/users"
  ];

  for (const url of exactUrls) {
    const j = await safeJson(url, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({usernames:[username], excludeBannedUsers:true})
    });
    for (const u of (j?.data || [])) await add(u);
  }

  const searchUrls = [
    `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=10`,
    `https://users.roproxy.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=10`
  ];

  for (const url of searchUrls) {
    const j = await safeJson(url);
    for (const u of (j?.data || [])) await add(u);
  }

  return res.status(200).json({ users: Array.from(found.values()) });
}