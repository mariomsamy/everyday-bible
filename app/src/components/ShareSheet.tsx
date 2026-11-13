import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, DownloadSimple, LinkSimple, ShareNetwork } from '@phosphor-icons/react';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { useStudy } from '../state/study';
import { useUI } from '../state/ui';
import { useSettings } from '../state/settings';
import { useBookName, useChapter } from '../hooks';
import { abbrOf, findVersion } from '../data/catalog';
import { refLabel } from '../ref';
import { shareUrl } from '../link';
import { copyText } from '../share';
import { track } from '../analytics';
import { useT } from '../i18n';
import { CARD_STYLES, canvasBlob, drawCard } from '../share-card';

const CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp', url: (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}` },
  { id: 'telegram', label: 'Telegram', url: (text: string, link: string) => `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}` },
  { id: 'x', label: 'X', url: (text: string, link: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}` },
  { id: 'facebook', label: 'Facebook', url: (_: string, link: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}` },
] as const;

/** Share the selected verses as text, as a link, or as an image card made on the device. */
export function ShareSheet() {
  const t = useT();
  const close = useUI((s) => s.close);
  const notify = useUI((s) => s.notify);
  const { book, chapter, selection } = useStudy();
  const versionId = useSettings((s) => s.versionId);
  const bookName = useBookName();
  const chapterText = useChapter(book, chapter);
  const info = findVersion(versionId);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [styleIx, setStyleIx] = useState(0);
  const [ready, setReady] = useState(false);

  const verses = chapterText.status === 'ready' ? chapterText.verses : [];
  const first = selection[0];
  const last = selection[selection.length - 1];
  const body = useMemo(() => selection.map((v) => verses[v - 1]).filter(Boolean).join(' ').replace(/\s*\n\s*/g, ' '), [selection, verses]);
  const ref = `${refLabel(bookName(book), chapter, first, last)}`;
  const link = first ? shareUrl(versionId, book, chapter, { from: first, to: last }) : location.origin;
  const message = `${body}\n— ${ref} (${abbrOf(versionId)})\n${link}`;

  useEffect(() => {
    if (!canvas.current || !body) return;
    let live = true;
    setReady(false);
    void drawCard(canvas.current, {
      text: body, reference: ref, version: info?.name ?? abbrOf(versionId), footer: `${t('shareFooter')} · ${location.host}`,
      rtl: !!info?.rtl, style: CARD_STYLES[styleIx],
    }).then(() => live && setReady(true));
    return () => { live = false; };
  }, [body, ref, info, versionId, styleIx, t]);

  const blob = () => canvasBlob(canvas.current!);
  const sent = (channel: string) => track('share', { channel, kind: 'verse' });

  const shareImage = async () => {
    try {
      const file = new File([await blob()], 'verse.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: message });
        sent('native_image');
        return;
      }
      if (navigator.share) {
        await navigator.share({ text: message });
        sent('native_text');
        return;
      }
      await save();
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) notify(t('shareFailed'));
    }
  };
  const save = async () => {
    try {
      const url = URL.createObjectURL(await blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `${ref.replace(/[^\p{L}\p{N}]+/gu, '-')}.png`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      sent('download');
      notify(t('shareSaved'));
    } catch {
      notify(t('shareFailed'));
    }
  };
  const copy = async (text: string, channel: string) => {
    const ok = await copyText(text);
    if (ok) sent(channel);
    notify(t(ok ? 'copied' : 'copyFailed'));
  };

  return (
    <Sheet title={t('shareVerse')} icon={ShareNetwork} onClose={close} tall>
      <div className="share-preview">
        <canvas ref={canvas} aria-label={ref} role="img" data-ready={ready} />
      </div>
      <div className="chips" role="group" aria-label={t('shareStyle')}>
        {CARD_STYLES.map((s, i) => (
          <button key={s.id} className="swatch-style" style={{ background: `linear-gradient(135deg, ${s.bg[0]}, ${s.bg[1]})`, color: s.accent }} aria-pressed={i === styleIx} aria-label={`${t('shareStyle')} ${i + 1}`} onClick={() => setStyleIx(i)} />
        ))}
      </div>
      <div className="share-actions">
        <Button variant="primary" block icon={ShareNetwork} onClick={shareImage} disabled={!ready}>{t('shareSend')}</Button>
        <Button block icon={DownloadSimple} onClick={save} disabled={!ready}>{t('shareDownload')}</Button>
        <Button block icon={Copy} onClick={() => copy(`${body}\n— ${ref} (${abbrOf(versionId)})`, 'copy_text')}>{t('shareCopyText')}</Button>
        <Button block icon={LinkSimple} onClick={() => copy(link, 'copy_link')}>{t('shareLink')}</Button>
      </div>
      <h3 className="share-via">{t('shareVia')}</h3>
      <div className="chips">
        {CHANNELS.map((c) => (
          <a key={c.id} className="chip-btn" href={c.url(message, link)} target="_blank" rel="noopener noreferrer" onClick={() => sent(c.id)}>{c.label}</a>
        ))}
      </div>
    </Sheet>
  );
}
