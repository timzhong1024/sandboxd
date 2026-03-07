const runtimeFallbackMessages = new Set([
  "systemctl runtime disabled while fixture mode is enabled",
  "systemctl runtime is only available on Linux",
]);

export function shouldFallbackToMetadata(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return runtimeFallbackMessages.has(error.message);
}
