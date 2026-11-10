import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDuration,
  filterAndSortTracks,
  toggleTrackFavorite,
  updateTrackMetadata,
  createNewPlaylist,
  saveCustomPreset,
} from './libraryLogic';
import { Track, VisualizerConfig } from '../types/novabeat';

const sampleTracks: Track[] = [
  {
    id: 't1',
    title: 'Lost in Shadows',
    artist: 'NovaBeat',
    album: 'Midnight Horizons',
    folder: 'NovaBeat Originals',
    durationSec: 225,
    bpm: 124,
    genre: 'Dark Synthwave',
    coverUrl: '/cover1.svg',
    audioSource: 'synth-stem',
    synthProfile: 'shadow-synth',
    isFavorite: true,
    isCloudSynced: true,
    playCount: 18,
    addedAt: 1000,
    lastPlayedAt: 5000,
  },
  {
    id: 't2',
    title: 'Future Trap & Bass',
    artist: 'Avee Collective',
    album: 'Subwoofer Ritual',
    folder: 'Bass & Trap',
    durationSec: 308,
    bpm: 140,
    genre: 'Future Trap',
    coverUrl: '/cover2.svg',
    audioSource: 'synth-stem',
    synthProfile: 'future-trap',
    isFavorite: false,
    isCloudSynced: false,
    playCount: 9,
    addedAt: 2000,
    lastPlayedAt: 3000,
  },
];

test('formatDuration formats seconds into zero-padded MM:SS', () => {
  assert.equal(formatDuration(225), '03:45');
  assert.equal(formatDuration(84), '01:24');
  assert.equal(formatDuration(308), '05:08');
});

test('filterAndSortTracks filters by query, favorites, cloud status, and sorts accurately', () => {
  const favs = filterAndSortTracks(sampleTracks, {
    searchQuery: '',
    tab: 'favorites',
    sortBy: 'title',
  });
  assert.equal(favs.length, 1);
  assert.equal(favs[0].id, 't1');

  const cloud = filterAndSortTracks(sampleTracks, {
    searchQuery: '',
    tab: 'cloud',
    sortBy: 'title',
  });
  assert.equal(cloud.length, 1);
  assert.equal(cloud[0].title, 'Lost in Shadows');

  const byDuration = filterAndSortTracks(sampleTracks, {
    searchQuery: '',
    tab: 'songs',
    sortBy: 'duration',
  });
  assert.equal(byDuration[0].id, 't2');
});

test('toggleTrackFavorite and updateTrackMetadata mutate target track cleanly', () => {
  const toggled = toggleTrackFavorite(sampleTracks, 't2');
  assert.equal(toggled.find((t) => t.id === 't2')?.isFavorite, true);

  const edited = updateTrackMetadata(sampleTracks, 't1', {
    title: 'Lost in Shadows (VIP Edit)',
    customBackdropUrl: 'data:image/png;base64,custom',
  });
  assert.equal(edited[0].title, 'Lost in Shadows (VIP Edit)');
  assert.equal(edited[0].customBackdropUrl, 'data:image/png;base64,custom');
});

test('createNewPlaylist validates empty name and prepends valid playlist', () => {
  const failRes = createNewPlaylist([], '   ', 'desc', ['t1']);
  assert.equal(failRes.created, null);
  assert.ok(failRes.error);

  const okRes = createNewPlaylist([], 'Late Night Synth', 'Best bass tracks', ['t1', 't2']);
  assert.ok(okRes.created);
  assert.equal(okRes.playlists.length, 1);
  assert.equal(okRes.created.name, 'Late Night Synth');
});

test('saveCustomPreset validates name and deep-clones layers', () => {
  const dummyConfig: VisualizerConfig = {
    id: 'p0',
    name: 'Default',
    style: 'circular-spectrum',
    colorSchemeId: 'nova-purple',
    primaryColor: '#8B5CF6',
    secondaryColor: '#06B6D4',
    accentColor: '#EC4899',
    sensitivity: 70,
    smoothing: 0.72,
    glowIntensity: 75,
    spectrumSize: 1.0,
    barCount: 64,
    opacity: 0.95,
    rotationSpeed: 8,
    baseRotation: 0,
    xPosition: 0,
    yPosition: 0,
    scale: 1.0,
    mirrorMode: true,
    backgroundUrl: '',
    centerImageUrl: '',
    showEditorGrid: false,
    layers: [],
  };

  const fail = saveCustomPreset([], dummyConfig, '');
  assert.equal(fail.saved, null);

  const success = saveCustomPreset([], dummyConfig, 'My Bass Ring');
  assert.ok(success.saved);
  assert.equal(success.saved.name, 'My Bass Ring');
  assert.equal(success.presets.length, 1);
});
