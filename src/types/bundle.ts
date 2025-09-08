/** バンドルのサイズ差分 */
export interface BundleDiff {
  name: string;
  oldSize: number;
  newSize: number;
  delta: number;
  oldGzipSize: number;
  newGzipSize: number;
  gzipDelta: number;
}
