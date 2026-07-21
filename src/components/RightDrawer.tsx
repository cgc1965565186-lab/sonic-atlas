import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  CaretRight,
  Check,
  CloudSlash,
  MagnifyingGlass,
  Play,
  ShieldCheck,
  SignOut,
  SpinnerGap,
  UserCircle,
  X,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { AUDIO_BANDS } from '../audio/AudioEngine';
import { CAMERA_PRESETS, GRID_SIZES, VISUAL_THEMES, type ThemeId } from '../config/visual';
import { ApiError, neteaseApi } from '../netease/api';
import type { PlaylistSummary, SongSummary } from '../netease/types';
import { useAuthStore } from '../store/authStore';
import { usePlayerStore } from '../store/playerStore';
import { useUiStore } from '../store/uiStore';
import { useVisualStore } from '../store/visualStore';
import { GlassSurface } from './GlassSurface';

function messageFrom(error: unknown) {
  return error instanceof ApiError || error instanceof Error ? error.message : '请求未能完成';
}

function TrackRow({ song, index, queue }: { song: SongSummary; index: number; queue: SongSummary[] }) {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const playQueue = usePlayerStore((state) => state.playQueue);
  const isCurrent = currentTrack?.id === song.id;
  return (
    <button className={`track-row ${isCurrent ? 'is-current' : ''}`} type="button" onClick={() => void playQueue(queue, index)}>
      <span className="track-number">{isCurrent ? <Play weight="fill" /> : String(index + 1).padStart(2, '0')}</span>
      <span className="track-copy">
        <strong>{song.title}</strong>
        <small>{song.artists.join(' / ')} · {song.album.name}</small>
      </span>
      <span className="track-duration">{Math.floor(song.durationMs / 60_000)}:{Math.floor((song.durationMs % 60_000) / 1_000).toString().padStart(2, '0')}</span>
    </button>
  );
}

function SearchPanel() {
  const desktopAvailable = useAuthStore((state) => state.desktopAvailable);
  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState<SongSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => {
    const normalized = query.trim();
    if (!normalized) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void neteaseApi
        .search(normalized, 0, controller.signal)
        .then((result) => {
          setSongs(result.songs);
          setTotal(result.total);
        })
        .catch((requestError: unknown) => {
          if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
          setError(messageFrom(requestError));
          setSongs([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 350);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const updateQuery = (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      setSongs([]);
      setTotal(0);
      setError(null);
      setLoading(false);
    }
  };

  if (!desktopAvailable) {
    return <div className="drawer-panel"><PanelState icon={<CloudSlash />} title="桌面版连接曲库" detail="浏览器预览保留完整 UI 与 Demo；请运行 Electron 版进行搜索和播放" /></div>;
  }

  return (
    <div className="drawer-panel">
      <label className="search-field">
        <MagnifyingGlass />
        <input ref={inputRef} value={query} onChange={(event) => updateQuery(event.currentTarget.value)} placeholder="歌曲、歌手或专辑" />
        {query ? <button type="button" onClick={() => updateQuery('')} aria-label="清空搜索"><X /></button> : null}
      </label>
      <div className="panel-meta">
        <span>NETEASE CLOUD MUSIC</span>
        {songs.length > 0 ? <span>{total.toLocaleString()} 个结果</span> : null}
      </div>
      {loading ? <PanelState icon={<SpinnerGap className="spin" />} title="正在扫描曲库" detail="通过本地服务安全请求" /> : null}
      {!loading && error ? <PanelState icon={<CloudSlash />} title="搜索未完成" detail={error} /> : null}
      {!loading && !error && query.trim() && songs.length === 0 ? <PanelState icon={<MagnifyingGlass />} title="没有找到匹配音乐" detail="试试更短的关键词或歌手名" /> : null}
      {!loading && !error && !query.trim() ? <PanelState icon={<MagnifyingGlass />} title="寻找一个声音坐标" detail="输入关键词，结果不会离开本机代理" /> : null}
      {songs.length > 0 ? <div className="track-list">{songs.map((song, index) => <TrackRow key={song.id} song={song} index={index} queue={songs} />)}</div> : null}
    </div>
  );
}

function LibraryPanel() {
  const authenticated = useAuthStore((state) => state.authenticated);
  const openLogin = useAuthStore((state) => state.openLogin);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [selected, setSelected] = useState<PlaylistSummary | null>(null);
  const [songs, setSongs] = useState<SongSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    const controller = new AbortController();
    void Promise.resolve()
      .then(() => {
        if (!controller.signal.aborted) setLoading(true);
        return neteaseApi.playlists(0, controller.signal);
      })
      .then((result) => setPlaylists(result.playlists))
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) setError(messageFrom(requestError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [authenticated]);

  const choosePlaylist = async (playlist: PlaylistSummary) => {
    setSelected(playlist);
    setLoading(true);
    setError(null);
    setSongs([]);
    try {
      const result = await neteaseApi.playlistTracks(playlist.id);
      setSongs(result.songs);
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setLoading(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="drawer-panel">
        <PanelState icon={<UserCircle />} title="登录后查看账号歌单" detail="只读取当前账号有权访问的内容" />
        <button className="primary-button" type="button" onClick={() => void openLogin()}>打开官方登录窗口</button>
      </div>
    );
  }
  return (
    <div className="drawer-panel">
      {selected ? (
        <button className="back-button" type="button" onClick={() => { setSelected(null); setSongs([]); setError(null); }}>
          <ArrowLeft /> 返回歌单
        </button>
      ) : <div className="panel-meta"><span>ACCOUNT LIBRARY</span><span>{playlists.length} 张歌单</span></div>}
      {loading ? <PanelState icon={<SpinnerGap className="spin" />} title={selected ? '载入曲目' : '读取账号歌单'} detail="请稍候" /> : null}
      {!loading && error ? <PanelState icon={<CloudSlash />} title="歌单未能载入" detail={error} /> : null}
      {!loading && !error && !selected && playlists.length === 0 ? <PanelState icon={<CloudSlash />} title="账号里还没有歌单" detail="收藏或创建歌单后会出现在这里" /> : null}
      {!selected && playlists.length > 0 ? (
        <div className="playlist-grid">
          {playlists.map((playlist) => (
            <button type="button" className="playlist-card" key={playlist.id} onClick={() => void choosePlaylist(playlist)}>
              <img src={playlist.coverUrl} alt="" draggable={false} />
              <span><strong>{playlist.title}</strong><small>{playlist.trackCount} 首 · {playlist.creator}</small></span>
              <CaretRight />
            </button>
          ))}
        </div>
      ) : null}
      {selected && !loading && songs.length === 0 && !error ? <PanelState icon={<CloudSlash />} title="歌单中没有可显示曲目" detail="可能是权限或地区限制" /> : null}
      {songs.length > 0 ? <div className="track-list">{songs.map((song, index) => <TrackRow key={song.id} song={song} index={index} queue={songs} />)}</div> : null}
    </div>
  );
}

function SliderRow({ label, hint, value, onChange }: { label: string; hint?: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="slider-row">
      <span><strong>{label}</strong>{hint ? <small>{hint}</small> : null}</span>
      <input type="range" min={0} max={100} value={value} onChange={(event) => onChange(Number(event.currentTarget.value))} style={{ '--range-progress': `${value}%` } as React.CSSProperties} />
      <output>{value}</output>
    </label>
  );
}

function VisualPanel() {
  const visual = useVisualStore();
  const paletteLabel = visual.paletteStatus === 'loading'
    ? '正在读取封面色彩'
    : visual.paletteStatus === 'fallback'
      ? '当前使用预设回退'
      : visual.paletteMode === 'cover'
        ? '封面色彩已同步'
        : '预设配色已锁定';
  return (
    <div className="drawer-panel visual-panel">
      <section className="setting-section">
        <div className="section-heading"><span>PALETTE</span><small>{paletteLabel}</small></div>
        <label className="switch-row palette-auto-row">
          <span><strong>封面自适应</strong><small>切歌后平滑同步地形与强调色</small></span>
          <input
            type="checkbox"
            checked={visual.paletteMode === 'cover'}
            onChange={(event) => visual.setPaletteMode(event.currentTarget.checked ? 'cover' : 'preset')}
          />
          <i />
        </label>
        <div className="palette-preview" aria-label="当前场景配色">
          {[visual.runtimePalette.background, visual.runtimePalette.base, visual.runtimePalette.accent, visual.runtimePalette.secondary, visual.runtimePalette.tertiary, visual.runtimePalette.hot]
            .map((color, index) => <i key={`${color}-${index}`} style={{ backgroundColor: color }} />)}
        </div>
        <div className="theme-options">
          {(Object.values(VISUAL_THEMES) as Array<(typeof VISUAL_THEMES)[ThemeId]>).map((theme) => (
            <button key={theme.id} type="button" className={visual.themeId === theme.id && visual.paletteMode === 'preset' ? 'is-selected' : ''} onClick={() => visual.setTheme(theme.id)}>
              <i style={{ background: `linear-gradient(135deg, ${theme.base}, ${theme.accent}, ${theme.hot})` }} />
              <span>{theme.label}<small>{theme.name}</small></span>
              {visual.themeId === theme.id && visual.paletteMode === 'preset' ? <Check /> : null}
            </button>
          ))}
        </div>
      </section>
      <section className="setting-section">
        <div className="section-heading"><span>TOPOGRAPHY</span><small>密度切换会重建一次几何</small></div>
        <div className="segmented-control">
          {GRID_SIZES.map((size) => <button key={size} type="button" className={visual.gridSize === size ? 'is-selected' : ''} onClick={() => visual.setGridSize(size)}>{size}²</button>)}
        </div>
        <SliderRow label="起伏速度" value={visual.motionSpeed} onChange={visual.setMotionSpeed} />
        <SliderRow label="发光强度" value={visual.glowIntensity} onChange={visual.setGlowIntensity} />
        <label className="switch-row"><span><strong>节拍涟漪</strong><small>从场中心向外扩散</small></span><input type="checkbox" checked={visual.ripplesEnabled} onChange={(event) => visual.setRipplesEnabled(event.currentTarget.checked)} /><i /></label>
      </section>
      <section className="setting-section">
        <div className="section-heading"><span>CINEMATIC CAMERA</span><small>所有接管均平滑过渡</small></div>
        <div className="camera-options">
          {CAMERA_PRESETS.map((preset) => <button key={preset.id} type="button" className={visual.cameraPreset === preset.id ? 'is-selected' : ''} onClick={() => visual.setCameraPreset(preset.id)}><span><strong>{preset.label}</strong><small>{preset.description}</small></span>{visual.cameraPreset === preset.id ? <Check /> : null}</button>)}
        </div>
      </section>
      <section className="setting-section eq-section">
        <div className="section-heading"><span>GROUND EQ · 8 BAND</span><small>调整视觉响应，不改变声音</small></div>
        {AUDIO_BANDS.map((band, index) => <SliderRow key={band.id} label={band.label} hint={band.personality} value={visual.bandGains[index] ?? 50} onChange={(value) => visual.setBandGain(index, value)} />)}
      </section>
    </div>
  );
}

function AccountPanel() {
  const auth = useAuthStore();
  const [manualOpen, setManualOpen] = useState(false);
  const [cookie, setCookie] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cookie.trim()) return;
    const value = cookie;
    setCookie('');
    await auth.saveManualCookie(value);
  };
  return (
    <div className="drawer-panel account-panel">
      {auth.authenticated && auth.user ? (
        <>
          <div className="profile-card">
            <img src={auth.user.avatarUrl} alt="" draggable={false} />
            <div><span>NETEASE ACCOUNT</span><strong>{auth.user.nickname}</strong><small>{auth.persistence === 'encrypted' ? '凭据由系统钥匙串保护' : '仅保留至本次会话结束'}</small></div>
          </div>
          <button className="secondary-button" type="button" onClick={() => void auth.logout()}><SignOut />退出登录</button>
        </>
      ) : (
        <>
          <PanelState icon={<UserCircle />} title="连接网易云音乐" detail="将在独立官方窗口中完成扫码；应用只保存必要 Cookie" />
          <button className="primary-button" type="button" disabled={auth.loading} onClick={() => void auth.openLogin()}>{auth.loading ? <SpinnerGap className="spin" /> : null}打开官方登录窗口</button>
          {!auth.desktopAvailable ? <p className="inline-notice">浏览器模式只提供声音地形演示。请运行桌面版以使用登录。</p> : null}
        </>
      )}
      {auth.error ? <p className="error-notice">{auth.error}</p> : null}
      <details className="advanced-auth" open={manualOpen} onToggle={(event) => setManualOpen(event.currentTarget.open)}>
        <summary>高级调试 · 手动 Cookie</summary>
        <form onSubmit={(event) => void submit(event)}>
          <p>仅用于调试。输入会被遮罩、提交后立即清空，且不会写入日志。</p>
          <input type="password" autoComplete="off" value={cookie} onChange={(event) => setCookie(event.currentTarget.value)} placeholder="MUSIC_U=…" />
          <button className="secondary-button" type="submit" disabled={!cookie.trim() || auth.loading}>验证并保存</button>
        </form>
      </details>
    </div>
  );
}

function InstallHelpPanel() {
  const openInstallHelp = () => void window.sonicAtlas?.openInstallHelp();
  return (
    <div className="drawer-panel install-help-panel">
      <PanelState icon={<ShieldCheck />} title="macOS 首次安装帮助" detail="Sonic Atlas 是未签名测试构建；请只在确认下载来源可信时为它创建例外。" />
      <ol>
        <li>从“应用程序”正常尝试打开 Sonic Atlas 一次。</li>
        <li>若被拦截，前往“系统设置 → 隐私与安全性”。</li>
        <li>在“安全性”区域点“仍要打开（Open Anyway）”，再确认“打开”。</li>
      </ol>
      <p className="inline-notice">无需关闭 Gatekeeper，也不要使用终端命令移除隔离保护。受管理的 Mac 请联系 IT 管理员。</p>
      {window.sonicAtlas ? (
        <button className="secondary-button" type="button" onClick={openInstallHelp}>查看官方安装说明</button>
      ) : (
        <a className="secondary-button" href="https://cgc1965565186-lab.github.io/sonic-atlas/#macos-install" target="_blank" rel="noreferrer">查看官方安装说明</a>
      )}
    </div>
  );
}

function PanelState({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="panel-state"><span>{icon}</span><strong>{title}</strong><p>{detail}</p></div>;
}

const titles = { search: ['SEARCH', '在网易云曲库中寻找'], library: ['LIBRARY', '当前账号的收藏坐标'], visual: ['VISUAL FIELD', '塑造声音地形'], account: ['ACCOUNT', '本机登录与安全'], help: ['INSTALL HELP', 'macOS 首次安装与安全'] } as const;

export function RightDrawer() {
  const drawer = useUiStore((state) => state.drawer);
  const closeDrawer = useUiStore((state) => state.closeDrawer);
  return (
    <AnimatePresence>
      {drawer ? (
        <motion.aside className="drawer-wrap" initial={{ x: 28, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }} transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}>
          <GlassSurface className="right-drawer">
            <header><div><span>{titles[drawer][0]}</span><p>{titles[drawer][1]}</p></div><button type="button" className="icon-button" onClick={closeDrawer} aria-label="关闭面板"><X /></button></header>
            {drawer === 'search' ? <SearchPanel /> : null}
            {drawer === 'library' ? <LibraryPanel /> : null}
            {drawer === 'visual' ? <VisualPanel /> : null}
            {drawer === 'account' ? <AccountPanel /> : null}
            {drawer === 'help' ? <InstallHelpPanel /> : null}
          </GlassSurface>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
