export function MockModeBanner() {
  return (
    <div
      role="status"
      className="border-b border-[var(--color-gold)] bg-[#fff8e8] px-4 py-2 text-center text-sm text-[#6e5530]"
    >
      Local mock mode is active. Responses use fixture documentation and a
      mocked retrieval provider.
    </div>
  );
}
