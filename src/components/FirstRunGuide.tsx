import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  FolderOpen,
  Gauge,
  MusicNotes,
  ShieldCheck,
  SignIn,
  SkipForward,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useLocalLibraryStore } from '../store/localLibraryStore';
import { useVisualStore, type EffectiveQuality } from '../store/visualStore';

const STEPS = ['欢迎', '选择音乐', '性能检测', '隐私与版权'] as const;

export function FirstRunGuide({ onComplete, reducedMotion }: { onComplete: () => void; reducedMotion: boolean }) {
  const [step, setStep] = useState(0);
  const [testing, setTesting] = useState(false);
  const [recommendation, setRecommendation] = useState<EffectiveQuality | null>(null);
  const importFiles = useLocalLibraryStore((state) => state.importFiles);
  const importFolder = useLocalLibraryStore((state) => state.importFolder);
  const localCount = useLocalLibraryStore((state) => state.tracks.length);
  const openLogin = useAuthStore((state) => state.openLogin);
  const authenticated = useAuthStore((state) => state.authenticated);
  const setQualityMode = useVisualStore((state) => state.setQualityMode);

  useEffect(() => {
    if (step !== 2 || !testing || recommendation) return;
    let frames = 0;
    let frame = 0;
    const started = performance.now();
    const measure = () => {
      frames += 1;
      const elapsed = performance.now() - started;
      if (elapsed < 1_800) {
        frame = requestAnimationFrame(measure);
        return;
      }
      const fps = frames * 1_000 / elapsed;
      const quality: EffectiveQuality = fps >= 55 ? 'high' : fps >= 38 ? 'medium' : 'low';
      setRecommendation(quality);
      setTesting(false);
    };
    frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [recommendation, step, testing]);

  const applyRecommendation = () => {
    if (recommendation) setQualityMode(recommendation);
    setStep(3);
  };

  return (
    <motion.section
      className="first-run"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.15 : 0.45 }}
      aria-label="首次启动向导"
    >
      <div className="first-run-progress" aria-label={`第 ${step + 1} 步，共 ${STEPS.length} 步`}>
        {STEPS.map((label, index) => (
          <span key={label} className={index <= step ? 'is-active' : ''}><i />{label}</span>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          className="first-run-content"
          key={step}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -10, filter: 'blur(5px)' }}
        >
          {step === 0 ? (
            <>
              <span className="eyebrow">SONIC ATLAS · 0.2</span>
              <h1>让每一首音乐，<br />生成自己的地形。</h1>
              <p>网易云音乐与本地文件共享同一套播放、歌词和视觉系统。本地文件只在这台 Mac 上读取，不会上传。</p>
              <button className="primary-button" type="button" onClick={() => setStep(1)}>开始设置 <ArrowRight /></button>
            </>
          ) : null}
          {step === 1 ? (
            <>
              <span className="eyebrow">MUSIC SOURCES</span>
              <h2>从你已经拥有的音乐开始</h2>
              <p>两种来源可以同时使用，也可以稍后再设置。</p>
              <div className="source-actions">
                <button type="button" onClick={() => void importFiles()}><MusicNotes /><span><strong>选择音乐文件</strong><small>{localCount > 0 ? `已导入 ${localCount} 首` : 'MP3、M4A、FLAC、WAV、OGG'}</small></span></button>
                <button type="button" onClick={() => void importFolder()}><FolderOpen /><span><strong>扫描音乐文件夹</strong><small>引用原文件，不创建副本</small></span></button>
                <button type="button" onClick={() => void openLogin()}><SignIn /><span><strong>连接网易云音乐</strong><small>{authenticated ? '账号已经连接' : '在独立官方窗口中登录'}</small></span></button>
              </div>
              <button className="primary-button" type="button" onClick={() => { setTesting(true); setStep(2); }}>继续 <ArrowRight /></button>
            </>
          ) : null}
          {step === 2 ? (
            <>
              <Gauge className="guide-symbol" />
              <span className="eyebrow">VISUAL PERFORMANCE</span>
              <h2>{testing ? '正在观察这台 Mac 的帧率' : '画质建议已经准备好'}</h2>
              <p>{testing ? '检测只在本机进行，大约需要两秒。' : `建议使用“${recommendation === 'high' ? '高' : recommendation === 'medium' ? '中' : '低'}”画质；之后仍可切换自动模式。`}</p>
              <div className={`quality-meter ${testing ? 'is-testing' : ''}`}><i /></div>
              <button className="primary-button" type="button" disabled={testing} onClick={applyRecommendation}>{testing ? '检测中' : '采用建议并继续'} <ArrowRight /></button>
            </>
          ) : null}
          {step === 3 ? (
            <>
              <ShieldCheck className="guide-symbol" />
              <span className="eyebrow">PRIVACY & RIGHTS</span>
              <h2>你的文件留在本机，分享由你决定</h2>
              <ul className="guide-checks">
                <li><Check /> 本地路径不会发送给界面、网络或诊断报告。</li>
                <li><Check /> 网易云凭据使用 macOS 安全存储保护。</li>
                <li><Check /> 视觉短片最长 15 秒，导出前需要确认使用权。</li>
              </ul>
              <button className="primary-button" type="button" onClick={onComplete}>进入 Sonic Atlas <ArrowRight /></button>
            </>
          ) : null}
        </motion.div>
      </AnimatePresence>
      <button className="skip-guide" type="button" onClick={onComplete}><SkipForward />跳过向导</button>
    </motion.section>
  );
}
