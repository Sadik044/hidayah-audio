/**
 * HIDAYAH AUDIO — BROWSER MEDIA SESSION & LOCK SCREEN INTEGRATION
 * 
 * Provides native OS lock-screen, notification shade, and Bluetooth
 * media controls for Android Chrome and iPhone Safari via the W3C Media Session API.
 */

import { getCoverImageUrl } from './supabase';

export interface MediaSessionMetadataOptions {
  title: string;
  artist?: string | null;
  album?: string | null;
  coverImage?: string | null;
}

export interface MediaSessionActionCallbacks {
  onPlay: () => void | Promise<void>;
  onPause: () => void;
  onPreviousTrack: (() => void) | null;
  onNextTrack: (() => void) | null;
  onSeekBackward: (offset: number) => void;
  onSeekForward: (offset: number) => void;
  onSeekTo: (position: number) => void;
}

export const MEDIA_SESSION_ACTIONS: MediaSessionAction[] = [
  'play',
  'pause',
  'previoustrack',
  'nexttrack',
  'seekbackward',
  'seekforward',
  'seekto',
];

/**
 * Converts a relative URL into a fully-qualified, absolute HTTPS URL
 * required for iOS Now Playing and Android Chrome lock-screen artwork.
 */
export function toAbsoluteArtworkUrl(pathOrUrl: string | null | undefined): string {
  const resolved = getCoverImageUrl(pathOrUrl);
  if (typeof window === 'undefined') return resolved;

  try {
    return new URL(resolved, window.location.origin).href;
  } catch {
    return resolved;
  }
}

/**
 * Updates navigator.mediaSession.metadata with current track info and multi-sized artwork.
 */
export function updateMediaSessionMetadata(options: MediaSessionMetadataOptions | null): void {
  if (
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    !('mediaSession' in navigator)
  ) {
    return;
  }

  if (!options) {
    navigator.mediaSession.metadata = null;
    return;
  }

  const { title, artist, album, coverImage } = options;
  const absoluteCover = toAbsoluteArtworkUrl(coverImage);

  const mimeType = absoluteCover.endsWith('.png')
    ? 'image/png'
    : absoluteCover.endsWith('.webp')
    ? 'image/webp'
    : absoluteCover.endsWith('.svg')
    ? 'image/svg+xml'
    : 'image/jpeg';

  const artworkSizes = ['96x96', '128x128', '192x192', '256x256', '384x384', '512x512'];
  const artwork = artworkSizes.map((sizes) => ({
    src: absoluteCover,
    sizes,
    type: mimeType,
  }));

  if (typeof MediaMetadata !== 'undefined') {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title || 'হিদায়াহ অডিও',
        artist: artist || 'হিদায়াহ অডিও',
        album: album || 'হিদায়াহ অডিও',
        artwork,
      });
    } catch (err) {
      console.warn('Failed to set mediaSession.metadata:', err);
    }
  }
}

/**
 * Updates playback state ('playing', 'paused', 'none') for OS lock-screen indicator.
 */
export function updateMediaSessionPlaybackState(state: 'none' | 'paused' | 'playing'): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
    return;
  }

  try {
    navigator.mediaSession.playbackState = state;
  } catch (err) {
    console.warn('Failed to set mediaSession.playbackState:', err);
  }
}

/**
 * Synchronizes position state (currentTime, duration, playbackRate) with lock-screen scrubber.
 * Guarded against invalid/NaN/infinite values according to W3C Media Session spec.
 */
export function updateMediaSessionPositionState(
  position: number,
  duration: number,
  playbackRate = 1
): void {
  if (
    typeof navigator === 'undefined' ||
    !('mediaSession' in navigator) ||
    typeof navigator.mediaSession.setPositionState !== 'function'
  ) {
    return;
  }

  if (
    duration > 0 &&
    Number.isFinite(duration) &&
    position >= 0 &&
    Number.isFinite(position) &&
    playbackRate > 0 &&
    Number.isFinite(playbackRate)
  ) {
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate,
        position: Math.min(position, duration),
      });
    } catch {
      // Ignore clamping/rounding errors from browser platform
    }
  }
}

/**
 * Registers OS lock-screen action handlers (play, pause, next, previous, seek).
 * Setting a handler to null disables the corresponding hardware/lock-screen control.
 */
export function registerMediaSessionActions(callbacks: MediaSessionActionCallbacks | null): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
    return;
  }

  if (!callbacks) {
    for (const action of MEDIA_SESSION_ACTIONS) {
      try {
        navigator.mediaSession.setActionHandler(action, null);
      } catch {}
    }
    return;
  }

  const actionMap: Partial<Record<MediaSessionAction, MediaSessionActionHandler | null>> = {
    play: callbacks.onPlay ? () => callbacks.onPlay() : null,
    pause: callbacks.onPause ? () => callbacks.onPause() : null,
    previoustrack: callbacks.onPreviousTrack ? () => callbacks.onPreviousTrack!() : null,
    nexttrack: callbacks.onNextTrack ? () => callbacks.onNextTrack!() : null,
    seekbackward: callbacks.onSeekBackward
      ? (details) => {
          const offset = details.seekOffset || 10;
          callbacks.onSeekBackward(offset);
        }
      : null,
    seekforward: callbacks.onSeekForward
      ? (details) => {
          const offset = details.seekOffset || 10;
          callbacks.onSeekForward(offset);
        }
      : null,
    seekto: callbacks.onSeekTo
      ? (details) => {
          if (typeof details.seekTime === 'number' && Number.isFinite(details.seekTime)) {
            callbacks.onSeekTo(details.seekTime);
          }
        }
      : null,
  };

  for (const [action, handler] of Object.entries(actionMap)) {
    try {
      navigator.mediaSession.setActionHandler(action as MediaSessionAction, handler || null);
    } catch {
      // Action not supported in this client environment
    }
  }
}

/**
 * Completely clears Media Session metadata, playbackState, and action handlers.
 */
export function clearMediaSession(): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
    return;
  }

  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
    for (const action of MEDIA_SESSION_ACTIONS) {
      try {
        navigator.mediaSession.setActionHandler(action, null);
      } catch {}
    }
  } catch {}
}
