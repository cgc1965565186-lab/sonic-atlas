import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowsClockwise,
  ArrowLeft,
  ArrowLineDown,
  ArrowLineUp,
  Bug,
  CaretRight,
  Check,
  CloudSlash,
  Copy,
  DownloadSimple,
  FilmStrip,
  FolderOpen,
  Image,
  ListDashes,
  MagnifyingGlass,
  MusicNotes,
  NotePencil,
  Play,
  Plus,
  Queue,
  Repeat,
  RepeatOnce,
  ShieldCheck,
  Shuffle,
  SignOut,
  SpinnerGap,
  Trash,
  UserCircle,
  X,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { AUDIO_BANDS } from '../audio/AudioEngine';
import {
  exportScreenshot,
  recordVisualClip,
  type ExportAspect,
  type WatermarkPosition,
} from '../export/visualExport';
import { CAMERA_PRESETS, GRID_SIZES, VISUAL_THEMES, type ThemeId } from '../config/visual';
import { ApiError, neteaseApi } from '../netease/api';
import type { PlaylistSummary, SongSummary } from '../netease/types';
import { useAuthStore } from '../store/authStore';
import { useLocalLibraryStore } from '../store/localLibraryStore';
import { usePlayerStore } from '../store/playerStore';
import { useUiStore } from '../store/uiStore';
import {
  useVisualStore,
  type LyricAlignment,
  type LyricMotionMode,
  type QualityMode,
} from '../store/visualStore';
import { GlassSurface } from './GlassSurface';

function messageFrom(error: unknown) {
  return error instanceof ApiError || error instanceof Error ? error.message : '请求未能完成';
}

function TrackRow({ song, index, queue }: { song: SongSummary; index: number; queue: SongSummary[] }) {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const playQueue = usePlayerStore((state) => state.playQueue);
  const addToQueue = usePlayerStore((state) => state.addToQueue);
  const addNext = usePlayerStore((state) => state.addNext);
  const isCurrent = currentTrack?.id === song.id && currentTrack.source === song.source;
  return (
    <div className={`track-row ${isCurrent ? 'is-current' : ''} ${song.missing ? 'is-missing' : ''}`}>
      <button className="track-main" type="button" disabled={song.missing} onClick={() => void playQueue(queue, index)}>
        <span className="track-number">{isCurrent ? <Play weight="fill" /> : String(index + 1).padStart(2, '0')}</span>
        <span className="track-copy">
          <strong>{song.title}</strong>
          <small>{song.missing ? '文件已丢失' : `${song.artists.join(' / ')} · ${song.album.name}`}</small>
        </span>
        <span className="track-duration">{Math.floor(song.durationMs / 60_000)}:{Math.floor((song.durationMs % 60_000) / 1_000).toString().padStart(2, '0')}</span>
      </button>
      <span className="track-actions">
        <button type="button" onClick={() => addNext(song)} title="下一首播放" aria-label={`下一首播放 ${song.title}`}><ArrowLineUp /></button>
        <button type="button" onClick={() => addToQueue([song])} title="加入队列" aria-label={`加入队列 ${song.title}`}><Plus /></button>
      </span>
    </div>
  );
}

function SearchPanel({ sourceTabs }: { sourceTabs?: ReactNode }) {
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
    return <div className="drawer-panel">{sourceTabs}<PanelState icon={<CloudSlash />} title="桌面版连接曲库" detail="浏览器预览保留完整 UI 与 Demo；请运行 Electron 版进行搜索和播放" /></div>;
  }

  return (
    <div className="drawer-panel">
      {sourceTabs}
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
  const source = useUiStore((state) => state.musicSection);
  const setSource = useUiStore((state) => state.setMusicSection);
  const authenticated = useAuthStore((state) => state.authenticated);
  const openLogin = useAuthStore((state) => state.openLogin);
  const local = useLocalLibraryStore();
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [selected, setSelected] = useState<PlaylistSummary | null>(null);
  const [songs, setSongs] = useState<SongSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (local.tracks.length === 0 && !local.loading) void local.initialize();
    // The store actions are stable; loading the library once is sufficient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authenticated || source !== 'netease') return;
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
  }, [authenticated, source]);

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

  const sourceTabs = (
    <div className="segmented-control source-tabs source-tabs-three">
      <button type="button" className={source === 'search' ? 'is-selected' : ''} onClick={() => setSource('search')}>搜索</button>
      <button type="button" className={source === 'local' ? 'is-selected' : ''} onClick={() => setSource('local')}>本地音乐</button>
      <button type="button" className={source === 'netease' ? 'is-selected' : ''} onClick={() => setSource('netease')}>网易云</button>
    </div>
  );

  if (source === 'search') return <SearchPanel sourceTabs={sourceTabs} />;

  if (source === 'local') {
    return (
      <div className="drawer-panel local-library-panel">
        {sourceTabs}
        <div className="library-actions">
          <button className="secondary-button" type="button" disabled={local.loading} onClick={() => void local.importFiles()}><MusicNotes />选择文件</button>
          <button className="secondary-button" type="button" disabled={local.loading} onClick={() => void local.importFolder()}><FolderOpen />选择文件夹</button>
          <button className="icon-button" type="button" disabled={local.loading} onClick={() => void local.rescan()} title="重新扫描" aria-label="重新扫描本地音乐"><ArrowsClockwise className={local.loading ? 'spin' : ''} /></button>
        </div>
        <div className="panel-meta"><span>LOCAL LIBRARY</span><span>{local.tracks.length} 首</span></div>
        {local.error ? <PanelState icon={<CloudSlash />} title="资料库操作失败" detail={local.error} /> : null}
        {local.lastImport && (local.lastImport.imported > 0 || local.lastImport.updated > 0 || local.lastImport.failures.length > 0) ? (
          <p className="inline-notice">新增 {local.lastImport.imported} 首，更新 {local.lastImport.updated} 首，跳过 {local.lastImport.failures.length} 个文件。</p>
        ) : null}
        {!local.loading && local.tracks.length === 0 ? <PanelState icon={<FolderOpen />} title="这里还没有本地音乐" detail="选择文件或文件夹；应用只保存引用，不复制音频。" /> : null}
        {local.loading ? <PanelState icon={<SpinnerGap className="spin" />} title="正在整理本地音乐" detail="读取标签、封面和歌词" /> : null}
        {!local.loading && local.tracks.length > 0 ? (
          <div className="track-list">
            {local.tracks.map((song, index) => (
              <div className="local-track-wrap" key={song.id}>
                <TrackRow song={song} index={index} queue={local.tracks} />
                {song.missing ? (
                  <button className="text-action" type="button" onClick={() => void local.relocate(song.id)}>重新定位</button>
                ) : null}
                <button className="text-action danger" type="button" onClick={() => void local.remove(song.id)}>移除</button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="drawer-panel">
        {sourceTabs}
        <PanelState icon={<UserCircle />} title="登录后查看账号歌单" detail="只读取当前账号有权访问的内容" />
        <button className="primary-button" type="button" onClick={() => void openLogin()}>打开官方登录窗口</button>
      </div>
    );
  }
  return (
    <div className="drawer-panel">
      {sourceTabs}
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

const repeatOptions = [
  { id: 'sequential', label: '顺序', icon: ListDashes },
  { id: 'list', label: '循环', icon: Repeat },
  { id: 'one', label: '单曲', icon: RepeatOnce },
  { id: 'shuffle', label: '随机', icon: Shuffle },
] as const;

function QueuePanel() {
  const player = usePlayerStore();
  const [dragged, setDragged] = useState<number | null>(null);
  return (
    <div className="drawer-panel queue-panel">
      <div className="repeat-options">
        {repeatOptions.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={player.repeatMode === id ? 'is-selected' : ''} onClick={() => player.setRepeatMode(id)}>
            <Icon /><span>{label}</span>
          </button>
        ))}
      </div>
      <div className="panel-meta"><span>PLAY QUEUE</span><span>{player.queue.length} 首</span></div>
      {player.queue.length === 0 ? <PanelState icon={<Queue />} title="播放队列为空" detail="从本地资料库、搜索或网易云歌单加入音乐。" /> : null}
      {player.queue.length > 0 ? (
        <>
          <div className="queue-list">
            {player.queue.map((track, index) => {
              const current = index === player.currentIndex;
              return (
                <div
                  className={`queue-item ${current ? 'is-current' : ''}`}
                  key={`${track.source}:${track.id}`}
                  draggable
                  onDragStart={() => setDragged(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragged !== null) player.moveQueueItem(dragged, index);
                    setDragged(null);
                  }}
                >
                  <button className="queue-play" type="button" onClick={() => void player.playTrack(index)}>
                    <span>{current ? <Play weight="fill" /> : String(index + 1).padStart(2, '0')}</span>
                    <span><strong>{track.title}</strong><small>{track.source === 'local' ? '本地' : '网易云'} · {track.artists.join(' / ')}</small></span>
                  </button>
                  <div className="queue-item-actions">
                    <button type="button" disabled={index === 0} onClick={() => player.moveQueueItem(index, index - 1)} aria-label="上移"><ArrowLineUp /></button>
                    <button type="button" disabled={index === player.queue.length - 1} onClick={() => player.moveQueueItem(index, index + 1)} aria-label="下移"><ArrowLineDown /></button>
                    <button type="button" onClick={() => void player.removeQueueItem(index)} aria-label="移除"><Trash /></button>
                  </div>
                </div>
              );
            })}
          </div>
          <button className="secondary-button danger-button" type="button" onClick={player.clearQueue}><Trash />清空队列</button>
        </>
      ) : null}
    </div>
  );
}

function ExportPanel() {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const playing = usePlayerStore((state) => state.playing);
  const [aspect, setAspect] = useState<ExportAspect>('16:9');
  const [customText, setCustomText] = useState('');
  const [position, setPosition] = useState<WatermarkPosition>('bottom-right');
  const [opacity, setOpacity] = useState(68);
  const [duration, setDuration] = useState<5 | 10 | 15>(10);
  const [includeAudio, setIncludeAudio] = useState(true);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const options = { aspect, customText, watermarkPosition: position, watermarkOpacity: opacity / 100 };

  const runScreenshot = async () => {
    setBusy(true);
    setMessage('');
    try {
      await exportScreenshot(options);
      setMessage('PNG 截图已保存。');
    } catch (error) {
      setMessage(messageFrom(error));
    } finally {
      setBusy(false);
    }
  };
  const runVideo = async () => {
    if (!rightsConfirmed) return;
    setBusy(true);
    setProgress(0);
    setMessage('');
    try {
      const format = await recordVisualClip(options, duration, includeAudio, setProgress);
      setMessage(`${duration} 秒 ${format.toUpperCase()} 短片已保存。`);
    } catch (error) {
      setMessage(messageFrom(error));
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  return (
    <div className="drawer-panel export-panel">
      <section className="setting-section">
        <div className="section-heading"><span>FRAME</span><small>截图与短片使用相同画幅</small></div>
        <div className="segmented-control export-aspects">
          {(['window', '16:9', '9:16', '1:1'] as ExportAspect[]).map((value) => (
            <button key={value} type="button" className={aspect === value ? 'is-selected' : ''} onClick={() => setAspect(value)}>{value === 'window' ? '窗口' : value}</button>
          ))}
        </div>
      </section>
      <section className="setting-section">
        <div className="section-heading"><span>WATERMARK</span><small>品牌标识始终保留</small></div>
        <label className="field-row"><span>附加文字</span><input maxLength={40} value={customText} onChange={(event) => setCustomText(event.currentTarget.value)} placeholder="昵称或一句短句" /></label>
        <label className="field-row"><span>位置</span><select value={position} onChange={(event) => setPosition(event.currentTarget.value as WatermarkPosition)}><option value="top-left">左上</option><option value="top-right">右上</option><option value="bottom-left">左下</option><option value="bottom-right">右下</option></select></label>
        <SliderRow label="水印透明度" value={opacity} onChange={setOpacity} />
      </section>
      <button className="secondary-button" type="button" disabled={busy} onClick={() => void runScreenshot()}><Image />导出 PNG 截图</button>
      <section className="setting-section">
        <div className="section-heading"><span>VISUAL CLIP</span><small>实时录制，最长 15 秒</small></div>
        <div className="segmented-control">
          {([5, 10, 15] as const).map((value) => <button key={value} type="button" className={duration === value ? 'is-selected' : ''} onClick={() => setDuration(value)}>{value} 秒</button>)}
        </div>
        <label className="switch-row"><span><strong>包含当前音频</strong><small>{playing ? '录制正在播放的片段' : '录制时自动播放，结束后恢复暂停'}</small></span><input type="checkbox" checked={includeAudio} onChange={(event) => setIncludeAudio(event.currentTarget.checked)} /><i /></label>
        <label className="rights-confirm"><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.currentTarget.checked)} /><span>我确认有权使用当前片段，并理解导出仅限 15 秒以内。</span></label>
        <button className="primary-button" type="button" disabled={busy || !currentTrack || !rightsConfirmed} onClick={() => void runVideo()}><FilmStrip />{busy && progress > 0 ? `录制中 ${Math.round(progress * 100)}%` : '录制视觉短片'}</button>
      </section>
      {message ? <p className="inline-notice" aria-live="polite">{message}</p> : null}
    </div>
  );
}

function DiagnosticsSection() {
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState('');
  const quality = useVisualStore((state) => state.effectiveQuality);
  const audioStatus = usePlayerStore((state) => `${state.mode}:${state.playing ? 'playing' : 'paused'}`);
  const authenticated = useAuthStore((state) => state.authenticated);
  const status = { quality, audioStatus, authenticated };
  const refresh = async () => {
    if (!window.sonicAtlas) {
      setMessage('诊断报告仅在桌面版中可用。');
      return;
    }
    setReport(await window.sonicAtlas.getDiagnostics(status) as unknown as Record<string, unknown>);
  };
  useEffect(() => {
    let cancelled = false;
    if (!window.sonicAtlas) return;
    void window.sonicAtlas.getDiagnostics(status).then((value) => {
      if (!cancelled) setReport(value as unknown as Record<string, unknown>);
    });
    return () => {
      cancelled = true;
    };
    // The panel captures a single opening snapshot; users can explicitly refresh it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const copyReport = async () => {
    if (!report) return;
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setMessage('脱敏诊断摘要已复制。');
  };
  return (
    <section className="setting-section diagnostics-panel support-section">
      <div className="section-heading"><span>DIAGNOSTICS & FEEDBACK</span><small>由你决定是否导出</small></div>
      <div className="support-copy">
        <Bug />
        <p><strong>诊断与反馈</strong><small>不会包含 Cookie、完整网络地址或本地文件路径，也不会在后台自动上传。</small></p>
      </div>
      <div className="diagnostic-actions">
        <button className="secondary-button" type="button" onClick={() => void refresh()}><ArrowsClockwise />刷新</button>
        <button className="secondary-button" type="button" disabled={!report} onClick={() => void copyReport()}><Copy />复制摘要</button>
        <button className="secondary-button" type="button" onClick={() => void window.sonicAtlas?.exportDiagnostics(status)}><DownloadSimple />导出报告</button>
      </div>
      {report ? <pre className="diagnostic-preview">{JSON.stringify(report, null, 2)}</pre> : <PanelState icon={<SpinnerGap className="spin" />} title="正在准备报告" detail="只汇总最近 200 条脱敏事件" />}
      <button className="primary-button" type="button" onClick={() => void window.sonicAtlas?.openFeedback(status)}><NotePencil />复制报告并反馈问题</button>
      {message ? <p className="inline-notice" aria-live="polite">{message}</p> : null}
    </section>
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
        <div className="section-heading"><span>QUALITY</span><small>当前实际画质：{visual.effectiveQuality === 'high' ? '高' : visual.effectiveQuality === 'medium' ? '中' : '低'}</small></div>
        <div className="segmented-control">
          {([
            ['auto', '自动'],
            ['low', '低'],
            ['medium', '中'],
            ['high', '高'],
          ] as Array<[QualityMode, string]>).map(([id, label]) => (
            <button key={id} type="button" className={visual.qualityMode === id ? 'is-selected' : ''} onClick={() => visual.setQualityMode(id)}>{label}</button>
          ))}
        </div>
        <p className="setting-copy">自动模式在持续低帧率 10 秒后降档，稳定 20 秒后再升档。</p>
      </section>
      <section className="setting-section">
        <div className="section-heading"><span>LYRICS</span><small>减少动态效果时自动使用静态过渡</small></div>
        <div className="motion-options">
          {([
            ['cinematic', '电影淡入'],
            ['breathe', '呼吸聚焦'],
            ['glow', '逐字流光'],
            ['depth', '景深漂移'],
            ['static', '静态'],
          ] as Array<[LyricMotionMode, string]>).map(([id, label]) => (
            <button key={id} type="button" className={visual.lyricMotion === id ? 'is-selected' : ''} onClick={() => visual.setLyricMotion(id)}>{label}</button>
          ))}
        </div>
        <div className="segmented-control">
          {([['left', '左对齐'], ['center', '居中']] as Array<[LyricAlignment, string]>).map(([id, label]) => (
            <button key={id} type="button" className={visual.lyricAlignment === id ? 'is-selected' : ''} onClick={() => visual.setLyricAlignment(id)}>{label}</button>
          ))}
        </div>
        <SliderRow label="歌词字号" value={visual.lyricSize} onChange={visual.setLyricSize} />
        <SliderRow label="前后行透明度" value={visual.lyricContextOpacity} onChange={visual.setLyricContextOpacity} />
        <SliderRow label="动效强度" value={visual.lyricMotionIntensity} onChange={visual.setLyricMotionIntensity} />
      </section>
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

function SupportPanel() {
  const openInstallHelp = () => void window.sonicAtlas?.openInstallHelp();
  const restartIntro = useUiStore((state) => state.restartIntro);
  return (
    <div className="drawer-panel install-help-panel support-panel">
      <section className="setting-section support-section">
        <div className="section-heading"><span>MACOS SAFETY</span><small>未签名测试构建</small></div>
        <div className="support-copy">
          <ShieldCheck />
          <p><strong>首次安装与安全</strong><small>只在确认安装包来自 Sonic Atlas 官网或本项目 Release 时继续。</small></p>
        </div>
        <ol>
          <li>从“应用程序”正常尝试打开 Sonic Atlas 一次。</li>
          <li>若被拦截，前往“系统设置 → 隐私与安全性”。</li>
          <li>在“安全性”区域点“仍要打开（Open Anyway）”，再确认“打开”。</li>
        </ol>
        <p className="inline-notice">无需关闭 Gatekeeper，也不要使用终端命令移除隔离保护。受管理的 Mac 请联系 IT 管理员。</p>
        <div className="support-actions">
          {window.sonicAtlas ? (
            <button className="secondary-button" type="button" onClick={openInstallHelp}>查看官方安装说明</button>
          ) : (
            <a className="secondary-button" href="https://cgc1965565186-lab.github.io/sonic-atlas/#macos-install" target="_blank" rel="noreferrer">查看官方安装说明</a>
          )}
          <button className="secondary-button" type="button" onClick={restartIntro}><ArrowsClockwise />重新打开首次启动向导</button>
        </div>
      </section>
      <DiagnosticsSection />
    </div>
  );
}

function PanelState({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="panel-state"><span>{icon}</span><strong>{title}</strong><p>{detail}</p></div>;
}

const titles = {
  library: ['MUSIC', '搜索、网易云与本地音乐'],
  queue: ['QUEUE', '安排接下来播放的声音'],
  visual: ['VISUAL FIELD', '塑造声音地形与歌词'],
  export: ['EXPORT', '带水印的截图与短片'],
  account: ['ACCOUNT', '本机登录与安全'],
  help: ['SUPPORT', '安装安全、诊断与反馈'],
} as const;

export function RightDrawer() {
  const drawer = useUiStore((state) => state.drawer);
  const closeDrawer = useUiStore((state) => state.closeDrawer);
  return (
    <AnimatePresence>
      {drawer ? (
        <motion.aside className="drawer-wrap" initial={{ x: 28, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }} transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}>
          <GlassSurface className="right-drawer">
            <header><div><span>{titles[drawer][0]}</span><p>{titles[drawer][1]}</p></div><button type="button" className="icon-button" onClick={closeDrawer} aria-label="关闭面板"><X /></button></header>
            {drawer === 'library' ? <LibraryPanel /> : null}
            {drawer === 'queue' ? <QueuePanel /> : null}
            {drawer === 'visual' ? <VisualPanel /> : null}
            {drawer === 'export' ? <ExportPanel /> : null}
            {drawer === 'account' ? <AccountPanel /> : null}
            {drawer === 'help' ? <SupportPanel /> : null}
          </GlassSurface>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
