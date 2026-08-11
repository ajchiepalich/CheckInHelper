export function MockModeBanner() {
  return (
    <div
      role="status"
      className="border-b border-[var(--color-gold)] bg-[var(--color-warning-bg)] px-4 py-2 text-center text-sm text-[var(--color-warning-text)]"
    >
      Local mock mode is active. Responses use fixture documentation and a
      mocked retrieval provider.
    </div>
  );
}
