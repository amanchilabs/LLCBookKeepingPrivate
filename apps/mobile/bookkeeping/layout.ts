export function contentTopInset(platform: string, statusBarHeight?: number | null): number {
  if (platform !== 'android' || statusBarHeight == null) return 0;
  return Math.max(0, statusBarHeight);
}
