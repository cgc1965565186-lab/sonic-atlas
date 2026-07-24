import {
  Aperture,
  ArrowsOut,
  Bug,
  Export as ExportIcon,
  ListBullets,
  MagnifyingGlass,
  Playlist,
  ShieldCheck,
  SlidersHorizontal,
  UserCircle,
} from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useUiStore, type DrawerId } from '../store/uiStore';
import { GlassSurface } from './GlassSurface';

const entries: Array<{
  id: Exclude<DrawerId, null>;
  label: string;
  icon: typeof MagnifyingGlass;
}> = [
  { id: 'search', label: '搜索', icon: MagnifyingGlass },
  { id: 'library', label: '歌单', icon: Playlist },
  { id: 'queue', label: '播放队列', icon: ListBullets },
  { id: 'visual', label: '声场', icon: SlidersHorizontal },
  { id: 'export', label: '视觉导出', icon: ExportIcon },
  { id: 'diagnostics', label: '诊断与反馈', icon: Bug },
  { id: 'account', label: '账号', icon: UserCircle },
  { id: 'help', label: '安装帮助', icon: ShieldCheck },
];

export function SideRail() {
  const drawer = useUiStore((state) => state.drawer);
  const openDrawer = useUiStore((state) => state.openDrawer);
  const toggleImmersive = useUiStore((state) => state.toggleImmersive);
  const authenticated = useAuthStore((state) => state.authenticated);
  return (
    <GlassSurface className="side-rail" aria-label="主导航">
      <span className="brand-glyph" aria-hidden="true">
        <Aperture weight="thin" />
      </span>
      <div className="rail-actions">
        {entries.map(({ id, label, icon: Icon }) => (
          <motion.button
            key={id}
            type="button"
            className={`icon-button rail-button ${drawer === id ? 'is-active' : ''}`}
            onClick={() => openDrawer(id)}
            whileTap={{ scale: 0.94 }}
            title={label}
            aria-label={label}
            aria-pressed={drawer === id}
          >
            <Icon weight={drawer === id ? 'fill' : 'regular'} />
            {id === 'account' && authenticated ? <span className="account-dot" /> : null}
          </motion.button>
        ))}
      </div>
      <button className="icon-button rail-button" type="button" onClick={toggleImmersive} title="沉浸模式" aria-label="沉浸模式">
        <ArrowsOut />
      </button>
    </GlassSurface>
  );
}
