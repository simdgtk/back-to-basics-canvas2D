export interface AudioTrackConfig {
  id: string;
  name: string;
  file: File;
  color: string;
  opacity: number;
}

export interface TrackMetadata {
  id: string;
  name: string;
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
  color: string;
  opacity: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}